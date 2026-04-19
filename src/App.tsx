import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  FileText,
  History,
  MessageSquare,
  Music,
  Sparkles,
  Terminal,
  Youtube,
  FolderSync,
  WandSparkles,
  BookOpenCheck,
  Download,
  Trash2,
} from 'lucide-react';
import { FileUploader } from './components/FileUploader';
import { SummaryConfig } from './components/SummaryConfig';
import { SummaryResult } from './components/SummaryResult';
import { Button } from './components/Button';
import { hasGeminiApiKey, summarizeContent, SummaryLength, SummaryStyle } from './services/gemini';
import { cn } from './lib/utils';

type SourceType = 'pdf' | 'audio' | 'youtube' | 'text' | null;
type WorkspaceView = 'workspace' | 'history';

interface HistoryEntry {
  id: number;
  type: Exclude<SourceType, null>;
  source: string;
  result: string;
  date: string;
  style: SummaryStyle;
  length: SummaryLength;
}

const SOURCE_OPTIONS: { id: Exclude<SourceType, null>; label: string; icon: React.ElementType; hint: string }[] = [
  { id: 'youtube', label: 'YouTube Video', icon: Youtube, hint: 'Paste a link and summarize the transcript/story' },
  { id: 'pdf', label: 'PDF Document', icon: FileText, hint: 'Upload reports, notes, and long PDFs quickly' },
  { id: 'audio', label: 'Audio Recording', icon: Music, hint: 'Convert voice/audio to concise takeaways' },
  { id: 'text', label: 'Plain Text', icon: MessageSquare, hint: 'Drop raw content and extract key points' },
];

const STARTER_TEMPLATES = [
  {
    title: 'Meeting Notes Cleanup',
    value:
      'Sprint Planning Notes\n- API response time jumped from 180ms to 260ms in peak hours.\n- Team agreed to add endpoint-level caching for analytics routes.\n- Rollout target is Friday with a 10% traffic canary.\n- Risk: stale dashboard metrics if cache invalidation misses edge cases.',
  },
  {
    title: 'Lecture Recap',
    value:
      'Today we covered gradient descent and why learning rate selection matters. If the learning rate is too low, convergence is slow. If too high, the model oscillates around minima. We also discussed momentum and adaptive optimizers like Adam.',
  },
];

