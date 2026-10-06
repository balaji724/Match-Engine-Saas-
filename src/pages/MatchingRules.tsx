import React, { useEffect, useState } from 'react';
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Zap,
  Info,
  RefreshCw,
  Cpu
} from 'lucide-react';
import { getJob, saveRules, startJob } from '../api';
import { MatchingJob, MatchingWeights, MatchingThresholds } from '../types';

interface MatchingRulesProps {
  jobId: string;
  onNavigate: (path: string) => void;
}

const DEFAULT_WEIGHTS: MatchingWeights = {
  company_name: 30,
  domain: 25,
  address: 20,
  email: 10,
  phone: 10,
  pincode: 5,
};

const DEFAULT_THRESHOLDS: MatchingThresholds = {
  match: 90,
  partial_match: 60,
};

export const MatchingRulesPage: React.FC<MatchingRulesProps> = ({ jobId, onNavigate }) => {
  const [job, setJob] = useState<MatchingJob | null>(null);
  const [weights, setWeights] = useState<MatchingWeights>(DEFAULT_WEIGHTS);
  const [thresholds, setThresholds] = useState<MatchingThresholds>(DEFAULT_THRESHOLDS);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getJob(jobId);
        setJob(data);
        if (data.config?.weights) setWeights(data.config.weights);
        if (data.config?.thresholds) setThresholds(data.config.thresholds);
      } catch (e) {
        console.error('Failed to load rules:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [jobId]);

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  const handleWeightChange = (field: keyof MatchingWeights, val: number) => {
    setWeights((prev) => ({
      ...prev,
      [field]: Math.max(0, Math.min(100, val)),
    }));
  };

  const handleResetDefaults = () => {
    setWeights(DEFAULT_WEIGHTS);
    setThresholds(DEFAULT_THRESHOLDS);
  };

  const handleStartMatching = async () => {
    if (totalWeight <= 0) {
      alert('Total weights cannot be zero.');
      return;
    }

    try {
      setStarting(true);
      await saveRules(jobId, weights, thresholds);
      await startJob(jobId);
      onNavigate(`/jobs/${jobId}/processing`);
    } catch (e: any) {
      alert(e.message || 'Failed to start matching engine');
      setStarting(false);
    }
  };

  if (loading || !job) {
    return (
      <div className="py-24 text-center">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-3" />
        <p className="text-xs text-slate-500 font-medium">Loading matching engine parameters...</p>
      </div>
    );
  }

  const weightSliders = [
    { key: 'company_name' as keyof MatchingWeights, label: 'Company Name', desc: 'Token Sort Ratio & Jaro-Winkler with legal suffix pruning' },
    { key: 'domain' as keyof MatchingWeights, label: 'Website / Domain', desc: 'Protocol stripping, subdomain hierarchy & exact root match' },
    { key: 'address' as keyof MatchingWeights, label: 'Address', desc: 'Street standardization & token set similarity' },
    { key: 'email' as keyof MatchingWeights, label: 'Email Address', desc: 'Domain extraction & user string distance' },
    { key: 'phone' as keyof MatchingWeights, label: 'Phone Number', desc: 'Digit normalization & national 10-digit suffix matching' },
    { key: 'pincode' as keyof MatchingWeights, label: 'Pincode / Postal', desc: 'Postal code prefix & exact numeric match' },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 mb-1">
            <span>STEP 3 OF 3</span>
            <span>·</span>
            <span>MATCHING RULES & THRESHOLDS</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Fuzzy Matching Rules & Scoring Weights
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Define weight distributions and confidence thresholds for classifying records as MATCH, PARTIAL MATCH, or NOT MATCH.
          </p>
        </div>

        <button
          onClick={handleResetDefaults}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* Grid: Weights & Thresholds */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Attribute Weights (2 cols) */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Attribute Scoring Weights</h3>
              <p className="text-xs text-slate-500">Assign importance to each attribute (Default total = 100).</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Total Weight:</span>
              <span
                className={`font-mono text-sm font-bold px-2 py-0.5 rounded border ${
                  totalWeight === 100
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {totalWeight}
              </span>
            </div>
          </div>

          <div className="space-y-5">
            {weightSliders.map((item) => (
              <div key={item.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{item.label}</span>
                    <span className="text-[11px] text-slate-400 ml-2">{item.desc}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-700">{weights[item.key]}</span>
                    <span className="text-slate-400">pts</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="5"
                    value={weights[item.key]}
                    onChange={(e) => handleWeightChange(item.key, parseInt(e.target.value) || 0)}
                    className="flex-1 accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weights[item.key]}
                    onChange={(e) => handleWeightChange(item.key, parseInt(e.target.value) || 0)}
                    className="w-14 px-2 py-1 text-xs font-mono font-bold text-center border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Confidence Thresholds & Engine Note */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Classification Thresholds</h3>
              <p className="text-xs text-slate-500">Set the cut-off scores for the decision engine.</p>
            </div>

            {/* MATCH Threshold */}
            <div className="p-3.5 rounded-lg bg-emerald-50/60 border border-emerald-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  MATCH
                </span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  &gt;= {thresholds.match}%
                </span>
              </div>
              <input
                type="range"
                min="70"
                max="98"
                step="1"
                value={thresholds.match}
                onChange={(e) => setThresholds({ ...thresholds, match: parseInt(e.target.value) || 90 })}
                className="w-full accent-emerald-600 h-1.5 bg-emerald-200 rounded-lg cursor-pointer"
              />
              <div className="text-[10px] text-emerald-800">
                High confidence match. Entities merged automatically.
              </div>
            </div>

            {/* PARTIAL MATCH Threshold */}
            <div className="p-3.5 rounded-lg bg-amber-50/60 border border-amber-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  PARTIAL MATCH
                </span>
                <span className="font-mono font-bold text-amber-700 text-sm">
                  &gt;= {thresholds.partial_match}%
                </span>
              </div>
              <input
                type="range"
                min="40"
                max="85"
                step="1"
                value={thresholds.partial_match}
                onChange={(e) => setThresholds({ ...thresholds, partial_match: parseInt(e.target.value) || 60 })}
                className="w-full accent-amber-600 h-1.5 bg-amber-200 rounded-lg cursor-pointer"
              />
              <div className="text-[10px] text-amber-800">
                Ambiguous / review needed. Scores below {thresholds.partial_match}% are marked <strong className="text-slate-700">NOT MATCH</strong>.
              </div>
            </div>
          </div>

          {/* Engine Scalability Note */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Cpu className="h-4 w-4 text-indigo-600" />
              <span>Large-Scale $O(N)$ Inverted Indexing</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              For datasets scaling up to 5,000,000 records, the engine generates candidate pairs using canonical domain hashes, phone digits, and company 3-gram tokens, completely bypassing the quadratic Cartesian product ($25 \times 10^{12}$ comparisons).
            </p>
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <button
          onClick={() => onNavigate(`/jobs/${jobId}/mapping`)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Mapping</span>
        </button>

        <button
          onClick={handleStartMatching}
          disabled={starting}
          className="flex items-center gap-2 px-8 py-3 text-sm font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-md transition-all cursor-pointer"
        >
          <Zap className="h-4 w-4 fill-white" />
          <span>{starting ? 'Initializing Engine...' : 'Start Matching Engine'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
