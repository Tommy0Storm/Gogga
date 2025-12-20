'use client';

import { Upload, X } from 'lucide-react';
import { useState, useCallback, DragEvent } from 'react';
import { cn } from '@/lib/utils';

interface DragDropZoneProps {
  onFilesDropped: (files: File[]) => void;
  accept?: string[];
  maxSize?: number; // in bytes
  disabled?: boolean;
  className?: string;
}

export function DragDropZone({
  onFilesDropped,
  accept = ['.pdf', '.txt', '.md', '.docx'],
  maxSize = 10 * 1024 * 1024, // 10MB default
  disabled = false,
  className,
}: DragDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);

  const validateFiles = useCallback((files: File[]): { valid: File[]; error: string | null } => {
    const valid: File[] = [];
    
    for (const file of files) {
      // Check file extension
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!accept.includes(ext)) {
        return { valid: [], error: `Unsupported file type: ${ext}` };
      }
      
      // Check file size
      if (file.size > maxSize) {
        const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
        return { valid: [], error: `File too large. Maximum size: ${maxMB}MB` };
      }
      
      valid.push(file);
    }
    
    return { valid, error: null };
  }, [accept, maxSize]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const { valid, error } = validateFiles(files);

    if (error) {
      setDragError(error);
      setTimeout(() => setDragError(null), 3000);
      return;
    }

    if (valid.length > 0) {
      onFilesDropped(valid);
    }
  }, [disabled, validateFiles, onFilesDropped]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
      setDragError(null);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the drop zone entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || !e.target.files) return;
    
    const files = Array.from(e.target.files);
    const { valid, error } = validateFiles(files);

    if (error) {
      setDragError(error);
      setTimeout(() => setDragError(null), 3000);
      return;
    }

    if (valid.length > 0) {
      onFilesDropped(valid);
    }
    
    // Reset input
    e.target.value = '';
  }, [disabled, validateFiles, onFilesDropped]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200',
        isDragging && 'border-primary-500 bg-primary-50 scale-[1.02]',
        !isDragging && 'border-gray-300 hover:border-gray-400',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {/* Animated upload icon */}
      <div className={cn(
        'mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-all',
        isDragging ? 'bg-primary-100 scale-110' : 'bg-gray-100'
      )}>
        <Upload className={cn(
          'transition-all',
          isDragging ? 'text-primary-600 scale-125' : 'text-gray-400'
        )} size={28} />
      </div>

      <p className="text-lg font-medium text-gray-700 mb-1">
        {isDragging ? 'Drop files here' : 'Drag & drop files'}
      </p>
      <p className="text-sm text-gray-500">
        or{' '}
        <label className="text-primary-600 hover:underline cursor-pointer">
          browse
          <input
            id="dragdrop-file-input"
            name="dragdrop-file-input"
            type="file"
            className="hidden"
            accept={accept.join(',')}
            multiple
            onChange={handleFileInput}
            disabled={disabled}
          />
        </label>
        {' '}to upload
      </p>
      <p className="text-xs text-gray-400 mt-2">
        Supports: {accept.join(', ')} (max {(maxSize / (1024 * 1024)).toFixed(0)}MB)
      </p>

      {dragError && (
        <p className="mt-2 text-sm text-red-600 flex items-center justify-center gap-1">
          <X size={14} /> {dragError}
        </p>
      )}
    </div>
  );
}
