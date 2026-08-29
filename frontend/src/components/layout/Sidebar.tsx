import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  BarChart3,
  FileCheck,
  Camera,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, role: 'all' },
    { name: 'Students', path: '/students', icon: GraduationCap, role: 'all' },
    { name: 'Lecturers', path: '/lecturers', icon: Users, role: 'admin' },
    { name: 'Classes', path: '/classes', icon: BookOpen, role: 'all' },
    { name: 'Sessions', path: '/sessions', icon: Calendar, role: 'all' },
    { name: 'Eligibility', path: '/eligibility', icon: FileCheck, role: 'all' },
    { name: 'Reports', path: '/reports', icon: BarChart3, role: 'all' },
  ];

  const filteredNav = navItems.filter(
    (item) => item.role === 'all' || (item.role === 'admin' && user?.role === 'admin')
  );

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0 z-30">
      {/* Brand Logo */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Camera className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-slate-100 text-sm tracking-wide">SmartAttendance</h1>
          <p className="text-[10px] text-indigo-400 font-medium tracking-wider uppercase">AI Recognition Portal</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Main Menu
        </div>
        {filteredNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl mb-2 bg-slate-800/40 border border-slate-700/40">
          <div className="w-8 h-8 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-800/50">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{user?.full_name}</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] text-slate-400 capitalize font-medium">{user?.role}</span>
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-xl border border-rose-900/30 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
