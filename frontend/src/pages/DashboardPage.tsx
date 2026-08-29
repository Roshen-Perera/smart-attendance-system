import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  Users,
  BookOpen,
  Calendar,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';
import { studentsApi, lecturersApi, classesApi, sessionsApi, attendanceApi } from '../api/endpoints';
import type { AttendanceRecord } from '../types';
import { useAuthStore } from '../store/authStore';

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    studentsCount: 0,
    lecturersCount: 0,
    classesCount: 0,
    sessionsCount: 0,
    activeSessionsCount: 0,
  });
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        const [students, classes, sessions, attendanceRecords] = await Promise.all([
          studentsApi.getAll(0, 100),
          classesApi.getAll(0, 100),
          sessionsApi.getAll(undefined, 0, 100),
          attendanceApi.getAll(0, 10),
        ]);

        let lecturersCount = 0;
        if (user?.role === 'admin') {
          try {
            const lecturers = await lecturersApi.getAll(0, 100);
            lecturersCount = lecturers.length;
          } catch {
            // non-admin won't have access
          }
        }

        const activeSess = sessions.filter((s) => s.is_active).length;

        setStats({
          studentsCount: students.length,
          lecturersCount,
          classesCount: classes.length,
          sessionsCount: sessions.length,
          activeSessionsCount: activeSess,
        });

        setRecentAttendance(attendanceRecords);
      } catch (err) {
        console.error('Failed to load dashboard stats', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const statCards = [
    {
      title: 'Total Students',
      value: stats.studentsCount,
      icon: GraduationCap,
      color: 'from-blue-600 to-cyan-500',
      path: '/students',
    },
    {
      title: 'Active Classes',
      value: stats.classesCount,
      icon: BookOpen,
      color: 'from-indigo-600 to-violet-500',
      path: '/classes',
    },
    {
      title: 'Total Sessions',
      value: stats.sessionsCount,
      sub: `${stats.activeSessionsCount} active now`,
      icon: Calendar,
      color: 'from-emerald-600 to-teal-500',
      path: '/sessions',
    },
  ];

  if (user?.role === 'admin') {
    statCards.splice(1, 0, {
      title: 'Lecturers',
      value: stats.lecturersCount,
      icon: Users,
      color: 'from-amber-600 to-orange-500',
      path: '/lecturers',
    });
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900/60 via-slate-900 to-slate-900 border border-indigo-500/20 p-8">
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Recognition Active</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Welcome, {user?.full_name}!
          </h1>
          <p className="text-slate-400 text-sm">
            Manage students, set up course sessions, run AI face recognition, and generate instant eligibility reports.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              to={card.path}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all group relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${card.color} flex items-center justify-center shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-600 group-hover:text-slate-300 transition-colors" />
              </div>
              <div className="mt-4 space-y-1">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{card.title}</p>
                <p className="text-3xl font-bold text-slate-100">{isLoading ? '...' : card.value}</p>
                {card.sub && <p className="text-xs text-emerald-400 font-medium">{card.sub}</p>}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Action Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h3 className="font-semibold text-slate-100 text-base">Recent Attendance Activity</h3>
            <Link to="/sessions" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
              View All Sessions →
            </Link>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-slate-500 text-sm">Loading activity...</div>
          ) : recentAttendance.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">No recent attendance records marked yet.</div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {recentAttendance.map((rec) => (
                <div key={rec.id} className="py-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/50 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-200">
                        {rec.student?.name || `Student ID: ${rec.student_id.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-slate-400">
                        {rec.student?.reg_number || 'Marked present'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono text-indigo-400 bg-indigo-950/50 px-2.5 py-1 rounded-md border border-indigo-900/50">
                      {rec.confidence_score ? `${Math.round(rec.confidence_score * 100)}% Match` : 'Manual'}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {new Date(rec.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Tools */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold text-slate-100 text-base border-b border-slate-800 pb-4">
            Quick Actions
          </h3>

          <div className="space-y-3">
            <Link
              to="/sessions"
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/40 text-slate-200 text-xs font-semibold transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <span>Start / Open Session</span>
            </Link>

            <Link
              to="/students"
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/40 text-slate-200 text-xs font-semibold transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-cyan-600/20 text-cyan-400 flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </div>
              <span>Register Student & Face</span>
            </Link>

            <Link
              to="/eligibility"
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/40 text-slate-200 text-xs font-semibold transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                <FileCheck className="w-4 h-4" />
              </div>
              <span>Check 80% Eligibility</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
