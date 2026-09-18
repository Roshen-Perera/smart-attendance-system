import React, { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, Calendar, BarChart3, TrendingUp, Users } from 'lucide-react';
import { classesApi, sessionsApi, reportsApi } from '../api/endpoints';
import type { ClassCourse, Session, ClassAnalytics } from '../types';
import toast from 'react-hot-toast';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#10b981', '#f43f5e']; // Emerald for eligible, Rose for not eligible

export const ReportsPage: React.FC = () => {
  const [classes, setClasses] = useState<ClassCourse[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [isExportingClass, setIsExportingClass] = useState(false);
  const [isExportingSession, setIsExportingSession] = useState(false);

  const [analyticsData, setAnalyticsData] = useState<ClassAnalytics | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Fetch initial classes and sessions
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

  // Fetch analytics whenever selected class changes
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!selectedClassId) return;
      try {
        setIsLoadingAnalytics(true);
        const data = await reportsApi.getClassAnalytics(selectedClassId);
        setAnalyticsData(data);
      } catch (err) {
        console.error('Failed to fetch analytics', err);
        toast.error('Could not load class analytics');
      } finally {
        setIsLoadingAnalytics(false);
      }
    };
    fetchAnalytics();
  }, [selectedClassId]);

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

  const pieData = analyticsData ? [
    { name: 'Eligible (>=80%)', value: analyticsData.eligibility.eligible },
    { name: 'Not Eligible', value: analyticsData.eligibility.not_eligible },
  ] : [];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Reports & Analytics</h1>
        <p className="text-xs text-slate-400">Generate reports and visualize class attendance trends.</p>
      </div>

      {/* Main Class Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-100 text-lg">Class Analytics Dashboard</h3>
            <p className="text-xs text-slate-400 mt-1">Select a class to view its attendance trends and overall statistics.</p>
          </div>
          <div className="w-full md:w-72">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full bg-slate-950 border border-indigo-500/30 rounded-xl px-3.5 py-2.5 text-sm text-indigo-100 focus:outline-none focus:border-indigo-500 font-semibold shadow-lg shadow-indigo-900/20"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.course_code} - {c.course_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Analytics Visualizations */}
      {isLoadingAnalytics ? (
        <div className="h-64 flex items-center justify-center bg-slate-900/50 rounded-3xl border border-slate-800">
          <div className="animate-pulse text-indigo-400 flex items-center gap-2 font-medium">
            <BarChart3 className="w-5 h-5 animate-bounce" />
            Loading Analytics...
          </div>
        </div>
      ) : analyticsData ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Summary Stats */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Total Enrolled</p>
                <p className="text-2xl font-bold text-slate-100">{analyticsData.total_students} Students</p>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Avg. Attendance</p>
                <p className="text-2xl font-bold text-slate-100">{analyticsData.overall_attendance_percentage}%</p>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Total Sessions</p>
                <p className="text-2xl font-bold text-slate-100">{analyticsData.total_sessions}</p>
              </div>
            </div>
          </div>

          {/* Line Chart: Attendance Trends */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 h-96 flex flex-col">
            <h3 className="font-semibold text-slate-200 mb-6">Attendance Trend over Sessions</h3>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analyticsData.trends} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis 
                    dataKey="session_date" 
                    stroke="#475569" 
                    fontSize={10} 
                    tickFormatter={(val) => new Date(val).toLocaleDateString([], { month: 'short', day: 'numeric' })} 
                  />
                  <YAxis stroke="#475569" fontSize={10} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                    itemStyle={{ color: '#818cf8', fontWeight: 500 }}
                    labelStyle={{ color: '#94a3b8', fontSize: '12px' }}
                    formatter={(value: any) => [`${value} Students`, 'Attended']}
                    labelFormatter={(label: any) => new Date(label).toLocaleDateString()}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="attended" 
                    stroke="#6366f1" 
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#0f172a' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart: Eligibility */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 h-96 flex flex-col">
            <h3 className="font-semibold text-slate-200 mb-2">Exam Eligibility Breakdown</h3>
            <p className="text-xs text-slate-400 mb-4">Students requiring &gt;=80% attendance.</p>
            <div className="flex-1 min-h-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                    itemStyle={{ color: '#e2e8f0', fontWeight: 500 }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                <div className="text-center">
                  <p className="text-3xl font-bold text-slate-100">{analyticsData.total_students}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500">Total</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      ) : null}

      <div className="border-t border-slate-800/60 pt-8 mt-8">
        <h2 className="text-xl font-bold text-slate-200 mb-6">Data Exports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Full Class Attendance Matrix CSV */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-6 flex flex-col justify-between">
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
            </div>

            <button
              onClick={handleExportClassCSV}
              disabled={!selectedClassId || isExportingClass}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs py-3 rounded-xl border border-slate-700 transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isExportingClass ? 'Generating CSV...' : 'Download Semester Matrix CSV'}</span>
            </button>
          </div>

          {/* Single Session CSV */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-6 flex flex-col justify-between">
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
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs py-3 rounded-xl border border-slate-700 transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isExportingSession ? 'Generating CSV...' : 'Download Session CSV'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
