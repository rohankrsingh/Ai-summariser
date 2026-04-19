import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpenCheck,
  Download,
  Eye,
  EyeOff,
  FileText,
  FolderSync,
  KeyRound,
  MessageSquare,
  Music,
  Sparkles,
  Terminal,
  Trash2,
  WandSparkles,
  Youtube,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from './components/reui/alert';
import { Badge } from './components/reui/badge';
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from './components/reui/frame';
import { FileUploader } from './components/FileUploader';
import { SummaryConfig } from './components/SummaryConfig';
import { SummaryResult } from './components/SummaryResult';
import { Button } from './components/Button';
import { cn } from './lib/utils';
import {
  clearRuntimeGeminiApiKey,
  getGeminiApiKeySource,
  hasGeminiApiKey,
  loadRuntimeGeminiApiKey,
  setRuntimeGeminiApiKey,
  summarizeContent,
  SummaryLength,
  SummaryStyle,
} from './services/gemini';

type SourceType = 'pdf' | 'audio' | 'youtube' | 'text' | null;
type WorkspaceView = 'workspace' | 'history';
type ApiKeySource = ReturnType<typeof getGeminiApiKeySource>;

interface HistoryEntry {
  id: number;
  type: Exclude<SourceType, null>;
  source: string;
  result: string;
  date: string;
  style: SummaryStyle;
  length: SummaryLength;
}

