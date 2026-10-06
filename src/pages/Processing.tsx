import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowRight,
  Cpu,
  Layers,
  Sparkles,
  FileCheck
} from 'lucide-react';
import { getProgress, cancelJob } from '../api';
import { JobProgressResponse } from '../types';

interface ProcessingProps {
  jobId: string;
  onNavigate: (path: string) => void;
}

export const ProcessingPage: React.FC<ProcessingProps> = ({ jobId, onNavigate }) => {
  const [progress, setProgress] = useState<JobProgressResponse | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let interval: any = null;

    const poll = async () => {
      try {
        const data = await getProgress(jobId);
        setProgress(data);

        if (data.status === 'COMPLETED') {
          clearInterval(interval);
          // Small delay then go to results
          setTimeout(() => {
            onNavigate(`/jobs/${jobId}/results`);
          }, 800);
        } else if (data.status === 'FAILED' || data.status === 'CANCELLED') {
          clearInterval(interval);
        }
      } catch (e: any) {
        setError(e.message || 'Error tracking job progress');
      }
    };

    poll();
    interval = setInterval(poll, 800);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [jobId, onNavigate]);

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this matching job?')) return;
    try {
      setCancelling(true);
      await cancelJob(jobId);
    } catch (e: any) {
      alert(e.message || 'Failed to cancel job');
    } finally {
      setCancelling(false);
    }
  };

  const stages = [
    { name: 'Data Ingestion & Integrity Checks', pct: 15 },
    { name: 'Entity Normalization & Clean Canonical Keys', pct: 30 },
    { name: 'Inverted Index Candidate Blocking', pct: 40 },
    { name: 'Multi-attribute Fuzzy Evaluation', pct: 85 },
    { name: 'Partitioning Excel Workbooks & ZIP Archive', pct: 100 },
  ];

  const currentPct = progress?.progress || 5;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span>MATCHING ENGINE ACTIVE</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Processing Entity Resolution Job
        </h1>
        <p className="text-xs text-slate-500 font-mono">Job ID: {jobId}</p>
      </div>

      {/* Main Progress Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-md space-y-6">
        {/* Progress Bar & Percent */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span className="text-slate-800">{progress?.current_stage || 'Processing records...'}</span>
            <span className="font-mono text-indigo-600 text-lg font-bold">{currentPct}%</span>
          </div>

          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${currentPct}%` }}
            />
          </div>
        </div>

        {/* Live Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Processed</span>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {progress?.processed_rows || 0} / {progress?.total_rows || 0}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Throughput</span>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {progress?.rows_per_second ? `${progress.rows_per_second.toFixed(0)} r/s` : 'Calculating...'}
            </div>
          </div>

          <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase">Matches Found</span>
            <div className="text-xl font-bold font-mono text-emerald-800 mt-1">
              {progress?.matches_count || 0}
            </div>
          </div>

          <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-100">
            <span className="text-[11px] font-semibold text-amber-700 uppercase">Partial Matches</span>
            <div className="text-xl font-bold font-mono text-amber-800 mt-1">
              {progress?.partial_matches_count || 0}
            </div>
          </div>
        </div>

        {/* Pipeline Stepper */}
        <div className="space-y-3 pt-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Execution Pipeline Stages
          </span>
          <div className="space-y-2">
            {stages.map((stage, i) => {
              const isDone = currentPct >= stage.pct;
              const isCurrent = currentPct < stage.pct && (i === 0 || currentPct >= stages[i - 1].pct);

              return (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-lg text-xs font-medium border transition-colors ${
                    isDone
                      ? 'bg-emerald-50/40 border-emerald-200 text-emerald-950'
                      : isCurrent
                      ? 'bg-indigo-50/50 border-indigo-200 text-indigo-950 font-semibold'
                      : 'bg-slate-50/60 border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : isCurrent ? (
                      <RefreshCw className="h-4 w-4 text-indigo-600 animate-spin shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-slate-300 shrink-0" />
                    )}
                    <span>{stage.name}</span>
                  </div>
                  <span className="font-mono text-[11px]">
                    {isDone ? 'Completed' : isCurrent ? 'Running...' : 'Pending'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cancel / View Action */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          {progress?.status === 'COMPLETED' ? (
            <button
              onClick={() => onNavigate(`/jobs/${jobId}/results`)}
              className="ml-auto flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-sm transition-all"
            >
              <span>View Results</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : progress?.status === 'FAILED' ? (
            <div className="text-xs text-rose-600 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              <span>Job failed: {progress.error_message || 'Unexpected engine fault'}</span>
            </div>
          ) : progress?.status === 'CANCELLED' ? (
            <div className="text-xs text-slate-500">Job was cancelled.</div>
          ) : (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="px-4 py-2 text-xs font-semibold rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Job'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
