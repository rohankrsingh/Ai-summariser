import React from 'react';
import { cn } from '../lib/utils';
import { SummaryStyle, SummaryLength } from '../services/gemini';
import { BarChart3, ListFilter } from 'lucide-react';

interface SummaryConfigProps {
  style: SummaryStyle;
  setStyle: (s: SummaryStyle) => void;
  length: SummaryLength;
  setLength: (l: SummaryLength) => void;
}

export function SummaryConfig({ style, setStyle, length, setLength }: SummaryConfigProps) {
  const styles: { id: SummaryStyle; label: string }[] = [
    { id: 'bullet points', label: 'Key Points' },
    { id: 'prose', label: 'Narrative' },
    { id: 'executive summary', label: 'Executive' },
    { id: 'action items', label: 'Actionable' },
  ];

  const lengths: { id: SummaryLength; label: string }[] = [
    { id: 'short', label: 'Concise' },
    { id: 'medium', label: 'Balanced' },
    { id: 'detailed', label: 'Deep Dive' },
  ];

  return (
    <div className="flex flex-col gap-8 rounded-xl border border-border bg-card p-6 md:flex-row">
      <div className="flex-1 space-y-4">
        <label className="flex items-center gap-2 pl-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <ListFilter className="w-3.5 h-3.5" />
          Output Format
        </label>
        <div className="flex flex-wrap gap-2">
          {styles.map((s) => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={cn(
                'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                style === s.id
                  ? 'border-primary/40 bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-muted',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-px bg-border hidden md:block" />

      <div className="flex-1 space-y-4">
        <label className="flex items-center gap-2 pl-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <BarChart3 className="w-3.5 h-3.5" />
          Detail Density
        </label>
        <div className="flex flex-wrap gap-2">
          {lengths.map((l) => (
            <button
              key={l.id}
              onClick={() => setLength(l.id)}
              className={cn(
                'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                length === l.id
                  ? 'border-primary/40 bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-muted',
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
