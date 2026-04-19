import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, MessageSquare, BookOpen, Copy, Check } from 'lucide-react';
import { chatWithContent } from '../services/gemini';
import { cn } from '../lib/utils';

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
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    try {
      const history = [
        { role: 'user' as const, parts: [{ text: `Here is the summary of the ${sourceType}: ${summary}` }] },
        { role: 'model' as const, parts: [{ text: "I have analyzed the content. How can I help you today?" }] },
        ...messages.map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        }))
      ];

      const response = await chatWithContent(history, userMessage);
      setMessages(prev => [...prev, { role: 'model', content: response || "I'm sorry, I couldn't generate a response." }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', content: "Error: Could not connect to the AI service." }]);
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full min-h-[600px] animate-in slide-in-from-bottom-8 duration-700">
      {/* Summary View */}
      <div className="flex flex-col bg-white rounded-2xl border border-border overflow-hidden card-shadow">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-accent" />
            <span className="text-sm font-bold text-text-primary uppercase tracking-wider">Executive Summary</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={copyToClipboard}
              className="text-xs font-semibold text-accent hover:underline flex items-center gap-1.5"
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
        <div className="p-6 border-t border-border bg-slate-50/50 flex flex-wrap gap-2">
           <span className="px-2 py-1 bg-slate-200 rounded text-[10px] font-bold text-slate-600 uppercase tracking-tight">Extracted</span>
           <span className="px-2 py-1 bg-slate-200 rounded text-[10px] font-bold text-slate-600 uppercase tracking-tight">AI Verified</span>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex flex-col bg-white rounded-2xl border border-border overflow-hidden h-full card-shadow">
        <div className="px-6 py-4 border-b border-border bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-bold text-text-primary uppercase tracking-wider">Insights & Chat</span>
          </div>
          <div className="status-badge flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Active</span>
          </div>
        </div>

        <div 
          ref={scrollRef}
          className="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar bg-white"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm">
                <MessageSquare className="w-6 h-6 text-slate-300" />
              </div>
              <div className="space-y-1">
                <h3 className="text-text-primary font-bold">In-depth Analysis</h3>
                <p className="text-xs text-text-secondary max-w-[200px] leading-relaxed">
                  Ask me questions about specific insights, themes, or metrics from the content.
                </p>
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div 
              key={i} 
              className={cn(
                "flex flex-col max-w-[90%]",
                m.role === 'user' ? "ml-auto items-end" : "items-start"
              )}
            >
              <div 
                className={cn(
                  "p-3.5 rounded-2xl text-[13px] leading-relaxed shadow-sm",
                  m.role === 'user' 
                    ? "bg-accent text-white rounded-tr-none" 
                    : "bg-slate-50 text-text-primary rounded-tl-none border border-border"
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex items-center gap-2 text-text-secondary italic text-[11px] font-medium pl-1">
              Analyzing source data...
            </div>
          )}
        </div>

        <div className="p-4 bg-white border-t border-border">
          <div className="relative flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              placeholder="Ask a question..."
              className="flex-1 bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-slate-400 focus:bg-white focus:border-accent outline-none transition-all"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="px-4 bg-accent hover:bg-blue-600 text-white rounded-xl transition-all disabled:opacity-50 shadow-sm shadow-blue-500/10 flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
