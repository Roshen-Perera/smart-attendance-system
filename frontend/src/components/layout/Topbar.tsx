import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Calendar, Clock } from 'lucide-react';

interface TopbarProps {
  title?: string;
}

const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard Overview',
  '/students': 'Student Directory',
  '/lecturers': 'Faculty Directory',
  '/classes': 'Course Classes',
  '/sessions': 'Attendance Sessions',
  '/eligibility': 'Exam Eligibility & Predictive Analytics',
  '/reports': 'Attendance Reports & Analytics',
  '/enrollments': 'Course Enrollments',
};

export const Topbar: React.FC<TopbarProps> = ({ title }) => {
  const location = useLocation();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const computedTitle =
    title ||
    routeTitles[location.pathname] ||
    (location.pathname.startsWith('/sessions/')
      ? 'Live Attendance Session'
      : location.pathname.startsWith('/students/')
      ? 'Student Face Biometrics'
      : 'Smart Attendance System');

  const dateStr = currentDateTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const timeStr = currentDateTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h2 className="text-base font-bold text-slate-100 tracking-tight">{computedTitle}</h2>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 shadow-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-medium text-slate-300">{dateStr}</span>
          </div>
          <span className="w-1 h-1 rounded-full bg-slate-700" />
          <div className="flex items-center gap-2 font-mono">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold text-slate-200 tracking-wide">{timeStr}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
