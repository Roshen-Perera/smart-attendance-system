import React, { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, Calendar, BookOpen, CheckCircle2 } from 'lucide-react';
import { classesApi, sessionsApi, reportsApi } from '../api/endpoints';
import { ClassCourse, Session } from '../types';
import toast from 'react-hot-toast';

export const ReportsPage: React.FC = () => {
  const [classes, setClasses] = useState<ClassCourse[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [isExportingClass, setIsExportingClass] = useState(false);
  const [isExportingSession, setIsExportingSession] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classesData, sessionsData] = await Promise.all([
          classesApi.getAll(0, 100),
          sessionsApi.getAll(undefined, 0, 100),
        ]);
        setClasses(classesData);
        setSessions(sessionsData);
        if (classesData.length > 0) setSelectedClassId(classesData[0].id);
        if (sessionsData.length > 0) setSelectedSessionId(sessionsData[0].id);
      } catch (err) {
        toast.error('Failed to load classes and sessions for reports');
      }
    };
    fetchData();
  }, []);

  const handleExportClassCSV = async () => {
    if (!selectedClassId) return;
    const cls = classes.find((c) => c.id === selectedClassId);
    try {
      setIsExportingClass(true);
      await reportsApi.downloadClassReport(selectedClassId, cls?.course_code || 'class');
      toast.success('Class attendance CSV report downloaded!');
    } catch (err) {
      toast.error('Failed to export class CSV report');
    } finally {
      setIsExportingClass(false);
    }
  };

  const handleExportSessionCSV = async () => {
    if (!selectedSessionId) return;
    try {
      setIsExportingSession(true);
      await reportsApi.downloadSessionReport(selectedSessionId);
      toast.success('Session attendance CSV report downloaded!');
    } catch (err) {
      toast.error('Failed to export session CSV report');
    } finally {
      setIsExportingSession(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Attendance Reports & Exports</h1>
        <p className="text-xs text-slate-400">Generate and export official CSV reports for university administration</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Full Class Attendance Matrix CSV */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-lg">Full Semester Class Matrix</h3>
              <p className="text-xs text-slate-400 mt-1">
                Generates a comprehensive CSV spreadsheet containing every student's attendance across all past sessions, total count, %, and exam eligibility status.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase">Select Course Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.course_code} - {c.course_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleExportClassCSV}
            disabled={!selectedClassId || isExportingClass}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-3 rounded-xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingClass ? 'Generating CSV...' : 'Download Semester Matrix CSV'}</span>
          </button>
        </div>

        {/* Single Session CSV */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-lg">Single Session Roster Report</h3>
              <p className="text-xs text-slate-400 mt-1">
                Exports a detailed CSV list for a specific lecture session, including student registration numbers, timestamps, and AI confidence scores.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase">Select Session</label>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-medium"
              >
                {sessions.map((s) => {
                  const cls = classes.find((c) => c.id === s.class_id);
                  return (
                    <option key={s.id} value={s.id}>
                      {cls?.course_code || 'Class'} - {s.topic || 'Session'} ({new Date(s.session_date).toLocaleDateString()})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <button
            onClick={handleExportSessionCSV}
            disabled={!selectedSessionId || isExportingSession}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-3 rounded-xl shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingSession ? 'Generating CSV...' : 'Download Session CSV'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
