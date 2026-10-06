import React, { useEffect, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Archive,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  RefreshCw,
  ArrowLeft,
  Clock,
  Zap,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { getSummary, getResults } from '../api';
import { MatchedResultRow } from '../types';
import { ScoreGauge } from '../components/ScoreGauge';
import { RecordModal } from '../components/RecordModal';
import { downloadJobResults } from '../utils/downloader';

interface ResultsProps {
  jobId: string;
  onNavigate: (path: string) => void;
}

export const ResultsPage: React.FC<ResultsProps> = ({ jobId, onNavigate }) => {
  const [summary, setSummary] = useState<any>(null);
  const [resultsData, setResultsData] = useState<{
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    items: MatchedResultRow[];
  }>({ total: 0, page: 1, limit: 25, total_pages: 1, items: [] });

  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingResults, setLoadingResults] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (type: 'excel' | 'summary' | 'csv' | 'zip') => {
    setDownloading(type);
    try {
      await downloadJobResults(jobId, type, summary?.file_a?.original_name || summary?.job?.name);
    } finally {
      setDownloading(null);
    }
  };

  // Filters
  const [resultFilter, setResultFilter] = useState<'ALL' | 'MATCH' | 'PARTIAL MATCH' | 'NOT MATCH'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [minScore, setMinScore] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Selected row for detail modal
  const [selectedRow, setSelectedRow] = useState<MatchedResultRow | null>(null);

  // Fetch summary once
  useEffect(() => {
    async function loadSummary() {
      try {
        setLoadingSummary(true);
        const data = await getSummary(jobId);
        setSummary(data);
      } catch (e) {
        console.error('Failed to load summary:', e);
      } finally {
        setLoadingSummary(false);
      }
    }
    loadSummary();
  }, [jobId]);

  // Fetch paginated results when filter/page changes
  useEffect(() => {
    async function loadRows() {
      try {
        setLoadingResults(true);
        const data = await getResults(jobId, {
          filter: resultFilter === 'ALL' ? undefined : resultFilter,
          search: searchQuery.trim() || undefined,
          min_score: minScore > 0 ? minScore : undefined,
          page: currentPage,
          limit: 25,
        });
        setResultsData(data);
      } catch (e) {
        console.error('Failed to load results:', e);
      } finally {
        setLoadingResults(false);
      }
    }
    loadRows();
  }, [jobId, resultFilter, searchQuery, minScore, currentPage]);

  const getResultTag = (res: string) => {
    if (res === 'MATCH') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-3 w-3" /> MATCH
        </span>
      );
    }
    if (res === 'PARTIAL MATCH') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="h-3 w-3" /> PARTIAL MATCH
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
        <XCircle className="h-3 w-3" /> NOT MATCH
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <button
            onClick={() => onNavigate('/dashboard')}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-2 font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Matching Results & Entity Resolution
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded">
              Completed
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {summary?.file_a?.original_name || 'Dataset A'} ↔ {summary?.file_b?.original_name || 'Dataset B'}
          </p>
        </div>

        {/* Download Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Primary Excel Download */}
          <button
            onClick={() => handleDownload('excel')}
            disabled={downloading !== null}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
            title="Download full matching results as an Excel workbook"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>{downloading === 'excel' ? 'Generating .xlsx...' : 'Download Results (.xlsx)'}</span>
          </button>

          <button
            onClick={() => handleDownload('summary')}
            disabled={downloading !== null}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors bg-white shadow-2xs cursor-pointer disabled:opacity-50"
            title="Download executive match summary"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500" />
            <span>{downloading === 'summary' ? 'Exporting...' : 'Summary (.xlsx)'}</span>
          </button>

          <button
            onClick={() => handleDownload('csv')}
            disabled={downloading !== null}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors bg-white shadow-2xs cursor-pointer disabled:opacity-50"
            title="Download results as CSV"
          >
            <span>{downloading === 'csv' ? 'Exporting...' : 'CSV'}</span>
          </button>

          <button
            onClick={() => handleDownload('zip')}
            disabled={downloading !== null}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors bg-white cursor-pointer disabled:opacity-50"
            title="Download archive package (.zip)"
          >
            <Archive className="h-3.5 w-3.5 text-slate-400" />
            <span>{downloading === 'zip' ? 'Packaging...' : 'ZIP Archive'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: Total, MATCH, PARTIAL MATCH, NOT MATCH, Speed */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500">Total Evaluated</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
              {summary.metrics?.total_records?.toLocaleString() || 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Processed entity rows</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs">
            <span className="text-[11px] font-semibold text-emerald-700">MATCH ({summary.metrics?.match_pct}%)</span>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1 font-mono">
              {summary.metrics?.match?.toLocaleString() || 0}
            </div>
            <div className="text-[10px] text-emerald-600 mt-1">Confidence &gt;= {summary.config?.thresholds?.match}%</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs">
            <span className="text-[11px] font-semibold text-amber-700">PARTIAL MATCH ({summary.metrics?.partial_match_pct}%)</span>
            <div className="text-2xl font-extrabold text-amber-700 mt-1 font-mono">
              {summary.metrics?.partial_match?.toLocaleString() || 0}
            </div>
            <div className="text-[10px] text-amber-600 mt-1">Confidence &gt;= {summary.config?.thresholds?.partial_match}%</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-600">NOT MATCH ({summary.metrics?.not_match_pct}%)</span>
            <div className="text-2xl font-extrabold text-slate-700 mt-1 font-mono">
              {summary.metrics?.not_match?.toLocaleString() || 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Below threshold</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 md:col-span-1">
            <span className="text-[11px] font-semibold text-indigo-600">Engine Performance</span>
            <div className="text-2xl font-extrabold text-indigo-700 mt-1 font-mono">
              {summary.metrics?.processing_time_sec}s
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Throughput: {summary.metrics?.rows_per_second?.toFixed(0)} rows/sec
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Segmented Filter Buttons */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['ALL', 'MATCH', 'PARTIAL MATCH', 'NOT MATCH'] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setResultFilter(type);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  resultFilter === type
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search company, domain, email..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 w-64"
              />
            </div>

            {/* Min Score Slider */}
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="text-[11px] font-medium text-slate-500">Min Score:</span>
              <input
                type="range"
                min="0"
                max="95"
                step="5"
                value={minScore}
                onChange={(e) => {
                  setMinScore(parseInt(e.target.value) || 0);
                  setCurrentPage(1);
                }}
                className="w-20 accent-indigo-600 h-1 bg-slate-200 rounded"
              />
              <span className="font-mono font-bold text-slate-800 w-8">{minScore}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Data Grid with all 23 Required Columns */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-3.5 bg-slate-50/70 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-700">
            Records Table ({resultsData.total.toLocaleString()} Matched Pairs Found)
          </div>
          <div className="text-[11px] text-slate-500">
            Click any row to open the complete Entity Inspection comparison modal
          </div>
        </div>

        {loadingResults ? (
          <div className="py-20 text-center">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
            <span className="text-xs text-slate-500">Loading result records...</span>
          </div>
        ) : resultsData.items.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No records matched current search / filter parameters.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-100/80 sticky top-0 z-10 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Overall Score</th>
                  <th className="px-4 py-3">A_ID ↔ B_ID</th>
                  <th className="px-4 py-3">Company A vs Company B</th>
                  <th className="px-4 py-3">Domain A vs Domain B</th>
                  <th className="px-4 py-3">Email A vs Email B</th>
                  <th className="px-4 py-3">Phone A vs Phone B</th>
                  <th className="px-4 py-3">Address A vs Address B</th>
                  <th className="px-4 py-3">Pincode A vs Pincode B</th>
                  <th className="px-4 py-3">Matched Fields</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resultsData.items.map((row, idx) => (
                  <tr
                    key={idx}
                    onClick={() => setSelectedRow(row)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">{getResultTag(row.Result)}</td>

                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-slate-900 text-xs">
                        {row.Overall_Score.toFixed(1)}%
                      </div>
                      <div className="text-[10px] text-slate-400">
                        C:{row.Company_Score} D:{row.Domain_Score} A:{row.Address_Score}
                      </div>
                    </td>

                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                      {row.A_ID} ↔ {row.B_ID}
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 text-xs">{row.Company_A || '—'}</div>
                      <div className="text-[11px] text-slate-500">{row.Company_B || '—'}</div>
                    </td>

                    <td className="px-4 py-3 font-mono text-[11px]">
                      <div className="text-slate-800">{row.Domain_A || '—'}</div>
                      <div className="text-slate-500">{row.Domain_B || '—'}</div>
                    </td>

                    <td className="px-4 py-3 font-mono text-[11px]">
                      <div className="text-slate-800">{row.Email_A || '—'}</div>
                      <div className="text-slate-500">{row.Email_B || '—'}</div>
                    </td>

                    <td className="px-4 py-3 font-mono text-[11px]">
                      <div className="text-slate-800">{row.Phone_A || '—'}</div>
                      <div className="text-slate-500">{row.Phone_B || '—'}</div>
                    </td>

                    <td className="px-4 py-3 max-w-[200px] truncate text-[11px]">
                      <div className="text-slate-800 truncate">{row.Address_A || '—'}</div>
                      <div className="text-slate-500 truncate">{row.Address_B || '—'}</div>
                    </td>

                    <td className="px-4 py-3 font-mono text-[11px]">
                      <div className="text-slate-800">{row.Pincode_A || '—'}</div>
                      <div className="text-slate-500">{row.Pincode_B || '—'}</div>
                    </td>

                    <td className="px-4 py-3 text-[11px] text-slate-700">
                      {row.Matched_Fields}
                    </td>

                    <td className="px-4 py-3 text-[11px] text-slate-500 max-w-[200px] truncate">
                      {row.Reason}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRow(row);
                        }}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        title="View detailed comparison"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 bg-slate-50">
          <div className="text-xs text-slate-500">
            Showing Page <span className="font-semibold text-slate-800">{resultsData.page}</span> of{' '}
            <span className="font-semibold text-slate-800">{resultsData.total_pages || 1}</span> (
            {resultsData.total.toLocaleString()} total pairs)
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={resultsData.page <= 1}
              className="p-1.5 rounded border border-slate-300 text-slate-600 disabled:opacity-40 hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-xs font-mono font-medium text-slate-700">
              {resultsData.page} / {resultsData.total_pages || 1}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(resultsData.total_pages, p + 1))}
              disabled={resultsData.page >= resultsData.total_pages}
              className="p-1.5 rounded border border-slate-300 text-slate-600 disabled:opacity-40 hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Row Inspection Modal */}
      <RecordModal row={selectedRow} onClose={() => setSelectedRow(null)} />
    </div>
  );
};
