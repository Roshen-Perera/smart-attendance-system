import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, UserPlus, Search } from 'lucide-react';
import { classesApi, studentsApi, enrollmentsApi } from '../api/endpoints';
import type { ClassCourse, Student, Enrollment } from '../types';
import { Modal } from '../components/ui/Modal';
import toast from 'react-hot-toast';

export const EnrollmentsPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();

  const [classDetail, setClassDetail] = useState<ClassCourse | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allEnrollments, setAllEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    if (!classId) return;
    try {
      setIsLoading(true);
      const [cls, studentsInClass, studentsList, enrollmentsList] = await Promise.all([
        classesApi.getById(classId),
        classesApi.getStudents(classId),
        studentsApi.getAll(0, 100),
        enrollmentsApi.getAll(0, 100),
      ]);
      setClassDetail(cls);
      setEnrolledStudents(studentsInClass);
      setAllStudents(studentsList);
      setAllEnrollments(enrollmentsList);
    } catch (err) {
      toast.error('Failed to load class roster data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [classId]);

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId || !selectedStudentId) {
      toast.error('Please select a student');
      return;
    }
    try {
      setIsSubmitting(true);
      await enrollmentsApi.create({
        class_id: classId,
        student_id: selectedStudentId,
      });
      toast.success('Student enrolled successfully!');
      setIsEnrollModalOpen(false);
      setSelectedStudentId('');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to enroll student');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnenroll = async (studentId: string) => {
    const enrollment = allEnrollments.find(
      (e) => e.class_id === classId && e.student_id === studentId
    );
    if (!enrollment) {
      toast.error('Enrollment record not found');
      return;
    }
    try {
      await enrollmentsApi.delete(enrollment.id);
      toast.success('Student removed from course roster');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to remove student');
    }
  };

  // Filter available non-enrolled students
  const enrolledStudentIds = new Set(enrolledStudents.map((s) => s.id));
  const availableStudents = allStudents.filter((s) => !enrolledStudentIds.has(s.id));

  const filteredEnrolled = enrolledStudents.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.reg_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/classes"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Course Roster Enrollment</h1>
            <p className="text-xs text-indigo-400 font-mono">
              {classDetail ? `${classDetail.course_code} - ${classDetail.course_name}` : 'Loading...'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsEnrollModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>Enroll Student</span>
        </button>
      </div>

      {/* Roster Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter roster by student name or reg number..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
        />
      </div>

      {/* Enrolled Students Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3.5">Student Name</th>
                <th className="px-6 py-3.5">Reg Number</th>
                <th className="px-6 py-3.5">Programme</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-500">
                    Loading course roster...
                  </td>
                </tr>
              ) : filteredEnrolled.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-500">
                    No students currently enrolled in this class.
                  </td>
                </tr>
              ) : (
                filteredEnrolled.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-950 text-indigo-400 font-bold flex items-center justify-center border border-indigo-800/40">
                          {s.name.charAt(0)}
                        </div>
                        <p className="font-semibold text-slate-200">{s.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-indigo-400 font-semibold">{s.reg_number}</td>
                    <td className="px-6 py-4 text-slate-300">{s.programme || 'N/A'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleUnenroll(s.id)}
                        className="px-3 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-[11px] font-semibold transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enroll Student Modal */}
      <Modal isOpen={isEnrollModalOpen} onClose={() => setIsEnrollModalOpen(false)} title="Enroll Student into Course">
        <form onSubmit={handleEnroll} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Select Student *</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              required
            >
              <option value="" disabled>
                Choose from unenrolled students ({availableStudents.length})...
              </option>
              {availableStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.reg_number} - {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsEnrollModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedStudentId}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? 'Enrolling...' : 'Confirm Enrollment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
