import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Trash2,
  Layers,
  Database
} from 'lucide-react';
import { uploadFile, createJob, seedDemoDatasets } from '../api';
import { UploadedFile } from '../types';

interface NewJobProps {
  onNavigate: (path: string) => void;
}

export const NewJob: React.FC<NewJobProps> = ({ onNavigate }) => {
  const [jobName, setJobName] = useState('Enterprise Entity Match');
  const [fileA, setFileA] = useState<UploadedFile | null>(null);
  const [fileB, setFileB] = useState<UploadedFile | null>(null);
  const [uploadingA, setUploadingA] = useState(false);
  const [uploadingB, setUploadingB] = useState(false);
  const [errorA, setErrorA] = useState<string | null>(null);
  const [errorB, setErrorB] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const fileInputARef = useRef<HTMLInputElement>(null);
  const fileInputBRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileUpload = async (file: File, target: 'A' | 'B') => {
    // Permissive check: accept .xlsx, .xls, .csv, or files without extension from Google Drive
    const hasDot = file.name.includes('.');
    const ext = hasDot ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';

    if (hasDot && !['.xlsx', '.xls', '.csv', '.tsv', ''].includes(ext)) {
      const err = `Unsupported extension "${ext}". Please use an Excel (.xlsx, .xls) or CSV file.`;
      if (target === 'A') setErrorA(err);
      else setErrorB(err);
      return;
    }

    try {
      if (target === 'A') {
        setUploadingA(true);
        setErrorA(null);
        const res = await uploadFile(file);
        setFileA(res);
      } else {
        setUploadingB(true);
        setErrorB(null);
        const res = await uploadFile(file);
        setFileB(res);
      }
    } catch (err: any) {
      const msg = err.message || 'File upload failed';
      if (target === 'A') setErrorA(msg);
      else setErrorB(msg);
    } finally {
      if (target === 'A') setUploadingA(false);
      else setUploadingB(false);
    }
  };

  const handleSeedDemo = async () => {
    try {
      setSeeding(true);
      const res = await seedDemoDatasets();
      setFileA(res.file_a);
      setFileB(res.file_b);
      setJobName('B2B Demo: CRM Customer Accounts vs ERP Vendors');
    } catch (e: any) {
      alert(e.message || 'Failed to load demo datasets');
    } finally {
      setSeeding(false);
    }
  };

  const handleContinue = async () => {
    if (!fileA) {
      alert('Please upload Primary Dataset (File A) to proceed.');
      return;
    }

    try {
      setSubmitting(true);
      const isSingleDataset = !fileB;
      const job = await createJob({
        name: jobName.trim() || `${fileA.original_name.replace(/\.[^/.]+$/, '')} ${isSingleDataset ? 'Deduplication' : 'Matching'}`,
        file_a_id: fileA.id,
        file_b_id: fileB ? fileB.id : fileA.id,
      });
      onNavigate(`/jobs/${job.id}/mapping`);
    } catch (e: any) {
      alert(e.message || 'Failed to initialize job');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Breadcrumb / Step Indicator */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 mb-1">
            <span>STEP 1 OF 3</span>
            <span>·</span>
            <span>DATA INGESTION</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Upload Datasets for Entity Matching
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Ingest primary dataset (File A) and reference dataset (File B). Supported formats: .xlsx, .xls, .csv
          </p>
        </div>

        <button
          onClick={handleSeedDemo}
          disabled={seeding}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors shadow-2xs"
        >
          <Sparkles className="h-4 w-4 text-amber-600" />
          <span>{seeding ? 'Generating Sample...' : 'Quick Demo: Load B2B Spreadsheets'}</span>
        </button>
      </div>

      {/* Google Drive & Mobile File Upload Guide */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-blue-600 p-1 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <div className="font-bold text-sm text-blue-950">
              Uploading files from Google Drive (e.g. your &quot;Addressmatchi...&quot; or &quot;Address&quot; sheets)?
            </div>
            <p className="text-blue-800 leading-relaxed">
              Google Drive keeps your files in your cloud storage. To run entity matching on them:
            </p>
            <ol className="list-decimal list-inside space-y-0.5 font-medium text-blue-900 mt-1">
              <li>Open your Google Drive app or website.</li>
              <li>Tap the three dots (<strong>⋮</strong>) next to your file &rarr; tap <strong>Download</strong> (saves as Excel/CSV to your device).</li>
              <li>Then tap <strong>Primary Dataset (File A)</strong> or <strong>Reference Dataset (File B)</strong> below, select the downloaded file from your Downloads folder, and it will immediately load!</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Job Details Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Matching Job Name
        </label>
        <input
          type="text"
          value={jobName}
          onChange={(e) => setJobName(e.target.value)}
          placeholder="e.g., Salesforce Accounts vs SAP Master Vendors Q3"
          className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
        />
      </div>

      {/* Upload Dual Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* FILE A */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                  A
                </div>
                <h3 className="font-bold text-sm text-slate-900">Primary Dataset (File A)</h3>
              </div>
              {fileA && (
                <button
                  onClick={() => setFileA(null)}
                  className="text-xs text-rose-500 hover:text-rose-700 p-1"
                  title="Remove file"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {!fileA ? (
              <div
                onClick={() => fileInputARef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0], 'A');
                }}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  uploadingA
                    ? 'bg-slate-50 border-slate-300 cursor-wait'
                    : 'border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/20'
                }`}
              >
                <input
                  ref={fileInputARef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain,*/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'A')}
                />
                <UploadCloud className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                <div className="text-xs font-semibold text-slate-700">
                  {uploadingA ? 'Validating & Uploading...' : 'Click to browse or drop File A'}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Supported formats: .xlsx, .xls, .csv (up to 500MB)
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-emerald-50/70 border border-emerald-200 p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                      <div>
                        <div className="font-semibold text-xs text-emerald-950 truncate max-w-[200px]">
                          {fileA.original_name}
                        </div>
                        <div className="text-[11px] text-emerald-700">
                          {formatFileSize(fileA.file_size)} · {fileA.row_count.toLocaleString()} rows detected
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Validated
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Detected Schema ({fileA.columns.length} Columns)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {fileA.columns.map((c, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {errorA && (
              <div className="mt-3 text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> {errorA}
              </div>
            )}
          </div>
        </div>

        {/* FILE B */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
                  B
                </div>
                <h3 className="font-bold text-sm text-slate-900">Reference Dataset (File B)</h3>
              </div>
              {fileB && (
                <button
                  onClick={() => setFileB(null)}
                  className="text-xs text-rose-500 hover:text-rose-700 p-1"
                  title="Remove file"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {!fileB ? (
              <div
                onClick={() => fileInputBRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0], 'B');
                }}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  uploadingB
                    ? 'bg-slate-50 border-slate-300 cursor-wait'
                    : 'border-slate-300 hover:border-blue-500 hover:bg-blue-50/20'
                }`}
              >
                <input
                  ref={fileInputBRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain,*/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'B')}
                />
                <UploadCloud className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                <div className="text-xs font-semibold text-slate-700">
                  {uploadingB ? 'Validating & Uploading...' : 'Click to browse or drop Reference File B'}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Supported formats: .xlsx, .xls, .csv (up to 500MB)
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-emerald-50/70 border border-emerald-200 p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                      <div>
                        <div className="font-semibold text-xs text-emerald-950 truncate max-w-[200px]">
                          {fileB.original_name}
                        </div>
                        <div className="text-[11px] text-emerald-700">
                          {formatFileSize(fileB.file_size)} · {fileB.row_count.toLocaleString()} rows detected
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Validated
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Detected Schema ({fileB.columns.length} Columns)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {fileB.columns.map((c, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {errorB && (
              <div className="mt-3 text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> {errorB}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <button
          onClick={() => onNavigate('/dashboard')}
          className="px-4 py-2 text-xs font-semibold rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>

        <button
          onClick={handleContinue}
          disabled={!fileA || submitting}
          className={`flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-lg shadow-sm transition-all ${
            fileA && !submitting
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <span>
            {submitting
              ? 'Creating Job...'
              : fileB
              ? 'Continue to Column Mapping (File A ↔ File B)'
              : 'Continue to Column Mapping (Dataset A Only)'}
          </span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
