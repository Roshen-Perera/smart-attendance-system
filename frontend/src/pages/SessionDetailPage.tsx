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
  Sparkles,
  Maximize2,
  Minimize2,
  Radio,
  Users,
  Scan,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { FilesetResolver, FaceDetector as MPFaceDetector } from '@mediapipe/tasks-vision';
import {
  sessionsApi,
  classesApi,
  attendanceApi,
  recognitionApi,
  reportsApi,
} from '../api/endpoints';
import type { Session, ClassCourse, Student, AttendanceRecord, MultiFaceInfo } from '../types';
import { Modal } from '../components/ui/Modal';
import toast from 'react-hot-toast';

interface TrackedFace {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  studentName?: string;
  regNumber?: string;
  confidence?: number;
  isVerified?: boolean;
}

export const SessionDetailPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();

  const [session, setSession] = useState<Session | null>(null);
  const [classroom, setClassroom] = useState<ClassCourse | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // AI Recognition & Camera state
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isAutoScan, setIsAutoScan] = useState(true); // Default to ON for automatic attendance
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [detectedFaceCount, setDetectedFaceCount] = useState(0);
  const [isDetectorReady, setIsDetectorReady] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [scanStats, setScanStats] = useState<{ totalScans: number; newlyMarked: number }>({ totalScans: 0, newlyMarked: 0 });
  const [recentVerifications, setRecentVerifications] = useState<Array<{ name: string; reg: string; time: string; confidence: number }>>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const autoScanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isScanningRef = useRef(false);
  const recentDetectionsRef = useRef<Map<string, number>>(new Map()); // student reg -> last marked timestamp
  const faceDetectorRef = useRef<MPFaceDetector | null>(null);
  const trackedFacesRef = useRef<TrackedFace[]>([]);
  const recognizedFacesMapRef = useRef<Map<number, { name: string; reg: string; conf: number }>>(new Map());

  // Manual & Correction modal state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedStudentForManual, setSelectedStudentForManual] = useState('');
  const [correctingRecord, setCorrectingRecord] = useState<AttendanceRecord | null>(null);
  const [newStudentIdForCorrection, setNewStudentIdForCorrection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadSessionData = useCallback(async (silent = false) => {
    if (!sessionId) return;
    try {
      if (!silent) setIsLoading(true);
      const [sess, records] = await Promise.all([
        sessionsApi.getById(sessionId),
        attendanceApi.getBySession(sessionId),
      ]);
      setSession(sess);
      setAttendanceRecords(records);

      if (sess.class_id && (!classroom || !silent)) {
        const [cls, students] = await Promise.all([
          classesApi.getById(sess.class_id),
          classesApi.getStudents(sess.class_id),
        ]);
        setClassroom(cls);
        setEnrolledStudents(students);
      }
    } catch (err) {
      if (!silent) toast.error('Failed to load session details');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [sessionId, classroom]);

  useEffect(() => {
    loadSessionData();
  }, [sessionId]);

  // ─── Initialize MediaPipe FaceDetector ──────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const initDetector = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );
        if (!isMounted) return;
        const detector = await MPFaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.45,
        });
        if (!isMounted) return;
        faceDetectorRef.current = detector;
        setIsDetectorReady(true);
      } catch (e) {
        console.warn('MediaPipe initialization fallback to backend-driven tracking:', e);
        setIsDetectorReady(true);
      }
    };
    initDetector();
    return () => { isMounted = false; };
  }, []);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (autoScanIntervalRef.current) clearInterval(autoScanIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // ─── Real-time Canvas Face Tracking Overlay (60 FPS Render Loop) ─────────────
  const renderTrackingOverlay = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !video || !video.videoWidth || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(renderTrackingOverlay);
      return;
    }

    const dispW = video.clientWidth;
    const dispH = video.clientHeight;
    if (canvas.width !== dispW || canvas.height !== dispH) {
      canvas.width = dispW;
      canvas.height = dispH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      animFrameRef.current = requestAnimationFrame(renderTrackingOverlay);
      return;
    }

    // Run MediaPipe detection if detector is ready
    if (faceDetectorRef.current && video.currentTime > 0) {
      try {
        const detections = faceDetectorRef.current.detectForVideo(video, performance.now());
        if (detections && detections.detections) {
          const scaleX = dispW / video.videoWidth;
          const scaleY = dispH / video.videoHeight;

          const newTracked: TrackedFace[] = detections.detections.map((det, index) => {
            const bb = det.boundingBox;
            if (!bb) return { id: index + 1, x: 0, y: 0, w: 0, h: 0 };
            const faceX = bb.originX * scaleX;
            const faceY = bb.originY * scaleY;
            const faceW = bb.width * scaleX;
            const faceH = bb.height * scaleY;

            const recInfo = recognizedFacesMapRef.current.get(index);

            return {
              id: index + 1,
              x: faceX,
              y: faceY,
              w: faceW,
              h: faceH,
              studentName: recInfo?.name,
              regNumber: recInfo?.reg,
              confidence: recInfo?.conf,
              isVerified: !!recInfo,
            };
          });

          trackedFacesRef.current = newTracked;
          setDetectedFaceCount(newTracked.length);
        }
      } catch (_) {
        // detection frame pass
      }
    }

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw high-tech dynamic bounding box for EACH tracked face
    const faces = trackedFacesRef.current;
    faces.forEach((face) => {
      const { x, y, w, h, isVerified, studentName, regNumber, confidence, id } = face;
      if (w <= 0 || h <= 0) return;

      const primaryColor = isVerified ? '#10b981' : '#06b6d4'; // emerald if verified, electric cyan if tracking
      const glowColor = isVerified ? 'rgba(16, 185, 129, 0.4)' : 'rgba(6, 182, 212, 0.3)';

      // 1. Subtle glowing bounding box
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 10;
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;

      // 2. Futuristic Corner Brackets (surveillance style)
      const cornerLen = Math.min(20, w * 0.25, h * 0.25);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = isVerified ? '#34d399' : '#38bdf8';

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLen);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerLen, y);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(x + w - cornerLen, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + cornerLen);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(x, y + h - cornerLen);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + cornerLen, y + h);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(x + w - cornerLen, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w, y + h - cornerLen);
      ctx.stroke();

      // 3. Floating HUD Badge above face box
      const badgeText = isVerified
        ? `✓ ${studentName || 'Verified'} (${regNumber || ''}) • ${confidence || 95}%`
        : `● Face #${id} · Tracking`;

      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      const textMetrics = ctx.measureText(badgeText);
      const badgeW = textMetrics.width + 16;
      const badgeH = 22;
      const badgeX = Math.max(4, Math.min(x, canvas.width - badgeW - 4));
      const badgeY = Math.max(badgeH + 4, y - 6);

      // Badge background
      ctx.fillStyle = isVerified ? 'rgba(6, 78, 59, 0.92)' : 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = isVerified ? '#059669' : '#0284c7';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY - badgeH, badgeW, badgeH, 6);
      ctx.fill();
      ctx.stroke();

      // Badge text
      ctx.fillStyle = isVerified ? '#a7f3d0' : '#e0f2fe';
      ctx.fillText(badgeText, badgeX + 8, badgeY - 7);
    });

    animFrameRef.current = requestAnimationFrame(renderTrackingOverlay);
  }, []);

  // Start / stop render loop
  useEffect(() => {
    if (isWebcamActive) {
      animFrameRef.current = requestAnimationFrame(renderTrackingOverlay);
    } else {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isWebcamActive, renderTrackingOverlay]);

  // ─── Webcam Start / Stop ───────────────────────────────────────────────────
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsWebcamActive(true);
      setIsAutoScan(true); // Automatically enable auto attendance
      setScanStats({ totalScans: 0, newlyMarked: 0 });
      recognizedFacesMapRef.current.clear();
      trackedFacesRef.current = [];
    } catch {
      toast.error('Camera access denied or webcam unavailable');
    }
  };

  const stopWebcam = () => {
    if (autoScanIntervalRef.current) {
      clearInterval(autoScanIntervalRef.current);
      autoScanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsWebcamActive(false);
    setDetectedFaceCount(0);
    trackedFacesRef.current = [];
    recognizedFacesMapRef.current.clear();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().catch((e) => toast.error(`Fullscreen error: ${e.message}`));
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // ─── Capture Full Frame Blob ───────────────────────────────────────────────
  const captureCurrentFrameBlob = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video || !video.videoWidth || video.readyState < 2) return resolve(null);
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.drawImage(video, 0, 0);
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
    });
  };

  // ─── Multi-Face Backend Recognition Handler ─────────────────────────────────
  const processMultiFaceRecognition = useCallback(async (isAuto = true) => {
    if (!sessionId || !isWebcamActive || isScanningRef.current) return;

    isScanningRef.current = true;
    if (!isAuto) setIsRecognizing(true);

    try {
      const blob = await captureCurrentFrameBlob();
      if (!blob) return;

      const res = await recognitionApi.recognizeMulti(sessionId, blob);
      setScanStats((s) => ({ ...s, totalScans: s.totalScans + 1 }));

      if (res && res.faces && res.faces.length > 0) {
        let newMarkedInBatch = 0;
        const now = Date.now();

        res.faces.forEach((faceInfo: MultiFaceInfo, idx: number) => {
          if (faceInfo.student_name && faceInfo.student_reg_number) {
            const conf = Math.round((faceInfo.confidence_score || 0) * 100);
            const reg = faceInfo.student_reg_number;

            // Map face index to student info for overlay tags
            recognizedFacesMapRef.current.set(idx, {
              name: faceInfo.student_name,
              reg: reg,
              conf: conf,
            });

            // Check if newly marked or already marked
            if (faceInfo.status === 'newly_marked') {
              newMarkedInBatch += 1;
              const lastSeen = recentDetectionsRef.current.get(reg) || 0;
              if (now - lastSeen > 8000) {
                recentDetectionsRef.current.set(reg, now);
                toast.success(`✅ Attendance Marked: ${faceInfo.student_name} (${reg}) • ${conf}% match`, {
                  duration: 3500,
                  icon: '🎓',
                });
                setRecentVerifications((prev) => [
                  {
                    name: faceInfo.student_name!,
                    reg: reg,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    confidence: conf,
                  },
                  ...prev.slice(0, 5),
                ]);
              }
            } else if (faceInfo.status === 'already_marked') {
              const lastSeen = recentDetectionsRef.current.get(reg) || 0;
              if (now - lastSeen > 12000 && !isAuto) {
                recentDetectionsRef.current.set(reg, now);
                toast(`ℹ️ ${faceInfo.student_name} already marked present`, { icon: '✓' });
              }
            }
          }
        });

        if (newMarkedInBatch > 0) {
          setScanStats((s) => ({ ...s, newlyMarked: s.newlyMarked + newMarkedInBatch }));
          loadSessionData(true);
        }
      } else if (!isAuto) {
        toast.error('No faces recognized in the frame');
      }
    } catch (err: any) {
      if (!isAuto) toast.error(err.response?.data?.detail || 'Recognition failed');
    } finally {
      isScanningRef.current = false;
      if (!isAuto) setIsRecognizing(false);
    }
  }, [sessionId, isWebcamActive, loadSessionData]);

  // ─── Automatic Attendance Scan Interval (Every 1.8s) ────────────────────────
  useEffect(() => {
    if (isAutoScan && isWebcamActive) {
      autoScanIntervalRef.current = setInterval(() => {
        processMultiFaceRecognition(true);
      }, 1800);
    } else {
      if (autoScanIntervalRef.current) {
        clearInterval(autoScanIntervalRef.current);
        autoScanIntervalRef.current = null;
      }
    }
    return () => {
      if (autoScanIntervalRef.current) clearInterval(autoScanIntervalRef.current);
    };
  }, [isAutoScan, isWebcamActive, processMultiFaceRecognition]);

  const handleManualScan = () => processMultiFaceRecognition(false);

  const handleFileUploadRecognize = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !sessionId) return;
    const file = e.target.files[0];
    try {
      const res = await recognitionApi.recognizeMulti(sessionId, file);
      if (res && res.recognized_count > 0) {
        toast.success(`Recognized & processed ${res.recognized_count} student face(s)!`);
        loadSessionData(true);
      } else {
        toast.error(res.message || 'No matching student faces recognized');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Recognition failed');
    }
  };

  const handleManualMark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !selectedStudentForManual) return;
    try {
      setIsSubmitting(true);
      await attendanceApi.mark({ session_id: sessionId, student_id: selectedStudentForManual });
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
    if (sessionId) reportsApi.downloadSessionReport(sessionId);
  };

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

      {/* AI Live Face Recognition Panel */}
      {session?.is_active && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
          {/* Panel Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-900/30">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-100 text-base">AI Live Multi-Face Attendance</h3>
                  {isWebcamActive && (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 text-[10px] font-semibold border border-cyan-800/60 shadow-sm">
                      <Users className="w-3 h-3" />
                      {detectedFaceCount} {detectedFaceCount === 1 ? 'face' : 'faces'} tracked
                    </span>
                  )}
                  {isWebcamActive && isAutoScan && (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Auto-Marking Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Real-time multi-face tracking & automatic attendance detection for all visible students
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {isWebcamActive && (
                <>
                  <button
                    onClick={() => setIsAutoScan((prev) => !prev)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                      isAutoScan
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-lg shadow-emerald-950/50'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <Radio className={`w-3.5 h-3.5 ${isAutoScan ? 'text-emerald-400 animate-pulse' : ''}`} />
                    <span>{isAutoScan ? 'Auto-Attendance: ON' : 'Auto-Attendance: OFF'}</span>
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </>
              )}

              {!isWebcamActive ? (
                <button
                  onClick={startWebcam}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Start Live Attendance</span>
                </button>
              ) : (
                <button
                  onClick={stopWebcam}
                  className="px-3.5 py-2 bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all"
                >
                  Stop Camera
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
            {/* ── Camera Viewport ── */}
            <div
              ref={videoContainerRef}
              className={`relative bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex items-center justify-center md:col-span-3 transition-all ${
                isFullscreen
                  ? 'w-screen h-screen rounded-none border-none bg-black'
                  : 'h-96'
              }`}
            >
              {/* Live video stream */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${!isWebcamActive ? 'hidden' : ''}`}
              />

              {/* Canvas overlay for face tracking boxes */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ display: isWebcamActive ? 'block' : 'none' }}
              />

              {/* Camera inactive placeholder */}
              {!isWebcamActive && (
                <div className="text-center space-y-3 p-8 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-400">Live Camera Stream Inactive</p>
                    <p className="text-xs text-slate-600 mt-1">Start camera to automatically detect and mark students</p>
                  </div>
                  <button
                    onClick={startWebcam}
                    className="mt-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg"
                  >
                    Start Live Attendance
                  </button>
                </div>
              )}

              {/* Active camera HUD overlays */}
              {isWebcamActive && (
                <>
                  {/* Top status bar */}
                  <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950/85 backdrop-blur-md border border-slate-800/80 text-[11px] text-slate-300 font-medium flex items-center gap-1.5 shadow-lg">
                      <span className={`w-2 h-2 rounded-full ${isAutoScan ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                      {isAutoScan ? `Auto-Marking Active ${detectedFaceCount > 0 ? `• ${detectedFaceCount} faces tracked` : ''}` : 'Manual Trigger Mode'}
                    </span>
                    <div className="flex items-center gap-2 pointer-events-auto">
                      {scanStats.newlyMarked > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-950/90 backdrop-blur-md border border-emerald-500/40 text-[11px] text-emerald-300 font-medium shadow-lg flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          {scanStats.newlyMarked} marked in this session
                        </span>
                      )}
                      <button
                        onClick={toggleFullscreen}
                        className="p-2 rounded-lg bg-slate-950/80 hover:bg-slate-900 backdrop-blur-md border border-slate-800/80 text-slate-300 shadow-lg transition-colors"
                      >
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* No faces hint */}
                  {detectedFaceCount === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="px-4 py-2 rounded-xl bg-slate-950/75 backdrop-blur-sm border border-slate-700/50 text-slate-400 text-xs font-medium flex items-center gap-2">
                        <Scan className="w-4 h-4 text-cyan-400 animate-pulse" />
                        <span>Point camera at students — auto-detecting faces</span>
                      </div>
                    </div>
                  )}

                  {/* Bottom controls */}
                  <div className="absolute bottom-4 inset-x-4 flex items-center justify-center gap-3">
                    <button
                      onClick={handleManualScan}
                      disabled={isScanningRef.current}
                      className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-75 text-slate-950 font-bold text-xs rounded-full shadow-2xl flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                    >
                      {isRecognizing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      <span>
                        {detectedFaceCount > 1
                          ? `Scan All ${detectedFaceCount} Faces Now`
                          : 'Scan & Mark Attendance'}
                      </span>
                    </button>

                    {isFullscreen && (
                      <button
                        onClick={toggleFullscreen}
                        className="px-4 py-2.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-semibold text-xs rounded-full backdrop-blur-md border border-slate-700 shadow-xl transition-all"
                      >
                        Exit Fullscreen
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ── Side Panel: Recent Verifications + Upload ── */}
            <div className="md:col-span-2 flex flex-col gap-4">
              {/* Recent Verifications feed */}
              {isWebcamActive && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex-1 space-y-3 min-h-36">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Live Verification Feed</p>
                    <span className="text-[10px] text-emerald-400 font-mono">Real-time</span>
                  </div>
                  {recentVerifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-slate-600 space-y-1">
                      <Camera className="w-6 h-6" />
                      <p className="text-xs">Recognized students will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentVerifications.map((v, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-emerald-900/30 gap-2 shadow-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-lg bg-emerald-950 flex items-center justify-center flex-shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-200 truncate">{v.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono">{v.reg}</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[10px] text-emerald-400 font-semibold">{v.confidence}% match</p>
                            <p className="text-[10px] text-slate-500 font-mono">{v.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* File Upload fallback */}
              <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 text-center space-y-3 bg-slate-950/40 relative flex flex-col items-center justify-center transition-colors min-h-40">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUploadRecognize}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="w-10 h-10 rounded-2xl bg-indigo-950/60 border border-indigo-800/50 flex items-center justify-center text-indigo-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-slate-200 font-semibold">Upload Photo for AI Verify</p>
                  <p className="text-[10px] text-slate-400">Drag or click to upload a student snapshot</p>
                </div>
                <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-300">
                  Browse File
                </span>
              </div>
            </div>
          </div>
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
              <option value="" disabled>Select un-marked student...</option>
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
