import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Music, Youtube, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './Button';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  onUrlSubmit: (url: string) => void;
  selectedFile: File | null;
  selectedUrl: string;
  onClear: () => void;
  type: 'pdf' | 'audio' | 'youtube';
}

export function FileUploader({ 
  onFileSelect, 
  onUrlSubmit, 
  selectedFile, 
  selectedUrl, 
  onClear,
  type 
}: FileUploaderProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const acceptMap = {
    pdf: { 'application/pdf': ['.pdf'] },
    audio: { 'audio/*': ['.mp3', '.wav', '.m4a'] },
    youtube: {}
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: type !== 'youtube' ? acceptMap[type] : undefined,
    multiple: false
  });

  if (selectedFile || selectedUrl) {
    return (
      <div className="relative group border border-border bg-white p-6 rounded-xl overflow-hidden card-shadow animate-in fade-in zoom-in duration-300">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-accent/10 text-accent">
            {type === 'pdf' && <FileText className="w-6 h-6" />}
            {type === 'audio' && <Music className="w-6 h-6" />}
            {type === 'youtube' && <Youtube className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">
              {selectedFile ? selectedFile.name : selectedUrl}
            </p>
            <p className="text-xs text-text-secondary mt-1 capitalize">
              {type} Resource Ready
            </p>
          </div>
          <button 
            onClick={onClear}
            className="p-2 rounded-full hover:bg-slate-100 text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  if (type === 'youtube') {
    return (
      <div className="bg-white p-8 rounded-xl border-2 border-dashed border-border card-shadow transition-all hover:border-slate-300">
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 rounded-full bg-slate-50 text-accent">
            <Youtube className="w-8 h-8" />
          </div>
          <p className="text-text-primary font-semibold">Enter YouTube Video URL</p>
          <div className="w-full flex gap-3">
            <input 
              type="text" 
              placeholder="https://youtube.com/watch?v=..." 
              className="flex-1 bg-white border border-border rounded-lg px-4 py-3 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all shadow-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onUrlSubmit((e.target as HTMLInputElement).value);
              }}
            />
            <Button 
              onClick={(e) => {
                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                onUrlSubmit(input.value);
              }}
            >
              Analyze
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      {...getRootProps()} 
      className={cn(
        "cursor-pointer group relative bg-white p-12 rounded-xl border-2 border-dashed transition-all duration-300 card-shadow",
        isDragActive ? "border-accent bg-accent/[0.02]" : "border-border hover:border-slate-300"
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-5">
        <div className="p-5 rounded-full bg-slate-50 text-text-secondary group-hover:scale-105 group-hover:bg-accent/10 group-hover:text-accent transition-all duration-500">
          <Upload className="w-8 h-8" />
        </div>
        <div className="text-center">
          <p className="text-text-primary font-bold text-lg">
            {isDragActive ? "Drop the file here" : "Drag & drop your file"}
          </p>
          <p className="text-sm text-text-secondary mt-1">
            {type === 'pdf' ? "PDF Documents (upto 20MB)" : "Audio Files (MP3, WAV, M4A)"}
          </p>
        </div>
      </div>
    </div>
  );
}
