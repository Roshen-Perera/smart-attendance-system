import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  Cpu,
  CheckCircle2,
  Trash2,
  Camera,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Check,
} from 'lucide-react';
import { facesApi } from '../api/endpoints';
import type { FaceImage, FaceEmbedding } from '../types';
import toast from 'react-hot-toast';

export const StudentFacePage: React.FC = () => {
  const { regNumber } = useParams<{ regNumber: string }>();
  const decodedRegNumber = regNumber ? decodeURIComponent(regNumber) : '';

  const [activeTab, setActiveTab] = useState<'upload' | 'camera'>('upload');

  const [images, setImages] = useState<FaceImage[]>([]);
  const [embeddings, setEmbeddings] = useState<FaceEmbedding[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Live Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const loadStudentData = async () => {
    if (!decodedRegNumber) return;
    try {
      const [faceImages, faceEmbeddings] = await Promise.all([
        facesApi.getImages(decodedRegNumber),
        facesApi.getEmbeddings(decodedRegNumber),
      ]);
      setImages(faceImages);
      setEmbeddings(faceEmbeddings);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load face biometric data');
    }
  };

  useEffect(() => {
    loadStudentData();
  }, [decodedRegNumber]);

  // Clean up webcam stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // When switching tabs away from camera, stop the stream
  const handleTabChange = (tab: 'upload' | 'camera') => {
    if (tab !== 'camera') {
      stopCamera();
    }
    setActiveTab(tab);
  };

  const startCamera = async () => {
    try {
      setCapturedBlob(null);
      setCapturedPreview(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err) {
      toast.error('Camera access denied or webcam unavailable');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error('Failed to capture snapshot');
          return;
        }
        setCapturedBlob(blob);
        setCapturedPreview(URL.createObjectURL(blob));
        stopCamera();
      },
      'image/jpeg',
      0.95
    );
  };

  const handleRetakePhoto = () => {
    setCapturedBlob(null);
    setCapturedPreview(null);
    startCamera();
  };

  const handleSaveCapturedPhoto = async () => {
    if (!capturedBlob || !decodedRegNumber) return;
    try {
      setIsUploading(true);
      await facesApi.upload(decodedRegNumber, capturedBlob);
      toast.success('Face photo captured and registered successfully!');
      setCapturedBlob(null);
      setCapturedPreview(null);
      loadStudentData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to upload captured face photo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !decodedRegNumber) {
      toast.error('Please select an image file first');
      return;
    }
    try {
      setIsUploading(true);
      await facesApi.upload(decodedRegNumber, selectedFile);
      toast.success('Face image uploaded successfully!');
      setSelectedFile(null);
      setPreviewUrl(null);
      loadStudentData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to upload face image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateEmbedding = async () => {
    if (!decodedRegNumber) return;
    try {
      setIsGenerating(true);
      await facesApi.generateEmbedding(decodedRegNumber);
      toast.success('AI 512-d face vector embedding generated successfully!');
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
      toast.success('Embedding vector removed');
      loadStudentData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete embedding');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Top Header */}
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload / Live Camera Face Photo Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100 text-sm">Add Face Biometric Photo</h3>
                <p className="text-[11px] text-slate-400">Front-facing clear portrait photo</p>
              </div>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="flex p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => handleTabChange('upload')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'upload'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Photo</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('camera')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'camera'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Live Webcam</span>
            </button>
          </div>

          {/* Tab 1: File Upload Mode */}
          {activeTab === 'upload' && (
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
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-32 h-32 object-cover rounded-xl mx-auto border-2 border-indigo-500 shadow-lg"
                    />
                    <p className="text-xs text-emerald-400 font-medium">{selectedFile?.name}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 text-slate-500 mx-auto" />
                    <p className="text-xs text-slate-300 font-medium">Click or drag image file here</p>
                    <p className="text-[10px] text-slate-500">Max size: 5MB (JPG or PNG)</p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!selectedFile || isUploading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs py-2.5 rounded-xl transition-all disabled:opacity-50"
              >
                {isUploading ? 'Validating Face & Uploading...' : 'Upload Face Photo'}
              </button>
            </form>
          )}

          {/* Tab 2: Live Webcam Capture Mode */}
          {activeTab === 'camera' && (
            <div className="space-y-4">
              <div className="relative bg-slate-950 border border-slate-800 rounded-2xl h-56 overflow-hidden flex items-center justify-center">
                {/* Live Stream View */}
                {isCameraActive && !capturedPreview && (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {/* Reticle Guide */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-36 h-44 rounded-2xl border-2 border-dashed border-emerald-400/60 flex items-center justify-center">
                        <span className="text-[10px] text-emerald-300/80 bg-slate-950/70 px-2 py-0.5 rounded-md backdrop-blur">
                          Align Face Here
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {/* Captured Photo Preview */}
                {capturedPreview && (
                  <div className="relative w-full h-full flex items-center justify-center bg-black">
                    <img
                      src={capturedPreview}
                      alt="Captured Face"
                      className="max-h-full max-w-full object-contain rounded-xl"
                    />
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Captured
                      </span>
                    </div>
                  </div>
                )}

                {/* Inactive Standby State */}
                {!isCameraActive && !capturedPreview && (
                  <div className="text-center space-y-2 text-slate-500 p-4">
                    <Camera className="w-8 h-8 mx-auto stroke-[1.5] text-slate-600" />
                    <p className="text-xs text-slate-400">Webcam inactive</p>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition-all shadow-lg shadow-emerald-900/30"
                    >
                      Start Camera
                    </button>
                  </div>
                )}
              </div>

              {/* Camera Actions */}
              {isCameraActive && !capturedPreview && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCapturePhoto}
                    className="flex-[2] py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Capture Snapshot</span>
                  </button>
                </div>
              )}

              {/* Snapshot confirmation actions */}
              {capturedPreview && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleRetakePhoto}
                    disabled={isUploading}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retake</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCapturedPhoto}
                    disabled={isUploading}
                    className="flex-[2] py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isUploading ? (
                      'Saving & Validating...'
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Save Face Biometric</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI Vector Embedding Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30 flex items-center justify-center">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100 text-sm">AI Embedding Matrix</h3>
                <p className="text-[11px] text-slate-400">512-dimensional ArcFace deep facial representation</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Face Images Uploaded:</span>
                <span
                  className={
                    images.length > 0
                      ? 'text-emerald-400 font-semibold flex items-center gap-1'
                      : 'text-amber-400 font-semibold'
                  }
                >
                  {images.length > 0 ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> {images.length} {images.length === 1 ? 'Photo' : 'Photos'}
                    </>
                  ) : (
                    'No Photos'
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">AI Vector Generated:</span>
                <span
                  className={
                    embeddings.length > 0
                      ? 'text-emerald-400 font-semibold flex items-center gap-1'
                      : 'text-rose-400 font-semibold'
                  }
                >
                  {embeddings.length > 0 ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" /> Ready (512-d)
                    </>
                  ) : (
                    'Pending Embed'
                  )}
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
              {isGenerating ? 'Extracting 512-d Vector...' : 'Generate AI Face Embedding'}
            </button>

            {embeddings.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <p className="text-[11px] font-semibold text-slate-400 uppercase">Existing Vectors</p>
                {embeddings.map((emb) => (
                  <div
                    key={emb.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 text-xs border border-slate-800"
                  >
                    <span className="font-mono text-[10px] text-slate-400">ID: {emb.id.slice(0, 12)}...</span>
                    <button
                      onClick={() => handleDeleteEmbedding(emb.id)}
                      className="text-rose-400 hover:text-rose-300 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gallery of Uploaded Images */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="font-semibold text-slate-100 text-sm border-b border-slate-800 pb-3">
          Registered Face Image Gallery ({images.length})
        </h3>
        {images.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No uploaded face images found for this student.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {images.map((img) => (
              <div key={img.id} className="bg-slate-950 border border-slate-800 rounded-xl p-2 space-y-2">
                <img
                  src={`http://localhost:8000/${img.image_path}`}
                  alt="Face"
                  className="w-full h-36 object-cover rounded-lg"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <p className="text-[10px] text-slate-500 font-mono text-center truncate">{img.image_path}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
