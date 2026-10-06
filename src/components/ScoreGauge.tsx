import React from 'react';

interface ScoreGaugeProps {
  score: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, label, size = 'md' }) => {
  const isHigh = score >= 90;
  const isMed = score >= 60 && score < 90;

  let colorClasses = 'text-slate-600 bg-slate-100 border-slate-200';
  let barColor = 'bg-slate-400';
  if (isHigh) {
    colorClasses = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    barColor = 'bg-emerald-500';
  } else if (isMed) {
    colorClasses = 'text-amber-700 bg-amber-50 border-amber-200';
    barColor = 'bg-amber-500';
  }

  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-semibold border ${colorClasses}`}>
        {score.toFixed(1)}%
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1 min-w-[70px]">
      {label && <span className="text-[11px] font-medium text-slate-500">{label}</span>}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} rounded-full transition-all duration-300`}
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        </div>
        <span className={`text-xs font-mono font-semibold ${isHigh ? 'text-emerald-700' : isMed ? 'text-amber-700' : 'text-slate-500'}`}>
          {score.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};