const SOURCE_OPTIONS: {
  id: Exclude<SourceType, null>;
  label: string;
  icon: React.ElementType;
  hint: string;
}[] = [
  {
    id: 'youtube',
    label: 'YouTube Video',
    icon: Youtube,
    hint: 'Paste a link and summarize the transcript/story',
  },
  {
    id: 'pdf',
    label: 'PDF Document',
    icon: FileText,
    hint: 'Upload reports, notes, and long PDFs quickly',
  },
  {
    id: 'audio',
    label: 'Audio Recording',
    icon: Music,
    hint: 'Convert voice/audio to concise takeaways',
  },
  {
    id: 'text',
    label: 'Plain Text',
    icon: MessageSquare,
    hint: 'Drop raw content and extract key points',
  },
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

  const [hasApiKey, setHasApiKey] = useState(() => hasGeminiApiKey());
  const [apiKeySource, setApiKeySource] = useState<ApiKeySource>(() => getGeminiApiKeySource());
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyNotice, setApiKeyNotice] = useState<string | null>(null);

  const refreshApiKeyStatus = () => {
    setHasApiKey(hasGeminiApiKey());
    setApiKeySource(getGeminiApiKeySource());
  };

  useEffect(() => {
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

  useEffect(() => {
    const runtimeKey = loadRuntimeGeminiApiKey();
    if (runtimeKey) {
      setApiKeyInput(runtimeKey);
    }
    refreshApiKeyStatus();
  }, []);

  const stats = useMemo(() => {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const thisWeek = history.filter(
      (entry) => now - new Date(entry.date).getTime() <= sevenDaysMs,
    ).length;
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
    hasApiKey &&
    !isProcessing &&
    ((sourceType === 'text' && rawText.trim().length > 0) ||
      (sourceType === 'youtube' && selectedUrl.trim().length > 0) ||
      ((sourceType === 'pdf' || sourceType === 'audio') && Boolean(selectedFile)));

  const handleSaveApiKey = () => {
    const normalized = apiKeyInput.trim();
    if (!normalized) {
      setApiKeyNotice('Enter a Gemini API key before saving.');
      return;
    }

    setRuntimeGeminiApiKey(normalized);
    setApiKeyInput(normalized);
    refreshApiKeyStatus();
    setApiKeyNotice('Runtime API key saved in this browser.');
    setError(null);
  };

  const handleClearApiKey = () => {
    clearRuntimeGeminiApiKey();
    setApiKeyInput('');
    refreshApiKeyStatus();
    setError(null);

    if (getGeminiApiKeySource() === 'environment') {
      setApiKeyNotice('Runtime key cleared. Falling back to .env.local key.');
      return;
    }

    setApiKeyNotice('Runtime key cleared. Add a key to enable AI actions.');
  };

  const handleProcess = async () => {
    if (!canProcess || !sourceType) return;

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
      const message =
        processError instanceof Error ? processError.message : 'Unknown processing error.';
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-4 lg:flex-row lg:gap-6 lg:p-6">
        <aside className="w-full lg:w-80">
          <Frame spacing="sm">
            <FramePanel>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <WandSparkles className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-heading text-lg font-bold tracking-tight">Summora</h1>
                  <p className="text-xs text-muted-foreground">Personal AI Summary Workspace</p>
                </div>
              </div>

              <Tabs
                value={view}
                onValueChange={(value) => setView(value as WorkspaceView)}
                className="mb-5"
              >
                <TabsList className="w-full">
                  <TabsTrigger value="workspace" className="flex-1">
                    Workspace
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex-1">
                    History
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {view === 'workspace' && (
                <div className="space-y-2">
                  <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Input Channel
                  </p>
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
                          ? 'border-primary/40 bg-muted'
                          : 'border-transparent bg-transparent hover:border-border hover:bg-muted/60',
                      )}
                    >
                      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                        <item.icon className="h-4 w-4 text-primary" />
                        {item.label}
                        {sourceType === item.id && (
                          <Badge variant="success-light" size="sm" className="ml-auto">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{item.hint}</p>
                    </button>
                  ))}
                </div>
              )}

              <Frame className="mt-5" spacing="xs">
                <FramePanel>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold text-foreground">API Settings</p>
                    </div>
                    {apiKeySource === 'runtime' && (
                      <Badge variant="success-light" size="sm">
                        Runtime
                      </Badge>
                    )}
                    {apiKeySource === 'environment' && (
                      <Badge variant="info-light" size="sm">
                        .env.local
                      </Badge>
                    )}
                    {!apiKeySource && (
                      <Badge variant="warning-light" size="sm">
                        Missing
                      </Badge>
                    )}
                  </div>

                  <div className="relative">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="Paste Gemini API key (AIza...)"
                      value={apiKeyInput}
                      onChange={(event) => {
                        setApiKeyInput(event.target.value);
                        if (apiKeyNotice) setApiKeyNotice(null);
                      }}
                      className="bg-background pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((prev) => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
                      aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={handleSaveApiKey}>
                      {apiKeySource === 'runtime' ? 'Update Key' : 'Save Key'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearApiKey}
                      disabled={apiKeySource !== 'runtime'}
                    >
                      Clear Runtime Key
                    </Button>
                  </div>

                  <Alert variant={hasApiKey ? 'success' : 'warning'} className="mt-3">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Key Status</AlertTitle>
                    <AlertDescription>
                      <p>
                        {hasApiKey
                          ? apiKeySource === 'runtime'
                            ? 'Using runtime key saved in this browser.'
                            : 'Using environment key from .env.local.'
                          : 'No Gemini API key configured yet.'}
                      </p>
                    </AlertDescription>
                  </Alert>

                  {apiKeyNotice && (
                    <p className="mt-2 text-xs text-muted-foreground">{apiKeyNotice}</p>
                  )}
                </FramePanel>
              </Frame>
            </FramePanel>
          </Frame>
        </aside>

        <main className="flex-1 space-y-4">
          <Frame spacing="sm">
            <FrameHeader>
              <FrameTitle className="font-heading text-2xl font-bold tracking-tight">
                {view === 'workspace' ? 'Workspace' : 'Summary History'}
              </FrameTitle>
              <FrameDescription>
                {view === 'workspace'
                  ? 'Summarize faster with consistent output styles and instant follow-up chat.'
                  : 'Your recent summaries stay local in browser storage for personal use.'}
              </FrameDescription>
            </FrameHeader>
            <FramePanel>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-border bg-background px-3 py-2">
                  <p className="text-lg font-bold text-foreground">{stats.total}</p>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</p>
                </div>
                <div className="rounded-xl border border-border bg-background px-3 py-2">
                  <p className="text-lg font-bold text-foreground">{stats.thisWeek}</p>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">This Week</p>
                </div>
                <div className="rounded-xl border border-border bg-background px-3 py-2">
                  <p className="text-lg font-bold text-foreground">{stats.avgSize}</p>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Avg Chars</p>
                </div>
              </div>
            </FramePanel>
          </Frame>

          {view === 'workspace' ? (
            <div className="space-y-4">
              {!summary ? (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Frame>
                      <FramePanel>
                        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <BookOpenCheck className="h-4 w-4" />
                        </div>
                        <p className="font-semibold text-foreground">Structured Summaries</p>
                        <p className="text-sm text-muted-foreground">
                          Choose bullet points, prose, executive notes, or action items.
                        </p>
                      </FramePanel>
                    </Frame>
                    <Frame>
                      <FramePanel>
                        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-info/10 text-info-foreground">
                          <FolderSync className="h-4 w-4" />
                        </div>
                        <p className="font-semibold text-foreground">Reusable History</p>
                        <p className="text-sm text-muted-foreground">
                          Open any previous output and keep asking follow-up questions.
                        </p>
                      </FramePanel>
                    </Frame>
                    <Frame>
                      <FramePanel>
                        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 text-success-foreground">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <p className="font-semibold text-foreground">Personal Workflow</p>
                        <p className="text-sm text-muted-foreground">
                          Built for solo use with local history and markdown export.
                        </p>
                      </FramePanel>
                    </Frame>
                  </div>

                  {!sourceType ? (
                    <Frame>
                      <FramePanel>
                        <p className="mb-4 text-sm font-semibold text-foreground">
                          Pick a starter template (optional)
                        </p>
                        <div className="grid gap-3 md:grid-cols-2">
                          {STARTER_TEMPLATES.map((template) => (
                            <button
                              key={template.title}
                              onClick={() => {
                                setSourceType('text');
                                setRawText(template.value);
                              }}
                              className="rounded-xl border border-border p-4 text-left transition hover:border-primary/40 hover:bg-muted"
                            >
                              <p className="mb-1 font-semibold text-foreground">{template.title}</p>
                              <p className="line-clamp-3 text-sm text-muted-foreground">{template.value}</p>
                            </button>
                          ))}
                        </div>
                      </FramePanel>
                    </Frame>
                  ) : (
                    <>
                      <Frame>
                        <FramePanel>
                          <div className="mb-4 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Selected Input
                              </p>
                              <p className="text-sm font-semibold capitalize text-foreground">
                                {sourceType}
                              </p>
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
                            <Textarea
                              placeholder="Paste any long text here..."
                              value={rawText}
                              onChange={(event) => setRawText(event.target.value)}
                              className="min-h-44 bg-muted/40"
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

                          <div className="mt-5 flex flex-col items-end gap-2">
                            <Button
                              onClick={handleProcess}
                              isLoading={isProcessing}
                              size="lg"
                              disabled={!canProcess}
                            >
                              Generate Summary
                            </Button>
                            {!hasApiKey && (
                              <p className="text-xs text-muted-foreground">
                                Configure an API key in sidebar settings to enable generation.
                              </p>
                            )}
                          </div>
                        </FramePanel>
                      </Frame>

                      <SummaryConfig
                        style={style}
                        setStyle={setStyle}
                        length={length}
                        setLength={setLength}
                      />
                    </>
                  )}

                  {error && (
                    <Alert variant="destructive">
                      <Terminal className="h-4 w-4" />
                      <AlertTitle>Analysis Failed</AlertTitle>
                      <AlertDescription>
                        <p className="whitespace-pre-wrap break-words">{error}</p>
                      </AlertDescription>
                    </Alert>
                  )}
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
                    <Badge variant="info-light" size="default">
                      Tailwind v4 + ReUI
                    </Badge>
                  </div>

                  <SummaryResult summary={summary} sourceType={sourceType || 'content'} />
                </div>
              )}
            </div>
          ) : (
            <Frame>
              <FramePanel>
                <div className="mb-5 flex items-center justify-between">
                  <p className="font-semibold text-foreground">Recent Summaries</p>
                  {history.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearHistory}>
                      <Trash2 className="mr-1 h-4 w-4" />
                      Clear
                    </Button>
                  )}
                </div>

                {history.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
                    No history yet. Generate your first summary from the Workspace tab.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => loadFromHistory(entry)}
                        className="w-full rounded-xl border border-border p-4 text-left transition hover:border-primary/40 hover:bg-muted"
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" size="sm" radius="full" className="uppercase">
                            {entry.type}
                          </Badge>
                          <span>{new Date(entry.date).toLocaleString()}</span>
                          <span>Style: {entry.style}</span>
                          <span>Length: {entry.length}</span>
                        </div>
                        <p className="mb-1 line-clamp-1 font-semibold text-foreground">
                          {entry.source}
                        </p>
                        <p className="line-clamp-2 text-sm text-muted-foreground">{entry.result}</p>
                      </button>
                    ))}
                  </div>
                )}
              </FramePanel>
            </Frame>
          )}
        </main>
      </div>
    </div>
  );
}
