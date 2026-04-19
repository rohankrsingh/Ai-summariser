import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, MessageSquare, BookOpen, Copy, Check } from 'lucide-react';
import { chatWithContent } from '../services/gemini';
import { cn } from '../lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from './Button';

interface Message {
  role: 'user' | 'model';
  content: string;
}

interface SummaryResultProps {
  summary: string;
  sourceType: string;
}

export function SummaryResult({ summary, sourceType }: SummaryResultProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    try {
      const history = [
        {
          role: 'user' as const,
          parts: [{ text: `Here is the summary of the ${sourceType}: ${summary}` }],
        },
        {
          role: 'model' as const,
          parts: [{ text: 'I have analyzed the content. How can I help you today?' }],
        },
        ...messages.map((m) => ({
          role: m.role,
          parts: [{ text: m.content }],
        })),
      ];

      const response = await chatWithContent(history, userMessage);
      setMessages((prev) => [
        ...prev,
        { role: 'model', content: response || "I'm sorry, I couldn't generate a response." },
      ]);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Could not connect to the AI service.';
      setMessages((prev) => [...prev, { role: 'model', content: `Error: ${message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid h-full min-h-[600px] grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Summary View */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Executive Summary
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy to Clipboard'}
            </button>
          </div>
        </div>
        <div className="flex-1 p-8 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="markdown-body">
            <ReactMarkdown>{summary}</ReactMarkdown>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border bg-muted/40 p-4">
          <span className="rounded-md bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Extracted
          </span>
          <span className="rounded-md bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            AI Verified
          </span>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Insights and Chat
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-success" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-success-foreground">
              Active
            </span>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="custom-scrollbar flex-1 space-y-6 overflow-y-auto bg-card p-6"
        >
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center space-y-4 p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted">
                <MessageSquare className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground">In-depth Analysis</h3>
                <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">
                  Ask me questions about specific insights, themes, or metrics from the content.
                </p>
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                'flex max-w-[90%] flex-col',
                m.role === 'user' ? 'ml-auto items-end' : 'items-start',
              )}
            >
              <div
                className={cn(
                  'rounded-2xl p-3.5 text-[13px] leading-relaxed',
                  m.role === 'user'
                    ? 'rounded-tr-none bg-primary text-primary-foreground'
                    : 'rounded-tl-none border border-border bg-muted text-foreground',
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="pl-1 text-[11px] italic text-muted-foreground">
              Analyzing source data...
            </div>
          )}
        </div>

        <div className="border-t border-border bg-card p-4">
          <div className="relative flex gap-2">
            <Input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              placeholder="Ask a question..."
              className="h-10 flex-1"
            />
            <Button
              onClick={handleSend}
              size="md"
              disabled={!input.trim() || isTyping}
              className="h-10 px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
