import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Calendar, Lock, Play, ArrowRight, Trash2, Edit2 } from 'lucide-react';
import { sessionsApi, classesApi } from '../api/endpoints';
import { Session, ClassCourse, SessionCreate } from '../types';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import toast from 'react-hot-toast';

export const SessionsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const filterClassId = searchParams.get('class_id') || '';

  const [sessions, setSessions] = useState<Session[]>([]);
  const [classes, setClasses] = useState<ClassCourse[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(filterClassId);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletingSession, setDeletingSession] = useState<Session | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form inputs
  const [classId, setClassId] = useState(filterClassId);
  const [sessionDate, setSessionDate] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [topic, setTopic] = useState('');

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [sessionsData, classesData] = await Promise.all([
        sessionsApi.getAll(selectedClassId || undefined, 0, 100),
        classesApi.getAll(0, 100),
      ]);
      setSessions(sessionsData);
      setClasses(classesData);
    } catch (err) {
      toast.error('Failed to load attendance sessions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClassId]);

  const openCreateModal = () => {
    setClassId(selectedClassId || (classes[0]?.id || ''));
    setSessionDate(new Date().toISOString().slice(0, 16));
    setTopic('');
    setIsCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId || !sessionDate) {
      toast.error('Class and Date/Time are required');
      return;
    }
    try {
      setIsSubmitting(true);
      const payload: SessionCreate = {
        class_id: classId,
        session_date: new Date(sessionDate).toISOString(),
        topic: topic || undefined,
        is_active: true,
      };
      await sessionsApi.create(payload);
      toast.success('Attendance session launched!');
      setIsCreateOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to start session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await sessionsApi.close(id);
      toast.success('Session closed');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to close session');
    }
  };

  const handleDelete = async () => {
    if (!deletingSession) return;
    try {
      setIsSubmitting(true);
      await sessionsApi.delete(deletingSession.id);
      toast.success('Session deleted');
      setDeletingSession(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete session');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Attendance Sessions</h1>
          <p className="text-xs text-slate-400">Launch live sessions for facial recognition or manual marking</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Launch New Session</span>
        </button>
      </div>

      {/* Class Filter Dropdown */}
      <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-3 rounded-2xl">
        <span className="text-xs text-slate-400 font-medium">Filter by Course Class:</span>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Course Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.course_code} - {c.course_name}
            </option>
          ))}
        </select>
      </div>

      {/* Sessions Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">No attendance sessions found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((s) => {
            const cls = classes.find((c) => c.id === s.class_id);
            return (
              <Link
                key={s.id}
                to={`/sessions/${s.id}`}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition-all space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-950/80 text-indigo-400 font-mono text-xs font-bold border border-indigo-800/50">
                      {cls?.course_code || 'Course'}
                    </span>
                    <div className="flex items-center gap-2">
                      {s.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/50 text-[10px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Live Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50 text-[10px] font-semibold">
                          <Lock className="w-3 h-3" /> Closed
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-100 text-base">{s.topic || 'Class Lecture Session'}</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(s.session_date).toLocaleString([], {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {s.is_active && (
                      <button
                        onClick={(e) => handleCloseSession(s.id, e)}
                        className="px-3 py-1.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/50 text-[11px] font-semibold transition-colors"
                      >
                        Close Session
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeletingSession(s);
                      }}
                      className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="flex items-center gap-1 text-xs font-semibold text-indigo-400 group-hover:text-indigo-300">
                    Open Session <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Launch Attendance Session">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Select Course Class *</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              required
            >
              <option value="" disabled>
                Choose class...
              </option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.course_code} - {c.course_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Session Topic / Notes</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Lecture 04: Neural Networks"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Date & Time *</label>
            <input
              type="datetime-local"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? 'Launching...' : 'Launch Live Session'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingSession}
        onClose={() => setDeletingSession(null)}
        onConfirm={handleDelete}
        title="Delete Session"
        message="Are you sure you want to delete this session and all marked attendance records?"
        isLoading={isSubmitting}
      />
    </div>
  );
};
