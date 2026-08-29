import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Camera, Cpu, CheckCircle2, Trash2, ShieldCheck,
  Upload, Video, Circle, ScanFace, AlertCircle, RefreshCw,
  ZapIcon, Maximize2, Minimize2
} from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';
import { facesApi } from '../api/endpoints';
import type { FaceImage, FaceEmbedding } from '../types';
import toast from 'react-hot-toast';

// Types
type Tab = 'camera' | 'manage';
type CaptureStatus = 'idle' | 'detecting' | 'locking' | 'capturing' | 'uploading' | 'done';

interface CaptureShot {
  blob: Blob;
  dataUrl: string;
  label: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

// Constants
const POSES = ['Front Face', 'Slight Left', 'Slight Right'];
const LOCK_FRAMES_NEEDED = 18;
const DETECTION_INTERVAL_MS = 80;

export const StudentFacePage: React.FC = () => {
  const { regNumber } = useParams<{ regNumber: string }>();
  const decodedRegNumber = regNumber ? decodeURIComponent(regNumber) : '';

  const [activeTab, setActiveTab] = useState<Tab>('camera');

  // Manage tab state
  const [images, setImages] = useState<FaceImage[]>([]);
  const [embeddings, setEmbeddings] = useState<FaceEmbedding[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Camera tab state
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockFramesRef = useRef(0);
  const captureStatusRef = useRef<CaptureStatus>('idle');

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsError, setModelsError] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>('idle');
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const currentPoseIndexRef = useRef(0);
  const [shots, setShots] = useState<CaptureShot[]>([]);
  const [faceDetected, setFaceDetected] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const loadStudentData = useCallback(async () => {
    if (!decodedRegNumber) return;
    try {
      const [faceImages, faceEmbeddings] = await Promise.all([
        facesApi.getImages(decodedRegNumber),
        facesApi.getEmbeddings(decodedRegNumber),
      ]);
      setImages(faceImages);
      setEmbeddings(faceEmbeddings);
    } catch {
      toast.error('Failed to load face biometric data');
    }
  }, [decodedRegNumber]);

  useEffect(() => {
    loadStudentData();
  }, [loadStudentData]);

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        setModelsLoaded(true);
      } catch (err) {
        console.error('Failed to load face-api models:', err);
        setModelsError(true);
      }
    };
    loadModels();
    return () => {
      stopCameraFn();
    };
  }, []);

  const stopCameraFn = () => {
    if (detectionLoopRef.current) clearInterval(detectionLoopRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setCaptureStatus('idle');
    captureStatusRef.current = 'idle';
    setFaceDetected(false);
    lockFramesRef.current = 0;
    const overlay = overlayCanvasRef.current;
    if (overlay) {
      const ctx = overlay.getContext('2d');
      ctx?.clearRect(0, 0, overlay.width, overlay.height);
    }
  };

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
        // Fallback
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
        cameraActive &&
        activeTab === 'camera' &&
        document.activeElement?.tagName !== 'INPUT'
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
  }, [isFullscreen, cameraActive, activeTab, toggleFullscreen]);

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
      setCameraActive(true);
      setCaptureStatus('detecting');
      captureStatusRef.current = 'detecting';
      setCurrentPoseIndex(0);
      currentPoseIndexRef.current = 0;
      setShots([]);
      lockFramesRef.current = 0;
      setAllDone(false);
    } catch {
      toast.error('Camera access denied. Please allow camera permissions.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    stopCameraFn();
  }, []);

  // Capture frame handler
  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    // Flash effect
    const overlay = overlayCanvasRef.current;
    if (overlay) {
      const oc = overlay.getContext('2d');
      if (oc) {
        oc.fillStyle = 'rgba(255,255,255,0.45)';
        oc.fillRect(0, 0, overlay.width, overlay.height);
        setTimeout(() => oc.clearRect(0, 0, overlay.width, overlay.height), 120);
      }
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92)
    );

    const poseIdx = currentPoseIndexRef.current;
    const poseLabel = POSES[poseIdx];
    const newShot: CaptureShot = { blob, dataUrl, label: poseLabel, status: 'uploading' };

    setShots((prev) => [...prev, newShot]);
    setCaptureStatus('uploading');
    captureStatusRef.current = 'uploading';

    try {
      const file = new File([blob], `face_${Date.now()}.jpg`, { type: 'image/jpeg' });
      await facesApi.upload(decodedRegNumber, file);
      await facesApi.generateEmbedding(decodedRegNumber);

      setShots((prev) => prev.map((s, i) => (i === poseIdx ? { ...s, status: 'done' } : s)));
      toast.success(`Pose ${poseIdx + 1}/3 captured & embedded!`);

      const nextIndex = poseIdx + 1;
      if (nextIndex >= POSES.length) {
        stopCameraFn();
        setAllDone(true);
        setCaptureStatus('done');
        captureStatusRef.current = 'done';
        loadStudentData();
      } else {
        setCurrentPoseIndex(nextIndex);
        currentPoseIndexRef.current = nextIndex;
        lockFramesRef.current = 0;
        setCaptureStatus('detecting');
        captureStatusRef.current = 'detecting';
      }
    } catch (err: any) {
      setShots((prev) => prev.map((s, i) => (i === poseIdx ? { ...s, status: 'error' } : s)));
      toast.error(err.response?.data?.detail || 'Upload failed. Try again.');
      lockFramesRef.current = 0;
      setCaptureStatus('detecting');
      captureStatusRef.current = 'detecting';
    }
  }, [decodedRegNumber, loadStudentData]);

  // Detection loop
  useEffect(() => {
    if (!cameraActive || !modelsLoaded) return;

    detectionLoopRef.current = setInterval(async () => {
      const status = captureStatusRef.current;
      if (status === 'uploading' || status === 'capturing' || status === 'done') return;

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
      const isGoodSize = box.width > overlay.width * 0.15 && box.height > overlay.height * 0.15;
      const isCentered =
        box.x > overlay.width * 0.1 &&
        box.x + box.width < overlay.width * 0.9 &&
        box.y > overlay.height * 0.05;
      const isGood = isGoodSize && isCentered;

      // Bounding box
      ctx.strokeStyle = isGood ? '#22c55e' : '#f59e0b';
      ctx.lineWidth = 3;
      ctx.shadowColor = isGood ? '#22c55e' : '#f59e0b';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.width, box.height);
      ctx.stroke();

      // Corner accents
      const cs = 18;
      ctx.lineWidth = 4;
      ctx.shadowBlur = 0;
      const corners: [number, number, number, number][] = [
        [box.x, box.y, cs, cs],
        [box.x + box.width, box.y, -cs, cs],
        [box.x, box.y + box.height, cs, -cs],
        [box.x + box.width, box.y + box.height, -cs, -cs],
      ];
      corners.forEach(([cx, cy, dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(cx + dx, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + dy);
        ctx.stroke();
      });

      if (isGood) {
        lockFramesRef.current += 1;
        const progress = Math.min(lockFramesRef.current / LOCK_FRAMES_NEEDED, 1);
        ctx.fillStyle = 'rgba(34,197,94,0.25)';
        ctx.fillRect(box.x, box.y + box.height + 6, box.width * progress, 5);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1;
        ctx.strokeRect(box.x, box.y + box.height + 6, box.width, 5);

        if (captureStatusRef.current !== 'capturing') {
          setCaptureStatus('locking');
          captureStatusRef.current = 'locking';
        }

        if (lockFramesRef.current >= LOCK_FRAMES_NEEDED && captureStatusRef.current !== 'capturing') {
          captureStatusRef.current = 'capturing';
          setCaptureStatus('capturing');
          captureFrame();
        }
      } else {
        lockFramesRef.current = Math.max(0, lockFramesRef.current - 2);
        if (captureStatusRef.current === 'locking') {
          setCaptureStatus('detecting');
          captureStatusRef.current = 'detecting';
        }
      }
    }, DETECTION_INTERVAL_MS);

    return () => {
      if (detectionLoopRef.current) clearInterval(detectionLoopRef.current);
    };
  }, [cameraActive, modelsLoaded, captureFrame]);

  // Manage tab handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
      setPreviewUrl(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !decodedRegNumber) return toast.error('Please select an image first');
    try {
      setIsUploading(true);
      await facesApi.upload(decodedRegNumber, selectedFile);
      toast.success('Face image uploaded!');
      setSelectedFile(null);
      setPreviewUrl(null);
      loadStudentData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateEmbedding = async () => {
    try {
      setIsGenerating(true);
      await facesApi.generateEmbedding(decodedRegNumber);
      toast.success('AI face vector generated!');
      loadStudentData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to generate embedding');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteEmbedding = async (id: string) => {
    try {
      await facesApi.deleteEmbedding(id);
      toast.success('Embedding removed');
      loadStudentData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Delete failed');
    }
  };

  const getStatusLabel = () => {
    if (!cameraActive) return '';
    if (!faceDetected) return 'No face detected — look at the camera';
    if (captureStatus === 'locking') return 'Hold still… locking on face';
    if (captureStatus === 'capturing') return 'Capturing…';
    if (captureStatus === 'uploading') return 'Uploading & generating embedding…';
    return `Position your face for: ${POSES[currentPoseIndex]}`;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/students"
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Face Biometric Profile</h1>
          <p className="text-xs text-indigo-400 font-mono">Reg Number: {decodedRegNumber}</p>
        </div>
        {embeddings.length > 0 && (
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            {embeddings.length} embedding{embeddings.length > 1 ? 's' : ''} ready
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('camera')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'camera'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          Live Camera Enrollment
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'manage'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          Manage
        </button>
      </div>

      {/* CAMERA TAB */}
      {activeTab === 'camera' && (
        <div className="space-y-5">
          {modelsError && (
            <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Failed to load face detection models. Make sure <code>/public/models/</code> files exist.
            </div>
          )}

          {/* Camera viewport */}
          <div
            ref={containerRef}
            className={
              isFullscreen
                ? 'fixed inset-0 z-50 bg-slate-950/98 backdrop-blur-3xl flex flex-col justify-between p-4 md:p-6 select-none overflow-hidden'
                : 'bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden'
            }
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <ScanFace className="w-4 h-4 text-indigo-400" />
                Face Enrollment Camera {decodedRegNumber && <span className="font-mono text-indigo-400">({decodedRegNumber})</span>}
              </div>
              <div className="flex items-center gap-3">
                {cameraActive && (
                  <span className="flex items-center gap-1.5 text-[11px] text-rose-400 font-medium">
                    <Circle className="w-2 h-2 fill-rose-400 animate-pulse" />
                    LIVE
                  </span>
                )}
                {!modelsLoaded && !modelsError && (
                  <span className="text-[11px] text-amber-400 animate-pulse">Loading AI models…</span>
                )}
                {modelsLoaded && !cameraActive && (
                  <span className="text-[11px] text-emerald-400">AI Ready</span>
                )}
                {cameraActive && (
                  <button
                    onClick={toggleFullscreen}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
                    title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Full Screen (F)'}
                  >
                    {isFullscreen ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5" />
                        <span>Exit Full Screen</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Full Screen</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className={isFullscreen ? "relative flex-1 flex items-center justify-center min-h-0 bg-slate-950 p-4" : "relative bg-slate-950"} style={isFullscreen ? undefined : { minHeight: 360 }}>
              <div className={isFullscreen ? "relative h-full max-h-[75vh] aspect-video rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-black flex items-center justify-center" : "relative w-full"}>
                <video
                  ref={videoRef}
                  className="w-full h-full block"
                  style={{
                    maxHeight: isFullscreen ? undefined : 420,
                    objectFit: 'cover',
                    display: cameraActive ? 'block' : 'none',
                    transform: 'scaleX(-1)',
                  }}
                  playsInline
                  muted
                />
                <canvas
                  ref={overlayCanvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ transform: 'scaleX(-1)', display: cameraActive ? 'block' : 'none' }}
                />
                <canvas ref={canvasRef} className="hidden" />

                {!cameraActive && (
                  <div className="flex flex-col items-center justify-center h-80 gap-4">
                    <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-dashed border-slate-700 flex items-center justify-center">
                      <Camera className="w-10 h-10 text-slate-600" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm text-slate-400 font-medium">Camera is off</p>
                      <p className="text-xs text-slate-600">Start enrollment to begin face capture</p>
                    </div>
                  </div>
                )}

                {cameraActive && (
                  <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-slate-950/90 to-transparent">
                    <p className={`text-center text-xs font-medium ${faceDetected ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {getStatusLabel()}
                    </p>
                  </div>
                )}

                {allDone && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    </div>
                    <p className="text-emerald-400 font-semibold text-sm">Enrollment Complete!</p>
                    <p className="text-slate-400 text-xs">3 face embeddings generated successfully</p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {!cameraActive ? (
                  <button
                    onClick={startCamera}
                    disabled={!modelsLoaded || modelsError}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                  >
                    <Video className="w-4 h-4" />
                    Start Enrollment
                  </button>
                ) : (
                  <button
                    onClick={stopCamera}
                    className="flex items-center gap-2 px-5 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-400 text-xs font-semibold rounded-xl transition-all"
                  >
                    <Circle className="w-3.5 h-3.5 fill-rose-400" />
                    Stop Camera
                  </button>
                )}

                {(allDone || shots.length > 0) && !cameraActive && (
                  <button
                    onClick={() => {
                      setShots([]);
                      setAllDone(false);
                      setCurrentPoseIndex(0);
                      currentPoseIndexRef.current = 0;
                      startCamera();
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Re-enroll
                  </button>
                )}
              </div>

              {isFullscreen && cameraActive && (
                <div className="flex items-center gap-2 text-xs text-indigo-300 font-medium">
                  <span>Current Pose: <strong>{POSES[currentPoseIndex]}</strong> ({currentPoseIndex + 1}/3)</span>
                </div>
              )}
            </div>
          </div>

          {/* Pose progress */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Capture Progress</p>
            <div className="grid grid-cols-3 gap-3">
              {POSES.map((pose, idx) => {
                const shot = shots[idx];
                const isCurrent = cameraActive && idx === currentPoseIndex && !allDone;
                const isDone = shot?.status === 'done';
                const isUp = shot?.status === 'uploading';
                const isError = shot?.status === 'error';

                return (
                  <div
                    key={pose}
                    className={`relative rounded-xl border overflow-hidden transition-all ${
                      isCurrent
                        ? 'border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                        : isDone
                        ? 'border-emerald-500/40'
                        : isError
                        ? 'border-rose-500/40'
                        : 'border-slate-800'
                    }`}
                  >
                    {shot?.dataUrl ? (
                      <img
                        src={shot.dataUrl}
                        alt={pose}
                        className="w-full h-28 object-cover"
                        style={{ transform: 'scaleX(-1)' }}
                      />
                    ) : (
                      <div className={`h-28 flex items-center justify-center ${isCurrent ? 'bg-indigo-950/40' : 'bg-slate-950'}`}>
                        <Camera className={`w-8 h-8 ${isCurrent ? 'text-indigo-400 animate-pulse' : 'text-slate-700'}`} />
                      </div>
                    )}

                    <div
                      className={`absolute top-2 right-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        isDone
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : isUp
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : isCurrent
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                          : isError
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {isDone ? '✓ Done' : isUp ? '⟳ Saving' : isCurrent ? '● Active' : isError ? '✗ Error' : `${idx + 1}`}
                    </div>

                    <div className="px-2 py-1.5 bg-slate-900/80">
                      <p className="text-[10px] font-medium text-slate-400 text-center">{pose}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {cameraActive && !allDone && (
              <div className="mt-4 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-xs text-indigo-300 space-y-1">
                <p className="font-semibold text-indigo-400">Instructions for: {POSES[currentPoseIndex]}</p>
                {currentPoseIndex === 0 && <p>Look directly at the camera. Keep your face centered and still.</p>}
                {currentPoseIndex === 1 && <p>Slowly turn your head slightly to the left. Hold still when the bar fills.</p>}
                {currentPoseIndex === 2 && <p>Slowly turn your head slightly to the right. Hold still when the bar fills.</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MANAGE TAB */}
      {activeTab === 'manage' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100 text-sm">Upload Face Image</h3>
                  <p className="text-[11px] text-slate-400">Clear front-facing portrait (JPG/PNG)</p>
                </div>
              </div>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 text-center transition-all bg-slate-950/40 cursor-pointer relative">
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {previewUrl ? (
                    <div className="space-y-2">
                      <img src={previewUrl} alt="Preview" className="w-32 h-32 object-cover rounded-xl mx-auto border-2 border-indigo-500 shadow-lg" />
                      <p className="text-xs text-emerald-400 font-medium">{selectedFile?.name}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 text-slate-500 mx-auto" />
                      <p className="text-xs text-slate-300 font-medium">Click or drag image here</p>
                      <p className="text-[10px] text-slate-500">Max 5MB — JPG or PNG</p>
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!selectedFile || isUploading}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs py-2.5 rounded-xl transition-all disabled:opacity-50"
                >
                  {isUploading ? 'Validating & Uploading…' : 'Upload Face Photo'}
                </button>
              </form>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30 flex items-center justify-center">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-100 text-sm">AI Embedding Matrix</h3>
                    <p className="text-[11px] text-slate-400">128-dimensional facial vector</p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Face Images:</span>
                    <span className={images.length > 0 ? 'text-emerald-400 font-semibold flex items-center gap-1' : 'text-amber-400 font-semibold'}>
                      {images.length > 0 ? <><CheckCircle2 className="w-3.5 h-3.5" /> {images.length} uploaded</> : 'No photos'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">AI Vectors:</span>
                    <span className={embeddings.length > 0 ? 'text-emerald-400 font-semibold flex items-center gap-1' : 'text-rose-400 font-semibold'}>
                      {embeddings.length > 0 ? <><ShieldCheck className="w-3.5 h-3.5" /> {embeddings.length} ready</> : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <button
                  onClick={handleGenerateEmbedding}
                  disabled={images.length === 0 || isGenerating}
                  className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs py-2.5 rounded-xl transition-all disabled:opacity-50"
                >
                  <ZapIcon className="w-3.5 h-3.5" />
                  {isGenerating ? 'Extracting Vector…' : 'Generate AI Embedding'}
                </button>
                {embeddings.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase">Vectors</p>
                    {embeddings.map((emb) => (
                      <div key={emb.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 text-xs border border-slate-800">
                        <span className="font-mono text-[10px] text-slate-400">ID: {emb.id.slice(0, 14)}…</span>
                        <button onClick={() => handleDeleteEmbedding(emb.id)} className="text-rose-400 hover:text-rose-300 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold text-slate-100 text-sm border-b border-slate-800 pb-3">
              Registered Face Gallery ({images.length})
            </h3>
            {images.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No face images found for this student.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {images.map((img) => (
                  <div key={img.id} className="bg-slate-950 border border-slate-800 rounded-xl p-2 space-y-2">
                    <img
                      src={`http://localhost:8000/${img.image_path}`}
                      alt="Face"
                      className="w-full h-36 object-cover rounded-lg"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                    <p className="text-[10px] text-slate-500 font-mono text-center truncate">{img.image_path.split('/').pop()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
