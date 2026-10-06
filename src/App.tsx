import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { NewJob } from './pages/NewJob';
import { ColumnMappingPage } from './pages/ColumnMapping';
import { MatchingRulesPage } from './pages/MatchingRules';
import { ProcessingPage } from './pages/Processing';
import { ResultsPage } from './pages/Results';
import { SettingsPage } from './pages/Settings';
import { JobDetailPage } from './pages/JobDetail';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const p = window.location.pathname;
    return p === '/' ? '/dashboard' : p;
  });

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    // If root '/', automatically redirect to '/dashboard'
    if (window.location.pathname === '/') {
      window.history.replaceState({}, '', '/dashboard');
      setCurrentPath('/dashboard');
    }

    const handlePopState = () => {
      const p = window.location.pathname;
      setCurrentPath(p === '/' ? '/dashboard' : p);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Router Parser
  const renderRoute = () => {
    // 1. /dashboard or /
    if (currentPath === '/dashboard' || currentPath === '/') {
      return <Dashboard onNavigate={navigate} />;
    }

    // 2. /jobs/new
    if (currentPath === '/jobs/new') {
      return <NewJob onNavigate={navigate} />;
    }

    // 3. /settings
    if (currentPath === '/settings') {
      return <SettingsPage />;
    }

    // Dynamic routes: /jobs/:id/...
    const jobMappingMatch = currentPath.match(/^\/jobs\/([^/]+)\/mapping$/);
    if (jobMappingMatch) {
      return <ColumnMappingPage jobId={jobMappingMatch[1]} onNavigate={navigate} />;
    }

    const jobRulesMatch = currentPath.match(/^\/jobs\/([^/]+)\/rules$/);
    if (jobRulesMatch) {
      return <MatchingRulesPage jobId={jobRulesMatch[1]} onNavigate={navigate} />;
    }

    const jobProcessingMatch = currentPath.match(/^\/jobs\/([^/]+)\/processing$/);
    if (jobProcessingMatch) {
      return <ProcessingPage jobId={jobProcessingMatch[1]} onNavigate={navigate} />;
    }

    const jobResultsMatch = currentPath.match(/^\/jobs\/([^/]+)\/results$/);
    if (jobResultsMatch) {
      return <ResultsPage jobId={jobResultsMatch[1]} onNavigate={navigate} />;
    }

    const jobDetailMatch = currentPath.match(/^\/jobs\/([^/]+)$/);
    if (jobDetailMatch) {
      return <JobDetailPage jobId={jobDetailMatch[1]} onNavigate={navigate} />;
    }

    // Fallback -> Dashboard
    return <Dashboard onNavigate={navigate} />;
  };

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-900 antialiased selection:bg-indigo-500 selection:text-white">
      <Navbar currentPath={currentPath} onNavigate={navigate} />
      <main className="pb-16">{renderRoute()}</main>
    </div>
  );
}
