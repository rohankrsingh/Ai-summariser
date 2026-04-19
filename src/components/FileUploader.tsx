import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Music, Youtube, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './Button';
import { Input } from '@/components/ui/input';

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
  type,
}: FileUploaderProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const acceptMap = {
    pdf: { 'application/pdf': ['.pdf'] },
    audio: { 'audio/*': ['.mp3', '.wav', '.m4a'] },
    youtube: {},
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: type !== 'youtube' ? acceptMap[type] : undefined,
    multiple: false,
  });

  if (selectedFile || selectedUrl) {
    return (
      <div className="relative rounded-xl border border-border bg-card p-5 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-muted p-3 text-primary">
            {type === 'pdf' && <FileText className="w-6 h-6" />}
            {type === 'audio' && <Music className="w-6 h-6" />}
            {type === 'youtube' && <Youtube className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {selectedFile ? selectedFile.name : selectedUrl}
            </p>
            <p className="mt-1 text-xs capitalize text-muted-foreground">{type} resource ready</p>
          </div>
          <button
            onClick={onClear}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  if (type === 'youtube') {
    return (
      <div className="rounded-xl border-2 border-dashed border-border bg-card p-6 transition-colors hover:border-ring/50">
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-full bg-muted p-4 text-primary">
            <Youtube className="w-8 h-8" />
          </div>
          <p className="text-center font-semibold text-foreground">Enter YouTube video URL</p>
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Input
              type="text"
              placeholder="https://youtube.com/watch?v=..."
              className="h-10 flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onUrlSubmit((e.target as HTMLInputElement).value);
              }}
            />
            <Button
              className="h-10"
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
        'group relative cursor-pointer rounded-xl border-2 border-dashed bg-card p-8 transition-colors',
        isDragActive ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-ring/50',
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-5">
        <div className="rounded-full bg-muted p-5 text-muted-foreground transition-all duration-300 group-hover:scale-105 group-hover:text-primary">
          <Upload className="w-8 h-8" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">
            {isDragActive ? 'Drop the file here' : 'Drag and drop your file'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {type === 'pdf' ? 'PDF documents (up to 20MB)' : 'Audio files (MP3, WAV, M4A)'}
          </p>
        </div>
      </div>
    </div>
  );
}
