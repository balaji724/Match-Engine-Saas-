import React, { useEffect, useState } from 'react';
import {
  PlusCircle,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Trash2,
  Download,
  Sparkles,
  Search,
  ExternalLink
} from 'lucide-react';
import { getJobs, deleteJob, seedDemoDatasets, createJob } from '../api';
import { MatchingJob } from '../types';
import { downloadJobResults } from '../utils/downloader';

interface DashboardProps {
  onNavigate: (path: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [jobs, setJobs] = useState<MatchingJob[]>([]);
  const [metrics, setMetrics] = useState({
    total_jobs: 0,
    completed_jobs: 0,
    processing_jobs: 0,
    failed_jobs: 0,
  });
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await getJobs();
      setJobs(data.jobs || []);
      setMetrics(data.metrics || { total_jobs: 0, completed_jobs: 0, processing_jobs: 0, failed_jobs: 0 });
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleDeleteJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this matching job and its generated files?')) return;
    try {
      await deleteJob(jobId);
      await fetchDashboardData();
    } catch (err) {
      alert('Failed to delete job');
    }
  };

  const handleSeedAndCreateDemo = async () => {
    try {
      setSeeding(true);
      const res = await seedDemoDatasets();
      const newJob = await createJob({
        name: 'Enterprise Demo: CRM vs ERP Vendor Matching',
        file_a_id: res.file_a.id,
        file_b_id: res.file_b.id,
      });
      onNavigate(`/jobs/${newJob.id}/mapping`);
    } catch (err: any) {
      alert(err.message || 'Failed to seed demo job');
    } finally {
      setSeeding(false);
    }
  };

  const filteredJobs = jobs.filter((j) =>
    j.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded text-xs font-semibold">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            COMPLETED
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded text-xs font-semibold animate-pulse">
            <RefreshCw className="h-3 w-3 text-indigo-600 animate-spin" />
            PROCESSING
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded text-xs font-semibold">
            <AlertCircle className="h-3 w-3 text-rose-600" />
            FAILED
          </span>
        );
      case 'CONFIGURED':
        return (
          <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded text-xs font-semibold">
            READY TO RUN
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded text-xs font-semibold">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Top Banner / Hero */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Entity Resolution Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            High-performance fuzzy matching and record deduplication engine for B2B datasets up to 5,000,000 rows.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSeedAndCreateDemo}
            disabled={seeding}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 active:bg-amber-200 transition-colors shadow-2xs"
          >
            <Sparkles className="h-4 w-4 text-amber-600" />
            <span>{seeding ? 'Generating Sample Data...' : '1-Click Demo Dataset'}</span>
          </button>

          <button
            onClick={() => onNavigate('/jobs/new')}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 transition-all shadow-sm"
          >
            <PlusCircle className="h-4 w-4" />
            <span>+ New Matching Job</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Jobs</span>
            <FileSpreadsheet className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">{metrics.total_jobs}</div>
          <div className="mt-1 text-[11px] text-slate-400">All matching jobs registered</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-600">Completed Jobs</span>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-700">{metrics.completed_jobs}</div>
          <div className="mt-1 text-[11px] text-slate-400">Successfully matched & exported</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-600">Processing Jobs</span>
            <Clock className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-indigo-700">{metrics.processing_jobs}</div>
          <div className="mt-1 text-[11px] text-slate-400">Currently executing in background</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-600">Failed Jobs</span>
            <AlertCircle className="h-5 w-5 text-rose-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-rose-700">{metrics.failed_jobs}</div>
          <div className="mt-1 text-[11px] text-slate-400">Encountered errors</div>
        </div>
      </div>

      {/* Recent Jobs Section */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 px-6 py-4 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Matching Jobs</h2>
            <p className="text-xs text-slate-500">Track status, compare entity metrics, and download Excel/ZIP packages.</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 w-52"
              />
            </div>
            <button
              onClick={fetchDashboardData}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
            Loading matching jobs...
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="py-16 text-center">
            <FileSpreadsheet className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-800">No matching jobs yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
              Upload two customer/vendor spreadsheets or load the sample datasets to start entity matching.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleSeedAndCreateDemo}
                className="px-3.5 py-2 text-xs font-semibold rounded-md bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition-colors"
              >
                Load Sample Datasets
              </button>
              <button
                onClick={() => onNavigate('/jobs/new')}
                className="px-3.5 py-2 text-xs font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                + New Matching Job
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Job Name & ID</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Total Records</th>
                  <th className="px-6 py-3.5">Match Breakdown</th>
                  <th className="px-6 py-3.5">Created</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => {
                      if (job.status === 'COMPLETED') onNavigate(`/jobs/${job.id}/results`);
                      else if (job.status === 'PROCESSING') onNavigate(`/jobs/${job.id}/processing`);
                      else if (job.status === 'MAPPING') onNavigate(`/jobs/${job.id}/mapping`);
                      else onNavigate(`/jobs/${job.id}/rules`);
                    }}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 text-xs">{job.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{job.id}</div>
                    </td>

                    <td className="px-6 py-4">{getStatusBadge(job.status)}</td>

                    <td className="px-6 py-4 font-mono font-medium text-slate-800">
                      {job.total_rows.toLocaleString()}
                    </td>

                    <td className="px-6 py-4">
                      {job.status === 'COMPLETED' ? (
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-emerald-700 font-semibold">{job.matches_count} MATCH</span>
                          <span className="text-slate-300">/</span>
                          <span className="text-amber-700 font-semibold">{job.partial_matches_count} PARTIAL</span>
                          <span className="text-slate-300">/</span>
                          <span className="text-slate-500">{job.not_matches_count} NONE</span>
                        </div>
                      ) : job.status === 'PROCESSING' ? (
                        <div className="flex items-center gap-2 text-[11px] text-indigo-600">
                          <span className="font-medium">{job.progress}%</span>
                          <span className="text-slate-400">({job.processed_rows} processed)</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Not started</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-slate-500 text-[11px]">
                      {new Date(job.created_at).toLocaleDateString()}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {job.status === 'COMPLETED' ? (
                          <>
                            <button
                              onClick={() => onNavigate(`/jobs/${job.id}/results`)}
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center gap-1"
                            >
                              <span>View Results</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => downloadJobResults(job.id, 'excel', job.name)}
                              className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                              title="Download Excel Results (.xlsx)"
                            >
                              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                            </button>
                          </>
                        ) : job.status === 'PROCESSING' ? (
                          <button
                            onClick={() => onNavigate(`/jobs/${job.id}/processing`)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                          >
                            Live Progress
                          </button>
                        ) : (
                          <button
                            onClick={() => onNavigate(`/jobs/${job.id}/mapping`)}
                            className="px-2.5 py-1 text-xs font-medium rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                          >
                            Configure
                          </button>
                        )}

                        <button
                          onClick={(e) => handleDeleteJob(job.id, e)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
