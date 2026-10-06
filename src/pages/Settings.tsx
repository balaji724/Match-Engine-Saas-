import React from 'react';
import {
  HardDrive,
  ShieldCheck,
  Server,
  Layers,
  Cpu,
  FileSpreadsheet,
  CheckCircle2,
  FolderOpen
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Engine Architecture & Storage Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          MatchEngine V1 execution parameters, modular local storage configuration, and security rules.
        </p>
      </div>

      {/* Storage Volumes Grid */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <HardDrive className="h-5 w-5 text-indigo-600" />
          <h2 className="font-bold text-base text-slate-900">Modular File Storage (V1 Local Disk)</h2>
        </div>

        <p className="text-xs text-slate-500">
          Files and processing artifacts are partitioned across sandboxed directories. Designed with a clean abstraction layer for instant MinIO or AWS S3 swap.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-800">data/uploads/</span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Active</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Ingested .xlsx, .xls, and .csv files with hash prefixing and sanitized filenames.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-800">data/processing/</span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Active</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Candidate generation index blocks and scratch evaluation memory.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-800">data/results/</span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Active</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Exported chunked Excel workbooks (results_001.xlsx...), summary.xlsx, and match_results.zip.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-800">data/temp/</span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Active</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Automatic temporary file staging with auto-cleanup after job packaging.
            </p>
          </div>
        </div>
      </div>

      {/* Large File & Partitioning Strategy */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Cpu className="h-5 w-5 text-indigo-600" />
          <h2 className="font-bold text-base text-slate-900">High-Throughput Partitioning (5M Records Support)</h2>
        </div>

        <div className="space-y-3 text-xs text-slate-600">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900">Inverted Index Candidate Blocking:</strong> Never uses $O(N \times M)$ nested loop comparison. Generates high-probability candidate sets using canonical domain hashes, phone suffixes, and company 3-grams.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900">Automatic Excel Worksheet Chunking:</strong> Because standard Excel sheets are capped at ~1,048,576 rows, the exporter partitions large result sets into <span className="font-mono font-semibold">results_001.xlsx</span>, <span className="font-mono font-semibold">results_002.xlsx</span> (50,000 rows per chunk) and packages them into <span className="font-mono font-semibold">match_results.zip</span> with an executive <span className="font-mono font-semibold">summary.xlsx</span>.
            </div>
          </div>
        </div>
      </div>

      {/* Security Hardening Status */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <h2 className="font-bold text-base text-slate-900">Security & Sandboxing</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Filename sanitization & path traversal guard</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>MIME & extension validation (.xlsx, .xls, .csv)</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Zero file execution / strictly read as data streams</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>V1 Open Access Mode (No login barriers or JWTs)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
