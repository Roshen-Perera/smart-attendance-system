import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  XCircle,
  Download,
  UserCheck,
  Edit2,
  Trash2,
  ScanFace,
  Circle,
  ShieldCheck,
  AlertCircle,
  Maximize2,
  Minimize2,
  Users,
} from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';
import {
  sessionsApi,
  classesApi,
  attendanceApi,
  recognitionApi,
  reportsApi,
} from '../api/endpoints';
import type { Session, ClassCourse, Student, AttendanceRecord } from '../types';
import { Modal } from '../components/ui/Modal';
import toast from 'react-hot-toast';

// How many consecutive detection frames before we capture (≈1s at 80ms interval)
const LOCK_FRAMES = 12;
// Cooldown in ms after a recognition attempt before scanning again
const COOLDOWN_MS = 3500;
const DETECTION_INTERVAL_MS = 80;

export const SessionDetailPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();

  const [session, setSession] = useState<Session | null>(null);
  const [classroom, setClassroom] = useState<ClassCourse | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Manual & Correction modal state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedStudentForManual, setSelectedStudentForManual] = useState('');
  const [correctingRecord, setCorrectingRecord] = useState<AttendanceRecord | null>(null);
  const [newStudentIdForCorrection, setNewStudentIdForCorrection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI Recognition state
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [lastResult, setLastResult] = useState<{ name: string; reg: string; confidence: number; success: boolean } | null>(null);
  const [inCooldown, setInCooldown] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [recentScans, setRecentScans] = useState<Array<{ name: string; reg: string; confidence: number; timestamp: Date }>>([]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockFramesRef = useRef(0);
  const isScanningRef = useRef(false); // avoids stale closure in interval

  // Load face-api models once
  useEffect(() => {
    faceapi.nets.tinyFaceDetector.loadFromUri('/models')
      .then(() => setModelsLoaded(true))
      .catch(() => toast.error('Failed to load face detection models'));
    return () => stopCamera();
  }, []);

  const stopCamera = useCallback(() => {
    if (detectionLoopRef.current) clearInterval(detectionLoopRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const overlay = overlayCanvasRef.current;
    if (overlay) overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height);
    setIsWebcamActive(false);
    setIsScanning(false);
    setFaceDetected(false);
    isScanningRef.current = false;
    lockFramesRef.current = 0;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsWebcamActive(true);
      lockFramesRef.current = 0;
      isScanningRef.current = false;
    } catch {
      toast.error('Camera access denied or unavailable');
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      try {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Fallback to CSS overlay
      }
    } else {
      setIsFullscreen(false);
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch {
        // Fallback
      }
    }
  }, [isFullscreen]);

  // Run recognition when a face locks
  const runRecognition = useCallback(async () => {
    if (!videoRef.current || !sessionId) return;
    isScanningRef.current = true;
    setIsScanning(true);

    const canvas = captureCanvasRef.current || document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);

    try {
      const blob = await new Promise<Blob>((res) =>
        canvas.toBlob((b) => res(b!), 'image/jpeg', 0.92)
      );
      const result = await recognitionApi.recognize(sessionId, blob);

      if (result.attendance_id) {
        const confidence = Math.round((result.confidence_score || 0) * 100);
        const scan = { name: result.student_name!, reg: result.student_reg_number!, confidence, timestamp: new Date() };
        setLastResult({ ...scan, success: true });
        setRecentScans((prev) => [scan, ...prev.filter((p) => p.reg !== scan.reg)].slice(0, 5));
        toast.success(`✓ ${result.student_name} — ${confidence}% match`);
        loadSessionData();
      } else if (result.message === 'Attendance already marked') {
        setLastResult({ name: result.student_name || 'Student', reg: '', confidence: Math.round((result.confidence_score || 0) * 100), success: true });
      } else {
        setLastResult(null);
      }
    } catch {
      setLastResult(null);
    } finally {
      // Cooldown before next scan
      setInCooldown(true);
      setTimeout(() => {
        setInCooldown(false);
        isScanningRef.current = false;
        setIsScanning(false);
        lockFramesRef.current = 0;
      }, COOLDOWN_MS);
    }
  }, [sessionId]);

  // Automated detection loop
  useEffect(() => {
    if (!isWebcamActive || !modelsLoaded) return;

    detectionLoopRef.current = setInterval(async () => {
      if (isScanningRef.current) return; // busy

      const video = videoRef.current;
      const overlay = overlayCanvasRef.current;
      if (!video || !overlay || video.readyState < 2) return;

      overlay.width = video.videoWidth;
      overlay.height = video.videoHeight;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      const detection = await faceapi.detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
      );

      if (!detection) {
        setFaceDetected(false);
        lockFramesRef.current = 0;
        return;
      }

      setFaceDetected(true);
      const { box } = detection;
      const isGood =
        box.width > overlay.width * 0.12 &&
        box.height > overlay.height * 0.12 &&
        box.x > overlay.width * 0.05 &&
        box.x + box.width < overlay.width * 0.95;

      // Draw bounding box
      ctx.strokeStyle = isGood ? '#22c55e' : '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.width, box.height);
      ctx.stroke();

      // Corner accents
      const cs = 14;
      ctx.lineWidth = 3.5;
      ctx.shadowBlur = 0;
      ([[box.x, box.y, cs, cs], [box.x + box.width, box.y, -cs, cs],
        [box.x, box.y + box.height, cs, -cs], [box.x + box.width, box.y + box.height, -cs, -cs]] as [number,number,number,number][]
      ).forEach(([cx, cy, dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(cx + dx, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + dy);
        ctx.stroke();
      });

      if (isGood) {
        lockFramesRef.current += 1;
        // Lock progress bar
        const progress = Math.min(lockFramesRef.current / LOCK_FRAMES, 1);
        ctx.fillStyle = 'rgba(34,197,94,0.2)';
        ctx.fillRect(box.x, box.y + box.height + 4, box.width * progress, 4);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1;
        ctx.strokeRect(box.x, box.y + box.height + 4, box.width, 4);

        if (lockFramesRef.current >= LOCK_FRAMES) {
          runRecognition();
        }
      } else {
        lockFramesRef.current = Math.max(0, lockFramesRef.current - 2);
      }
    }, DETECTION_INTERVAL_MS);

    return () => { if (detectionLoopRef.current) clearInterval(detectionLoopRef.current); };
  }, [isWebcamActive, modelsLoaded, runRecognition]);

  // Fullscreen keyboard and change event listeners
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        setIsFullscreen(false);
      }
      if (
        (e.key === 'f' || e.key === 'F') &&
        isWebcamActive &&
        !isManualModalOpen &&
        !correctingRecord &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        toggleFullscreen();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, isWebcamActive, isManualModalOpen, correctingRecord, toggleFullscreen]);

  const loadSessionData = async () => {
    if (!sessionId) return;
    try {
      setIsLoading(true);
      const [sess, records] = await Promise.all([
        sessionsApi.getById(sessionId),
        attendanceApi.getBySession(sessionId),
      ]);
      setSession(sess);
      setAttendanceRecords(records);

      if (sess.class_id) {
        const [cls, students] = await Promise.all([
          classesApi.getById(sess.class_id),
          classesApi.getStudents(sess.class_id),
        ]);
        setClassroom(cls);
        setEnrolledStudents(students);
      }
    } catch (err) {
      toast.error('Failed to load session details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessionData();
  }, [sessionId]);



  const handleManualMark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !selectedStudentForManual) return;
    try {
      setIsSubmitting(true);
      await attendanceApi.mark({
        session_id: sessionId,
        student_id: selectedStudentForManual,
      });
      toast.success('Attendance marked manually');
      setIsManualModalOpen(false);
      setSelectedStudentForManual('');
      loadSessionData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to mark attendance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCorrectAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingRecord || !newStudentIdForCorrection) return;
    try {
      setIsSubmitting(true);
      await attendanceApi.correct(correctingRecord.id, newStudentIdForCorrection);
      toast.success('Attendance record corrected');
      setCorrectingRecord(null);
      setNewStudentIdForCorrection('');
      loadSessionData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to correct record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAttendance = async (id: string) => {
    try {
      await attendanceApi.delete(id);
      toast.success('Attendance record deleted');
      loadSessionData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete record');
    }
  };

  const handleDownloadCSV = () => {
    if (sessionId) {
      reportsApi.downloadSessionReport(sessionId);
    }
  };

  // Map attendance record by student ID
  const markedStudentIds = new Set(attendanceRecords.map((r) => r.student_id));

  return (
    <div className="space-y-8">
      {/* Session Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/sessions"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-950 text-indigo-400 font-mono text-xs font-bold border border-indigo-800/50">
                {classroom?.course_code}
              </span>
              <h1 className="text-2xl font-bold text-slate-100">{session?.topic || 'Class Session'}</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {classroom?.course_name} • {session && new Date(session.session_date).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-colors"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <span>Export Session CSV</span>
          </button>
          {session?.is_active && (
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-lg shadow-indigo-600/30"
            >
              <UserCheck className="w-4 h-4" />
              <span>Mark Manually</span>
            </button>
          )}
        </div>
      </div>

      {/* AI Auto-Scan Attendance Panel / Fullscreen View */}
      {session?.is_active && (
        <div
          ref={containerRef}
          className={
            isFullscreen
              ? 'fixed inset-0 z-50 bg-slate-950/98 backdrop-blur-3xl flex flex-col justify-between p-4 md:p-6 select-none overflow-hidden transition-all duration-300'
              : 'bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 transition-all'
          }
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
                <ScanFace className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-100 text-base">
                    {isFullscreen ? session.topic || 'Class Attendance Kiosk' : 'Auto Face Recognition'}
                  </h3>
                  {classroom && (
                    <span className="px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-400 font-mono text-[11px] font-bold border border-indigo-800/50">
                      {classroom.course_code}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {isWebcamActive
                    ? isFullscreen
                      ? 'Continuous high-accuracy face verification active. Step in front of the camera.'
                      : 'Camera is live — faces detected automatically'
                    : 'Start the camera to begin continuous face scanning'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isWebcamActive && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-medium animate-pulse">
                  <Circle className="w-2 h-2 fill-rose-400" />
                  LIVE
                </span>
              )}

              {/* Roster Live Stat Badge */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-slate-300">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  <strong className="text-emerald-400">{attendanceRecords.length}</strong> / {enrolledStudents.length} Present
                </span>
                {enrolledStudents.length > 0 && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    ({Math.round((attendanceRecords.length / enrolledStudents.length) * 100)}%)
                  </span>
                )}
              </div>

              {!modelsLoaded && (
                <span className="text-[11px] text-amber-400 animate-pulse">Loading AI…</span>
              )}

              {/* Fullscreen Toggle Button */}
              {isWebcamActive && (
                <button
                  onClick={toggleFullscreen}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isFullscreen
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 shadow-lg shadow-indigo-600/10'
                  }`}
                  title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Enter Full Screen (F)'}
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="w-4 h-4 text-indigo-400" />
                      <span>Exit Full Screen</span>
                      <kbd className="hidden md:inline px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-400">Esc</kbd>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-4 h-4 text-indigo-400" />
                      <span>Full Screen</span>
                      <kbd className="hidden md:inline px-1 py-0.5 bg-indigo-950/80 border border-indigo-800 rounded text-[10px] text-indigo-300">F</kbd>
                    </>
                  )}
                </button>
              )}

              {!isWebcamActive ? (
                <button
                  onClick={startCamera}
                  disabled={!modelsLoaded}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  Start Camera
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all"
                >
                  Stop Camera
                </button>
              )}
            </div>
          </div>

          {/* Body Section */}
          {isFullscreen ? (
            /* FULL SCREEN KIOSK BODY */
            <div className="flex-1 flex flex-col items-center justify-between min-h-0 w-full gap-4 my-auto">
              {/* Centered Camera Stage */}
              <div className="relative flex-1 w-full flex items-center justify-center min-h-0">
                <div className="relative h-full max-h-[72vh] aspect-video rounded-3xl overflow-hidden shadow-2xl border-2 border-slate-800/80 bg-black flex items-center justify-center">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover block"
                    style={{
                      display: isWebcamActive ? 'block' : 'none',
                      transform: 'scaleX(-1)',
                    }}
                  />
                  <canvas
                    ref={overlayCanvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ transform: 'scaleX(-1)', display: isWebcamActive ? 'block' : 'none' }}
                  />
                  <canvas ref={captureCanvasRef} className="hidden" />

                  {/* Status Overlay Pill in Video */}
                  <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none">
                    <div className={`px-4 py-1.5 rounded-full backdrop-blur-md border text-xs font-semibold shadow-xl transition-all ${
                      inCooldown
                        ? 'bg-indigo-950/80 border-indigo-800 text-indigo-300'
                        : isScanning
                        ? 'bg-amber-950/80 border-amber-800 text-amber-300 animate-pulse'
                        : faceDetected
                        ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                        : 'bg-slate-900/80 border-slate-700 text-slate-300'
                    }`}>
                      {inCooldown ? `⏳ Next scan in ${(COOLDOWN_MS / 1000).toFixed(1)}s…` :
                       isScanning ? '⚡ Verifying face biometric…' :
                       faceDetected ? '🎯 Face locked — identifying student…' :
                       '👁️ Look at the camera to check in'}
                    </div>
                  </div>

                  {/* Pop-up Student Recognition Success Banner */}
                  {lastResult?.success && inCooldown && (
                    <div className="absolute bottom-6 inset-x-6 mx-auto max-w-md bg-slate-950/95 border-2 border-emerald-500/60 rounded-2xl p-4 shadow-2xl backdrop-blur-xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/20">
                        <ShieldCheck className="w-7 h-7" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white text-base truncate">{lastResult.name}</p>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-semibold border border-emerald-500/30 shrink-0">
                            {lastResult.confidence}% match
                          </span>
                        </div>
                        {lastResult.reg && (
                          <p className="text-xs font-mono text-emerald-400 font-medium mt-0.5">{lastResult.reg}</p>
                        )}
                        <p className="text-[11px] text-emerald-300/80 mt-1 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Attendance Verified & Recorded
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Fullscreen Footer: Recent Attendees Ticker & Actions */}
              <div className="w-full max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                {/* Recent attendees */}
                <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto py-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    Recent Check-ins:
                  </span>
                  {recentScans.length === 0 ? (
                    <span className="text-xs text-slate-500 italic">No scans recorded yet</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      {recentScans.map((scan, i) => (
                        <div
                          key={scan.reg + i}
                          className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 shrink-0 animate-in fade-in"
                        >
                          <div className="w-5 h-5 rounded-md bg-emerald-950 text-emerald-400 font-bold flex items-center justify-center text-[10px] border border-emerald-800/50">
                            {scan.name.charAt(0)}
                          </div>
                          <span className="font-medium text-slate-200">{scan.name.split(' ')[0]}</span>
                          <span className="text-[10px] text-emerald-400 font-semibold">{scan.confidence}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-3 ml-auto shrink-0">
                  <button
                    onClick={() => setIsManualModalOpen(true)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-colors"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Mark Manually</span>
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Minimize View</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* STANDARD INLINE VIEW */
            <div className="grid grid-cols-1 md:grid-cols-5 gap-5 items-stretch">
              {/* Camera viewport — takes 3 cols */}
              <div className="md:col-span-3 relative bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-center" style={{ minHeight: 280 }}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full block"
                  style={{ maxHeight: 380, objectFit: 'cover', display: isWebcamActive ? 'block' : 'none', transform: 'scaleX(-1)' }}
                />
                <canvas
                  ref={overlayCanvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ transform: 'scaleX(-1)', display: isWebcamActive ? 'block' : 'none' }}
                />
                <canvas ref={captureCanvasRef} className="hidden" />

                {!isWebcamActive && (
                  <div className="flex flex-col items-center justify-center h-72 gap-3">
                    <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-dashed border-slate-700 flex items-center justify-center">
                      <Camera className="w-9 h-9 text-slate-600" />
                    </div>
                    <p className="text-xs text-slate-500">Camera inactive — click Start Camera</p>
                  </div>
                )}

                {/* Status overlay */}
                {isWebcamActive && (
                  <>
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      <button
                        onClick={toggleFullscreen}
                        className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white backdrop-blur-md transition-all shadow-lg"
                        title="Expand to Full Screen (F)"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="absolute bottom-0 inset-x-0 p-2.5 bg-gradient-to-t from-slate-950/90 to-transparent">
                      <p className={`text-center text-[11px] font-medium ${
                        inCooldown ? 'text-indigo-400' :
                        isScanning ? 'text-amber-400 animate-pulse' :
                        faceDetected ? 'text-emerald-400' : 'text-slate-400'
                      }`}>
                        {inCooldown ? `Next scan in ${(COOLDOWN_MS / 1000).toFixed(1)}s…` :
                         isScanning ? 'Identifying face…' :
                         faceDetected ? 'Face locked — identifying…' :
                         'Waiting for face…'}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Status panel — takes 2 cols */}
              <div className="md:col-span-2 flex flex-col gap-4">
                {/* How it works */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">How it works</p>
                  <div className="space-y-2">
                    {[
                      { icon: '①', label: 'Start Camera or enter Full Screen', active: isWebcamActive },
                      { icon: '②', label: 'Student enters camera view', active: isWebcamActive && faceDetected },
                      { icon: '③', label: 'Face auto-locks (hold ~1s)', active: isWebcamActive && faceDetected && !inCooldown },
                      { icon: '④', label: 'Attendance marked automatically', active: !!lastResult?.success },
                    ].map((step) => (
                      <div key={step.label} className={`flex items-center gap-2.5 text-[11px] ${step.active ? 'text-emerald-400' : 'text-slate-500'}`}>
                        <span className="font-mono font-bold">{step.icon}</span>
                        <span>{step.label}</span>
                        {step.active && <CheckCircle2 className="w-3 h-3 ml-auto shrink-0" />}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Last recognition result */}
                <div className={`flex-1 rounded-2xl border p-4 flex flex-col justify-center items-center text-center gap-2 transition-all ${
                  lastResult?.success
                    ? 'bg-emerald-500/5 border-emerald-500/30'
                    : 'bg-slate-950 border-slate-800'
                }`}>
                  {lastResult?.success ? (
                    <>
                      <ShieldCheck className="w-8 h-8 text-emerald-400" />
                      <p className="text-emerald-400 font-bold text-sm">{lastResult.name}</p>
                      {lastResult.reg && <p className="text-emerald-300/70 text-[10px] font-mono">{lastResult.reg}</p>}
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30">
                        {lastResult.confidence}% match
                      </span>
                    </>
                  ) : isScanning ? (
                    <>
                      <ScanFace className="w-8 h-8 text-amber-400 animate-pulse" />
                      <p className="text-amber-400 text-xs font-medium">Scanning…</p>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-7 h-7 text-slate-600" />
                      <p className="text-slate-500 text-[11px]">No match yet</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Roster & Attendance Status Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4 p-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="font-bold text-slate-100 text-base">Class Roster & Attendance Status</h3>
            <p className="text-xs text-slate-400">
              {attendanceRecords.length} / {enrolledStudents.length} Students Present
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3.5">Student</th>
                <th className="px-6 py-3.5">Reg Number</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5">Confidence / Method</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500">
                    Loading attendance roster...
                  </td>
                </tr>
              ) : enrolledStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500">
                    No enrolled students in this class roster.
                  </td>
                </tr>
              ) : (
                enrolledStudents.map((student) => {
                  const record = attendanceRecords.find((r) => r.student_id === student.id);
                  const isPresent = !!record;

                  return (
                    <tr key={student.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-950 text-indigo-400 font-bold flex items-center justify-center border border-indigo-800/40">
                            {student.name.charAt(0)}
                          </div>
                          <p className="font-semibold text-slate-200">{student.name}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-indigo-400 font-semibold">{student.reg_number}</td>
                      <td className="px-6 py-4 text-center">
                        {isPresent ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/50 font-semibold text-[10px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Present
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/50 font-medium text-[10px]">
                            <XCircle className="w-3.5 h-3.5 text-slate-500" /> Absent
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-300 font-mono text-[11px]">
                        {record ? (
                          record.confidence_score ? (
                            <span className="text-emerald-400 font-semibold">
                              {Math.round(record.confidence_score * 100)}% Match (AI)
                            </span>
                          ) : (
                            <span className="text-amber-400">Manual / Corrected</span>
                          )
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {record && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setCorrectingRecord(record);
                                setNewStudentIdForCorrection(record.student_id);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                              title="Reassign record"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAttendance(record.id)}
                              className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40"
                              title="Delete record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Attendance Modal */}
      <Modal isOpen={isManualModalOpen} onClose={() => setIsManualModalOpen(false)} title="Mark Manual Attendance">
        <form onSubmit={handleManualMark} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Select Student *</label>
            <select
              value={selectedStudentForManual}
              onChange={(e) => setSelectedStudentForManual(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              required
            >
              <option value="" disabled>
                Select un-marked student...
              </option>
              {enrolledStudents
                .filter((s) => !markedStudentIds.has(s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.reg_number} - {s.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsManualModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedStudentForManual}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? 'Marking...' : 'Mark Present'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Correct Attendance Modal */}
      <Modal isOpen={!!correctingRecord} onClose={() => setCorrectingRecord(null)} title="Correct Attendance Assignment">
        <form onSubmit={handleCorrectAttendance} className="space-y-4">
          <p className="text-xs text-slate-400">Reassign this attendance record to a different student:</p>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Target Student *</label>
            <select
              value={newStudentIdForCorrection}
              onChange={(e) => setNewStudentIdForCorrection(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              required
            >
              {enrolledStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.reg_number} - {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCorrectingRecord(null)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? 'Correcting...' : 'Update Record'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
