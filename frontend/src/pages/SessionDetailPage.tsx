import React, { useEffect, useState, useRef } from 'react';
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
} from 'lucide-react';
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

export const SessionDetailPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();

  const [session, setSession] = useState<Session | null>(null);
  const [classroom, setClassroom] = useState<ClassCourse | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // AI Recognition state
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Manual & Correction modal state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedStudentForManual, setSelectedStudentForManual] = useState('');
  const [correctingRecord, setCorrectingRecord] = useState<AttendanceRecord | null>(null);
  const [newStudentIdForCorrection, setNewStudentIdForCorrection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Webcam stream handlers
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsWebcamActive(true);
    } catch (err) {
      toast.error('Camera access denied or webcam unavailable');
    }
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsWebcamActive(false);
  };

  const captureFrameAndRecognize = async () => {
    if (!videoRef.current || !sessionId) return;
    try {
      setIsRecognizing(true);
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error('Failed to capture camera frame');
          setIsRecognizing(false);
          return;
        }
        try {
          const res = await recognitionApi.recognize(sessionId, blob);
          if (res.attendance_id) {
            toast.success(`Recognized: ${res.student_name} (${res.student_reg_number}) - ${Math.round((res.confidence_score || 0) * 100)}% match!`);
            loadSessionData();
          } else {
            toast.error(res.message || 'Face not recognized');
          }
        } catch (err: any) {
          toast.error(err.response?.data?.detail || 'Recognition failed');
        } finally {
          setIsRecognizing(false);
        }
      }, 'image/jpeg');
    } catch (err) {
      toast.error('Webcam capture error');
      setIsRecognizing(false);
    }
  };

  const handleFileUploadRecognize = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !sessionId) return;
    const file = e.target.files[0];
    try {
      setIsRecognizing(true);
      const res = await recognitionApi.recognize(sessionId, file);
      if (res.attendance_id) {
        toast.success(`Recognized: ${res.student_name} (${res.student_reg_number}) - ${Math.round((res.confidence_score || 0) * 100)}% match!`);
        loadSessionData();
      } else {
        toast.error(res.message || 'Face not recognized');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Recognition failed');
    } finally {
      setIsRecognizing(false);
    }
  };

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

      {/* AI Live Face Recognition Panel */}
      {session?.is_active && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-base">AI Live Face Recognition</h3>
                <p className="text-xs text-slate-400">Capture face via camera or upload snapshot to verify attendance</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!isWebcamActive ? (
                <button
                  onClick={startWebcam}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Start Camera</span>
                </button>
              ) : (
                <button
                  onClick={stopWebcam}
                  className="px-3.5 py-2 bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all"
                >
                  Stop Camera
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Webcam Video viewport */}
            <div className="relative bg-slate-950 border border-slate-800 rounded-2xl h-64 overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover ${!isWebcamActive && 'hidden'}`}
              />

              {!isWebcamActive && (
                <div className="text-center space-y-2 text-slate-500 p-6">
                  <Camera className="w-10 h-10 mx-auto stroke-[1.5]" />
                  <p className="text-xs">Camera stream inactive</p>
                </div>
              )}

              {isWebcamActive && (
                <div className="absolute bottom-4 inset-x-4 flex items-center justify-center">
                  <button
                    onClick={captureFrameAndRecognize}
                    disabled={isRecognizing}
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-full shadow-2xl flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isRecognizing ? 'Recognizing...' : 'Scan & Verify Attendance'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* File Upload Option */}
            <div className="border-2 border-dashed border-slate-800 rounded-2xl p-6 text-center space-y-3 bg-slate-950/40 relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUploadRecognize}
                disabled={isRecognizing}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Sparkles className="w-8 h-8 text-indigo-400 mx-auto" />
              <p className="text-xs text-slate-200 font-semibold">Upload Photo Snapshot for AI Verification</p>
              <p className="text-[10px] text-slate-400">Upload a single photo of a student to mark attendance</p>
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
