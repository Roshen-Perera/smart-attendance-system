import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Calendar, Edit2, Trash2, Users } from 'lucide-react';
import { classesApi, lecturersApi } from '../api/endpoints';
import type { ClassCourse, Lecturer, ClassCreate } from '../types';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export const ClassesPage: React.FC = () => {
  const { user } = useAuthStore();
  const [classes, setClasses] = useState<ClassCourse[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassCourse | null>(null);
  const [deletingClass, setDeletingClass] = useState<ClassCourse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [lecturerId, setLecturerId] = useState('');
  const [scheduleInfo, setScheduleInfo] = useState('');

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [classesData, lecturersData] = await Promise.all([
        classesApi.getAll(0, 100),
        lecturersApi.getAll(0, 100),
      ]);
      setClasses(classesData);
      setLecturers(lecturersData);
    } catch (err) {
      toast.error('Failed to load courses');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setCourseCode('');
    setCourseName('');
    setLecturerId(lecturers[0]?.id || '');
    setScheduleInfo('');
    setIsCreateOpen(true);
  };

  const openEditModal = (c: ClassCourse) => {
    setEditingClass(c);
    setCourseCode(c.course_code);
    setCourseName(c.course_name);
    setLecturerId(c.lecturer_id);
    setScheduleInfo(c.schedule_info || '');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode || !courseName || !lecturerId) {
      toast.error('Course Code, Course Name, and Lecturer are required');
      return;
    }
    try {
      setIsSubmitting(true);
      const payload: ClassCreate = {
        course_code: courseCode,
        course_name: courseName,
        lecturer_id: lecturerId,
        schedule_info: scheduleInfo || undefined,
      };
      await classesApi.create(payload);
      toast.success('Class created successfully!');
      setIsCreateOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create class');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    try {
      setIsSubmitting(true);
      await classesApi.update(editingClass.id, {
        course_code: courseCode,
        course_name: courseName,
        lecturer_id: lecturerId,
        schedule_info: scheduleInfo || undefined,
      });
      toast.success('Class updated!');
      setEditingClass(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update class');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingClass) return;
    try {
      setIsSubmitting(true);
      await classesApi.delete(deletingClass.id);
      toast.success('Class deleted');
      setDeletingClass(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete class');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Course Classes</h1>
          <p className="text-xs text-slate-400">Configure academic modules, assign lecturers, and enroll students</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Course Class</span>
        </button>
      </div>

      {/* Class Cards Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading course classes...</div>
      ) : classes.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">No course classes configured yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((c) => {
            const lecturer = lecturers.find((l) => l.id === c.lecturer_id);
            return (
              <div
                key={c.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition-all space-y-5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-lg bg-indigo-950/80 text-indigo-400 font-mono text-xs font-bold border border-indigo-800/50">
                      {c.course_code}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(c)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {user?.role === 'admin' && (
                        <button
                          onClick={() => setDeletingClass(c)}
                          className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-100 text-base">{c.course_name}</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Lecturer: <span className="text-slate-200 font-medium">{lecturer?.name || 'Unassigned'}</span>
                    </p>
                  </div>

                  {c.schedule_info && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{c.schedule_info}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center gap-3">
                  <Link
                    to={`/classes/${c.id}/enroll`}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700/50"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Manage Roster</span>
                  </Link>
                  <Link
                    to={`/sessions?class_id=${c.id}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold transition-colors border border-indigo-500/30"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Sessions</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Course Class">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Course Code *</label>
              <input
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="CS3040"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Course Name *</label>
              <input
                type="text"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="Machine Learning"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Assigned Lecturer *</label>
            <select
              value={lecturerId}
              onChange={(e) => setLecturerId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              required
            >
              <option value="" disabled>
                Select a lecturer...
              </option>
              {lecturers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Schedule Info</label>
            <input
              type="text"
              value={scheduleInfo}
              onChange={(e) => setScheduleInfo(e.target.value)}
              placeholder="Mondays 09:00 AM - 11:00 AM (Lab 02)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
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
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Course Class'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editingClass} onClose={() => setEditingClass(null)} title="Edit Course Class">
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Course Code *</label>
              <input
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Course Name *</label>
              <input
                type="text"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Assigned Lecturer *</label>
            <select
              value={lecturerId}
              onChange={(e) => setLecturerId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              required
            >
              {lecturers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Schedule Info</label>
            <input
              type="text"
              value={scheduleInfo}
              onChange={(e) => setScheduleInfo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setEditingClass(null)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingClass}
        onClose={() => setDeletingClass(null)}
        onConfirm={handleDelete}
        title="Delete Course Class"
        message={`Are you sure you want to delete ${deletingClass?.course_code} - ${deletingClass?.course_name}? All associated enrollments and session records will be deleted.`}
        isLoading={isSubmitting}
      />
    </div>
  );
};