export default function App() {
  const [view, setView] = useState<WorkspaceView>('workspace');
  const [sourceType, setSourceType] = useState<SourceType>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [style, setStyle] = useState<SummaryStyle>('bullet points');
  const [length, setLength] = useState<SummaryLength>('medium');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const hasApiKey = useMemo(() => hasGeminiApiKey(), []);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('aura_history');
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        setHistory(parsed);
      }
    } catch (loadError) {
      console.warn('Skipping invalid history data from localStorage.', loadError);
      localStorage.removeItem('aura_history');
    }
  }, []);

  const stats = useMemo(() => {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const thisWeek = history.filter((entry) => now - new Date(entry.date).getTime() <= sevenDaysMs).length;
    const totalChars = history.reduce((acc, item) => acc + item.result.length, 0);
    return {
      total: history.length,
      thisWeek,
      avgSize: history.length ? Math.round(totalChars / history.length) : 0,
    };
  }, [history]);

  const saveToHistory = (
    type: Exclude<SourceType, null>,
    source: string,
    result: string,
    summaryStyle: SummaryStyle,
    summaryLength: SummaryLength,
  ) => {
    setHistory((prev) => {
      const newEntry: HistoryEntry = {
        id: Date.now(),
        type,
        source,
        result,
        date: new Date().toISOString(),
        style: summaryStyle,
        length: summaryLength,
      };

      const updated = [newEntry, ...prev].slice(0, 20);
      localStorage.setItem('aura_history', JSON.stringify(updated));
      return updated;
    });
  };

  const canProcess =
    !isProcessing &&
    ((sourceType === 'text' && rawText.trim().length > 0) ||
      (sourceType === 'youtube' && selectedUrl.trim().length > 0) ||
      ((sourceType === 'pdf' || sourceType === 'audio') && Boolean(selectedFile)));

  const handleProcess = async () => {
    if (!canProcess || !sourceType) return;
    if (!hasApiKey) {
      setError('Gemini API key missing. Add it to .env.local, then restart with npm run dev.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      let content: string | { mimeType: string; data: string };
      let sourceLabel = '';

      if (sourceType === 'text') {
        content = rawText;
        sourceLabel = `${rawText.slice(0, 40).trim() || 'Text input'}...`;
      } else if (sourceType === 'youtube') {
        content = `Summarize the YouTube video at this URL: ${selectedUrl}`;
        sourceLabel = selectedUrl;
      } else if (selectedFile) {
        const base64 = await fileToBase64(selectedFile);
        content = {
          mimeType: selectedFile.type,
          data: base64,
        };
        sourceLabel = selectedFile.name;
      } else {
        throw new Error('Please provide an input source before summarizing.');
      }

      const result = await summarizeContent(content, { style, length });
      const finalSummary = result || 'No summary was returned by the AI model.';

      setSummary(finalSummary);
      saveToHistory(sourceType, sourceLabel, finalSummary, style, length);
    } catch (processError) {
      console.error(processError);
      const message = processError instanceof Error ? processError.message : 'Unknown processing error.';
      setError(`Analysis failed: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (readerError) => reject(readerError);
    });

  const resetDraft = () => {
    setSummary(null);
    setSelectedFile(null);
    setSelectedUrl('');
    setRawText('');
    setSourceType(null);
    setError(null);
  };

  const loadFromHistory = (entry: HistoryEntry) => {
    setSummary(entry.result);
    setSourceType(entry.type);
    setStyle(entry.style);
    setLength(entry.length);
    setError(null);
    setView('workspace');
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('aura_history');
  };

  const exportSummary = () => {
    if (!summary) return;
    const payload = `# Summary\n\n${summary}`;
    const blob = new Blob([payload], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `summary-${new Date().toISOString().slice(0, 10)}.md`;
    anchor.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-4 lg:flex-row lg:gap-6 lg:p-6">
        <aside className="glass-panel w-full rounded-2xl border border-border/70 p-4 lg:w-80 lg:p-5">
          <div className="mb-6 flex items-center gap-3 px-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white shadow-lg shadow-teal-700/20">
              <WandSparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-tight">Summora</h1>
              <p className="text-xs text-text-secondary">Personal AI Summary Workspace</p>
            </div>
          </div>

          <div className="space-y-2">
            {[
              { id: 'workspace', label: 'Workspace', icon: Sparkles },
              { id: 'history', label: 'History', icon: History },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id as WorkspaceView)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
                  view === item.id
                    ? 'bg-accent text-white shadow-md shadow-teal-700/20'
                    : 'text-text-secondary hover:bg-white hover:text-text-primary',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>

          {view === 'workspace' && (
            <div className="mt-7 space-y-2">
              <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-text-secondary">Input Channel</p>
              {SOURCE_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSourceType(item.id);
                    setSummary(null);
                    setError(null);
                  }}
                  className={cn(
                    'group w-full rounded-xl border px-3 py-3 text-left transition-all',
                    sourceType === item.id
                      ? 'border-accent bg-white shadow-sm shadow-teal-600/10'
                      : 'border-transparent bg-transparent hover:border-border hover:bg-white',
                  )}
                >
                  <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <item.icon className="h-4 w-4 text-accent" />
                    {item.label}
                  </div>
                  <p className="text-xs text-text-secondary">{item.hint}</p>
                </button>
              ))}
            </div>
          )}

          <div className="mt-7 rounded-xl border border-border bg-white/80 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-text-secondary">
              <Terminal className="h-3.5 w-3.5" />
              Workspace Health
            </div>
            <p className="text-sm font-medium text-text-primary">
              {hasApiKey ? 'Gemini API key detected.' : 'API key not found in .env.local.'}
            </p>
          </div>
        </aside>

        <main className="flex-1 space-y-4">
          <header className="glass-panel rounded-2xl border border-border/70 px-5 py-4 lg:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight">{view === 'workspace' ? 'Workspace' : 'Summary History'}</h2>
                <p className="text-sm text-text-secondary">
                  {view === 'workspace'
                    ? 'Summarize faster with consistent output styles and instant follow-up chat.'
                    : 'Your recent summaries stay local in browser storage for personal use.'}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center lg:min-w-[340px]">
                <div className="rounded-xl border border-border bg-white px-3 py-2">
                  <p className="text-lg font-bold text-text-primary">{stats.total}</p>
                  <p className="text-[11px] uppercase tracking-wider text-text-secondary">Total</p>
                </div>
                <div className="rounded-xl border border-border bg-white px-3 py-2">
                  <p className="text-lg font-bold text-text-primary">{stats.thisWeek}</p>
                  <p className="text-[11px] uppercase tracking-wider text-text-secondary">This Week</p>
                </div>
                <div className="rounded-xl border border-border bg-white px-3 py-2">
                  <p className="text-lg font-bold text-text-primary">{stats.avgSize}</p>
                  <p className="text-[11px] uppercase tracking-wider text-text-secondary">Avg Chars</p>
                </div>
              </div>
            </div>
          </header>

          {view === 'workspace' ? (
            <div className="space-y-4">
              {!summary ? (
                <>
                  {!hasApiKey && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      Add <code className="font-mono font-semibold">VITE_GEMINI_API_KEY</code> to{' '}
                      <code className="font-mono font-semibold">.env.local</code>, then restart <code className="font-mono font-semibold">npm run dev</code>.
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-border bg-white p-4">
                      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-accent">
                        <BookOpenCheck className="h-4 w-4" />
                      </div>
                      <p className="font-semibold text-text-primary">Structured Summaries</p>
                      <p className="text-sm text-text-secondary">Choose bullet points, prose, executive notes, or action items.</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-white p-4">
                      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600">
                        <FolderSync className="h-4 w-4" />
                      </div>
                      <p className="font-semibold text-text-primary">Reusable History</p>
                      <p className="text-sm text-text-secondary">Open any previous output and keep asking follow-up questions.</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-white p-4">
                      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <p className="font-semibold text-text-primary">Personal Workflow</p>
                      <p className="text-sm text-text-secondary">Built for solo use with local history and markdown export.</p>
                    </div>
                  </div>

                  {!sourceType ? (
                    <div className="rounded-2xl border border-border bg-white p-5">
                      <p className="mb-4 text-sm font-semibold text-text-primary">Pick a starter template (optional)</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        {STARTER_TEMPLATES.map((template) => (
                          <button
                            key={template.title}
                            onClick={() => {
                              setSourceType('text');
                              setRawText(template.value);
                            }}
                            className="rounded-xl border border-border p-4 text-left transition hover:border-accent hover:bg-teal-50/40"
                          >
                            <p className="mb-1 font-semibold text-text-primary">{template.title}</p>
                            <p className="line-clamp-3 text-sm text-text-secondary">{template.value}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-border bg-white p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Selected Input</p>
                            <p className="text-sm font-semibold text-text-primary capitalize">{sourceType}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSourceType(null);
                              setSelectedFile(null);
                              setSelectedUrl('');
                              setRawText('');
                            }}
                          >
                            Change
                          </Button>
                        </div>

                        {sourceType === 'text' ? (
                          <textarea
                            placeholder="Paste any long text here..."
                            value={rawText}
                            onChange={(event) => setRawText(event.target.value)}
                            className="h-44 w-full rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent focus:bg-white"
                          />
                        ) : (
                          <FileUploader
                            type={sourceType}
                            selectedFile={selectedFile}
                            selectedUrl={selectedUrl}
                            onFileSelect={setSelectedFile}
                            onUrlSubmit={setSelectedUrl}
                            onClear={() => {
                              setSelectedFile(null);
                              setSelectedUrl('');
                            }}
                          />
                        )}

                        <div className="mt-5 flex justify-end">
                          <Button onClick={handleProcess} isLoading={isProcessing} size="lg" disabled={!canProcess}>
                            Generate Summary
                          </Button>
                        </div>
                      </div>

                      <SummaryConfig style={style} setStyle={setStyle} length={length} setLength={setLength} />
                    </>
                  )}

                  {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={resetDraft} variant="outline" size="sm">
                      <ArrowLeft className="mr-1 h-4 w-4" />
                      New Summary
                    </Button>
                    <Button onClick={exportSummary} variant="secondary" size="sm">
                      <Download className="mr-1 h-4 w-4" />
                      Export Markdown
                    </Button>
                  </div>

                  <SummaryResult summary={summary} sourceType={sourceType || 'content'} />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-white p-5">
              <div className="mb-5 flex items-center justify-between">
                <p className="font-semibold text-text-primary">Recent Summaries</p>
                {history.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearHistory}>
                    <Trash2 className="mr-1 h-4 w-4" />
                    Clear
                  </Button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-10 text-center text-text-secondary">
                  No history yet. Generate your first summary from the Workspace tab.
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => loadFromHistory(entry)}
                      className="w-full rounded-xl border border-border p-4 text-left transition hover:border-accent hover:bg-teal-50/30"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold uppercase tracking-wide">
                          {entry.type}
                        </span>
                        <span>{new Date(entry.date).toLocaleString()}</span>
                        <span>Style: {entry.style}</span>
                        <span>Length: {entry.length}</span>
                      </div>
                      <p className="mb-1 line-clamp-1 font-semibold text-text-primary">{entry.source}</p>
                      <p className="line-clamp-2 text-sm text-text-secondary">{entry.result}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
