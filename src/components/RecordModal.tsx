import React from 'react';
import { X, CheckCircle2, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';
import { MatchedResultRow } from '../types';
import { ScoreGauge } from './ScoreGauge';

interface RecordModalProps {
  row: MatchedResultRow | null;
  onClose: () => void;
}

export const RecordModal: React.FC<RecordModalProps> = ({ row, onClose }) => {
  if (!row) return null;

  const isMatch = row.Result === 'MATCH';
  const isPartial = row.Result === 'PARTIAL MATCH';

  const fields = [
    { name: 'Company Name', a: row.Company_A, b: row.Company_B, score: row.Company_Score, weight: '30%' },
    { name: 'Website / Domain', a: row.Domain_A, b: row.Domain_B, score: row.Domain_Score, weight: '25%' },
    { name: 'Address', a: row.Address_A, b: row.Address_B, score: row.Address_Score, weight: '20%' },
    { name: 'Email Address', a: row.Email_A, b: row.Email_B, score: row.Email_Score, weight: '10%' },
    { name: 'Phone Number', a: row.Phone_A, b: row.Phone_B, score: row.Phone_Score, weight: '10%' },
    { name: 'Pincode / Postal', a: row.Pincode_A, b: row.Pincode_B, score: row.Pincode_Score, weight: '5%' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-3">
            {isMatch ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            ) : isPartial ? (
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            ) : (
              <XCircle className="h-6 w-6 text-slate-400" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Entity Match Inspection</h3>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                    isMatch
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : isPartial
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {row.Result}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono">
                Pair: {row.A_ID} ↔ {row.B_ID}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Overall Score</div>
              <div className="text-xl font-bold font-mono text-slate-900">{row.Overall_Score.toFixed(1)}%</div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Reason Banner */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-700 flex items-center justify-between">
          <div>
            <span className="font-semibold text-slate-900">Resolution Reasoning: </span>
            {row.Reason}
          </div>
          <div className="text-slate-500 text-[11px]">
            Matched Fields: <span className="font-medium text-slate-800">{row.Matched_Fields}</span>
          </div>
        </div>

        {/* Field-by-Field Breakdown */}
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-12 text-xs font-semibold text-slate-500 pb-2 border-b border-slate-100">
            <div className="col-span-3">ATTRIBUTE & WEIGHT</div>
            <div className="col-span-4">FILE A VALUE</div>
            <div className="col-span-1 text-center">MATCH</div>
            <div className="col-span-4">FILE B VALUE</div>
          </div>

          {fields.map((f, i) => (
            <div key={i} className="grid grid-cols-12 items-center text-xs py-2 rounded-lg hover:bg-slate-50/80 px-2 transition-colors">
              <div className="col-span-3 pr-2">
                <div className="font-medium text-slate-900">{f.name}</div>
                <div className="text-[10px] text-slate-400">Weight: {f.weight}</div>
                <div className="mt-1">
                  <ScoreGauge score={f.score} size="sm" />
                </div>
              </div>

              <div className="col-span-4 bg-slate-50 p-2 rounded border border-slate-200 font-mono text-[11px] text-slate-800 break-words">
                {f.a || <span className="text-slate-400 italic">Empty</span>}
              </div>

              <div className="col-span-1 flex justify-center text-slate-400">
                <ArrowRight className="h-3.5 w-3.5" />
              </div>

              <div className="col-span-4 bg-slate-50 p-2 rounded border border-slate-200 font-mono text-[11px] text-slate-800 break-words">
                {f.b || <span className="text-slate-400 italic">Empty</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-200 px-6 py-3 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-md bg-slate-200 text-slate-800 hover:bg-slate-300 transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
