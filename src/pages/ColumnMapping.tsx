import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Table,
  Layers,
  Sparkles,
  RefreshCw,
  HelpCircle
} from 'lucide-react';
import { getJob, saveMapping } from '../api';
import { MatchingJob, ColumnMapping } from '../types';

interface ColumnMappingProps {
  jobId: string;
  onNavigate: (path: string) => void;
}

export const ColumnMappingPage: React.FC<ColumnMappingProps> = ({ jobId, onNavigate }) => {
  const [job, setJob] = useState<MatchingJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mapping, setMapping] = useState<ColumnMapping>({
    company_name: { a: '', b: '' },
    domain: { a: '', b: '' },
    address: { a: '', b: '' },
    email: { a: '', b: '' },
    phone: { a: '', b: '' },
    pincode: { a: '', b: '' },
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getJob(jobId);
        setJob(data);
        if (data.config?.mapping) {
          setMapping(data.config.mapping);
        }
      } catch (e) {
        console.error('Failed to load job mapping:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [jobId]);

  const handleFieldChange = (field: keyof ColumnMapping, fileKey: 'a' | 'b', value: string) => {
    setMapping((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [fileKey]: value,
      },
    }));
  };

  const handleSaveAndContinue = async () => {
    try {
      setSaving(true);
      await saveMapping(jobId, mapping);
      onNavigate(`/jobs/${jobId}/rules`);
    } catch (e: any) {
      alert(e.message || 'Failed to save mapping');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !job) {
    return (
      <div className="py-24 text-center">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-3" />
        <p className="text-xs text-slate-500 font-medium">Loading dataset schema...</p>
      </div>
    );
  }

  const colsA = job.file_a?.columns || [];
  const colsB = job.file_b?.columns || [];

  const requiredAttributes = [
    {
      id: 'company_name' as keyof ColumnMapping,
      name: 'Company Name',
      desc: 'Legal or trade company name (e.g., Salesforce Inc)',
      defaultWeight: '30%',
    },
    {
      id: 'domain' as keyof ColumnMapping,
      name: 'Website / Domain',
      desc: 'Canonical domain or website URL (e.g., salesforce.com)',
      defaultWeight: '25%',
    },
    {
      id: 'address' as keyof ColumnMapping,
      name: 'Address',
      desc: 'Street address, building, suite (e.g., 415 Mission St)',
      defaultWeight: '20%',
    },
    {
      id: 'email' as keyof ColumnMapping,
      name: 'Email Address',
      desc: 'Corporate email or domain inbox (e.g., contact@salesforce.com)',
      defaultWeight: '10%',
    },
    {
      id: 'phone' as keyof ColumnMapping,
      name: 'Phone Number',
      desc: 'Telephone or mobile digits (e.g., +1 800-667-6389)',
      defaultWeight: '10%',
    },
    {
      id: 'pincode' as keyof ColumnMapping,
      name: 'Pincode / Postal',
      desc: 'ZIP or postal code digits (e.g., 94105)',
      defaultWeight: '5%',
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Step Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 mb-1">
            <span>STEP 2 OF 3</span>
            <span>·</span>
            <span>SCHEMA & COLUMN MAPPING</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Map Entity Columns: Primary (Dataset A) ↔ Reference (Dataset B)
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Align attributes between your primary dataset and reference dataset (or compare two columns within the same sheet) for entity resolution.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-700">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          <span>Auto-mapped based on header analysis</span>
        </div>
      </div>

      {/* Mapping Form Grid */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 px-6 py-3.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
          <div className="col-span-4">TARGET ATTRIBUTE</div>
          <div className="col-span-4">PRIMARY / DATASET A COLUMN</div>
          <div className="col-span-4">REFERENCE / DATASET B COLUMN</div>
        </div>

        <div className="divide-y divide-slate-100 px-6">
          {requiredAttributes.map((attr) => (
            <div key={attr.id} className="grid grid-cols-12 items-center py-4 gap-4">
              <div className="col-span-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">{attr.name}</span>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    Default: {attr.defaultWeight}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{attr.desc}</div>
              </div>

              {/* File A Dropdown */}
              <div className="col-span-4">
                <select
                  value={mapping[attr.id]?.a || ''}
                  onChange={(e) => handleFieldChange(attr.id, 'a', e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">-- None / Skip --</option>
                  {colsA.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reference B Dropdown */}
              <div className="col-span-4">
                <select
                  value={mapping[attr.id]?.b || ''}
                  onChange={(e) => handleFieldChange(attr.id, 'b', e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">-- None / Skip --</option>
                  {colsB.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Sample Alignment Preview */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Table className="h-4 w-4 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-900">Live Sample Data Alignment (Row 1 Preview)</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">Verify field data matches correctly</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 border-y border-slate-200">
              <tr>
                <th className="px-4 py-2">Field</th>
                <th className="px-4 py-2">Primary Sample A ({mapping.company_name?.a || 'N/A'})</th>
                <th className="px-4 py-2">Reference Sample B ({mapping.company_name?.b || 'N/A'})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {requiredAttributes.map((attr) => {
                const sampleA = job.file_a?.preview_rows?.[0]?.[mapping[attr.id]?.a || ''];
                const sampleB = job.file_b?.preview_rows?.[0]?.[mapping[attr.id]?.b || ''];
                return (
                  <tr key={attr.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-sans font-semibold text-slate-800">{attr.name}</td>
                    <td className="px-4 py-2.5 text-slate-700 bg-indigo-50/20">
                      {sampleA ? String(sampleA) : <span className="text-slate-400 italic font-sans">No value</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 bg-blue-50/20">
                      {sampleB ? String(sampleB) : <span className="text-slate-400 italic font-sans">No value</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <button
          onClick={() => onNavigate(`/jobs/${jobId}`)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>

        <button
          onClick={handleSaveAndContinue}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
        >
          <span>{saving ? 'Saving Mapping...' : 'Save & Configure Matching Rules'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
