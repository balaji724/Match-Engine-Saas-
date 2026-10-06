import React from 'react';
import { Layers, PlusCircle, LayoutDashboard, Sliders, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate }) => {
  const isDashboard = currentPath === '/' || currentPath === '/dashboard';
  const isNewJob = currentPath.startsWith('/jobs/new');
  const isSettings = currentPath === '/settings';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <button
            onClick={() => onNavigate('/dashboard')}
            className="flex items-center gap-2.5 text-left group transition-transform active:scale-[0.98]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                MatchEngine
              </span>
              <span className="ml-1 text-xs font-semibold text-indigo-600">SaaS</span>
              <div className="text-[10px] text-slate-400 font-medium leading-none">
                Enterprise Entity Resolution
              </div>
            </div>
          </button>

          {/* Nav Items */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => onNavigate('/dashboard')}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                isDashboard
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </button>
            <button
              onClick={() => onNavigate('/jobs/new')}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                isNewJob
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <PlusCircle className="h-4 w-4" />
              New Matching Job
            </button>
            <button
              onClick={() => onNavigate('/settings')}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                isSettings
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Sliders className="h-4 w-4" />
              Engine Settings
            </button>
          </nav>
        </div>

        {/* Right Info & CTA */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-md">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-medium text-slate-700">V1 Direct Dashboard</span>
            <span className="text-slate-300">·</span>
            <span>No Auth Required</span>
          </div>

          <button
            onClick={() => onNavigate('/jobs/new')}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-medium px-3.5 py-2 rounded-md shadow-sm transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Job</span>
          </button>
        </div>
      </div>
    </header>
  );
};
