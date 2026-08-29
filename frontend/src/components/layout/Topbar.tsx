import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { ShieldCheck, User as UserIcon } from 'lucide-react';

interface TopbarProps {
  title?: string;
}

export const Topbar: React.FC<TopbarProps> = ({ title = 'Dashboard' }) => {
  const { user } = useAuthStore();

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h2 className="text-lg font-bold text-slate-100 tracking-tight">{title}</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-medium capitalize">{user?.role} Access</span>
        </div>

        <div className="flex items-center gap-2 pl-2">
          <div className="w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-semibold text-xs">
            <UserIcon className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium text-slate-200">{user?.full_name}</span>
        </div>
      </div>
    </header>
  );
};
