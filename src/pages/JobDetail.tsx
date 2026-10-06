import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Sliders,
  RefreshCw,
  Archive,
  Layers
} from 'lucide-react';
import { getJob } from '../api';
import { MatchingJob } from '../types';

interface JobDetailProps {
  jobId: string;
  onNavigate: (path: string) => void;
}

export const JobDetailPage: React.FC<JobDetailProps> = ({ jobId, onNavigate }) => {
  const [job, setJob] = useState<MatchingJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getJob(jobId);
        setJob(data);
      } catch (e) {
        console.error('Failed to load job details:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [jobId]);

  if (loading || !job) {
    return (
      <div className="py-24 text-center">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-3" />
        <p className="text-xs text-slate-500 font-medium">Loading job details...</p>
      </div>
    );
  }

  const handleNextStep = () => {
    if (job.status === 'COMPLETED') onNavigate(`/jobs/${job.id}/results`);
    else if (job.status === 'PROCESSING') onNavigate(`/jobs/${job.id}/processing`);
    else if (job.status === 'CONFIGURED') onNavigate(`/jobs/${job.id}/rules`);
    else onNavigate(`/jobs/${job.id}/mapping`);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <button
        onClick={() => onNavigate('/dashboard')}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </button>

      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <span className="text-[11px] font-mono text-slate-400">{job.id}</span>
          <h1 className="text-2xl font-bold text-slate-900">{job.name}</h1>
          <p className="text-xs text-slate-500 mt-0.5">Created on {new Date(job.created_at).toLocaleString()}</p>
        </div>

        <button
          onClick={handleNextStep}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 shadow-sm"
        >
          <span>
            {job.status === 'COMPLETED'
              ? 'View Results'
              : job.status === 'PROCESSING'
              ? 'View Processing'
              : 'Continue Setup'}
          </span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-2 font-bold text-xs text-slate-700 uppercase tracking-wider">
            <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
            File A (Primary Dataset)
          </div>
          <div className="font-semibold text-sm text-slate-900">{job.file_a?.original_name || 'N/A'}</div>
          <div className="text-xs text-slate-500 mt-1">
            {job.file_a?.row_count?.toLocaleString()} rows · {job.file_a?.columns?.length} columns
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-2 font-bold text-xs text-slate-700 uppercase tracking-wider">
            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
            File B (Reference Dataset)
          </div>
          <div className="font-semibold text-sm text-slate-900">{job.file_b?.original_name || 'N/A'}</div>
          <div className="text-xs text-slate-500 mt-1">
            {job.file_b?.row_count?.toLocaleString()} rows · {job.file_b?.columns?.length} columns
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Configured Weights & Thresholds</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-400">Company Weight:</span>
            <div className="font-bold text-slate-800 text-sm">{job.config?.weights?.company_name || 30}%</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-400">Domain Weight:</span>
            <div className="font-bold text-slate-800 text-sm">{job.config?.weights?.domain || 25}%</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-400">Address Weight:</span>
            <div className="font-bold text-slate-800 text-sm">{job.config?.weights?.address || 20}%</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-400">Email Weight:</span>
            <div className="font-bold text-slate-800 text-sm">{job.config?.weights?.email || 10}%</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-400">Phone Weight:</span>
            <div className="font-bold text-slate-800 text-sm">{job.config?.weights?.phone || 10}%</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-400">Pincode Weight:</span>
            <div className="font-bold text-slate-800 text-sm">{job.config?.weights?.pincode || 5}%</div>
          </div>
        </div>
      </div>
    </div>
  );
};
