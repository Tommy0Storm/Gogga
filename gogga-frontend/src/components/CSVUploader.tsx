'use client';

/**
 * GOGGA CSV Uploader Component
 * 
 * Handles CSV file upload with:
 * - PapaParse for parsing
 * - Auto-detection of headers, types, and delimiters
 * - File size validation (max 5MB)
 * - Support for .csv and .tsv files
 */

import React, { useState, useCallback } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import { ParsedCSVData } from '@/types/chart';

// =============================================================================
// Types
// =============================================================================

interface CSVUploaderProps {
  onDataParsed: (data: ParsedCSVData) => void;
  onClose?: () => void;
  maxFileSize?: number; // in bytes, default 5MB
  className?: string;
}

interface ParseError {
  message: string;
  row?: number;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const SUPPORTED_EXTENSIONS = ['.csv', '.tsv'];

// =============================================================================
// Component
// =============================================================================

export const CSVUploader: React.FC<CSVUploaderProps> = ({
  onDataParsed,
  onClose,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  /**
   * Detect column types from parsed data
   */
  const detectColumnTypes = (
    headers: string[],
    rows: Record<string, unknown>[]
  ): Record<string, 'string' | 'number' | 'date'> => {
    const types: Record<string, 'string' | 'number' | 'date'> = {};
    
    headers.forEach(header => {
      let numberCount = 0;
      let dateCount = 0;
      let sampleSize = Math.min(rows.length, 20); // Sample first 20 rows
      
      for (let i = 0; i < sampleSize; i++) {
        const row = rows[i];
        if (!row) continue;
        const value = row[header];
        if (value === null || value === undefined || value === '') continue;
        
        const strValue = String(value).trim();
        
        // Check if number
        if (!isNaN(Number(strValue)) && strValue !== '') {
          numberCount++;
          continue;
        }
        
        // Check if date (common formats)
        const datePatterns = [
          /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
          /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY or DD/MM/YYYY
          /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY or DD-MM-YYYY
        ];
        
        if (datePatterns.some(pattern => pattern.test(strValue))) {
          dateCount++;
        }
      }
      
      // Determine type based on majority
      if (numberCount > sampleSize * 0.8) {
        types[header] = 'number';
      } else if (dateCount > sampleSize * 0.8) {
        types[header] = 'date';
      } else {
        types[header] = 'string';
      }
    });
    
    return types;
  };

  /**
   * Parse CSV file content
   */
  const parseFile = useCallback((file: File) => {
    setIsLoading(true);
    setError(null);
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        setIsLoading(false);
        
        if (results.errors.length > 0) {
          const firstError = results.errors[0];
          if (firstError) {
            setError(`Parse error: ${firstError.message}${firstError.row !== undefined ? ` (row ${firstError.row})` : ''}`);
          } else {
            setError('Parse error occurred');
          }
          return;
        }
        
        const rows = results.data as Record<string, unknown>[];
        const headers = results.meta.fields || [];
        
        if (rows.length === 0 || headers.length === 0) {
          setError('No data found in file');
          return;
        }
        
        const columnTypes = detectColumnTypes(headers, rows);
        
        const parsedData: ParsedCSVData = {
          headers,
          rows,
          columnTypes,
          rowCount: rows.length,
          meta: {
            delimiter: results.meta.delimiter,
            hasHeaders: true,
            filename: file.name,
          },
        };
        
        onDataParsed(parsedData);
      },
      error: (error) => {
        setIsLoading(false);
        setError(`Failed to parse file: ${error.message}`);
      },
    });
  }, [onDataParsed]);

  /**
   * Validate and process file
   */
  const processFile = useCallback((file: File) => {
    // Validate file extension
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      setError(`Unsupported file type. Please upload a ${SUPPORTED_EXTENSIONS.join(' or ')} file.`);
      return;
    }
    
    // Validate file size
    if (file.size > maxFileSize) {
      const maxSizeMB = (maxFileSize / (1024 * 1024)).toFixed(1);
      setError(`File too large. Maximum size is ${maxSizeMB}MB.`);
      return;
    }
    
    parseFile(file);
  }, [maxFileSize, parseFile]);

  /**
   * Handle file input change
   */
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset input to allow selecting same file again
    event.target.value = '';
  }, [processFile]);

  /**
   * Handle drag and drop events
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  return (
    <div className={`bg-white rounded-xl border border-primary-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary-100 bg-primary-50">
        <div className="flex items-center gap-2">
          <Upload size={18} className="text-primary-600" />
          <h3 className="font-semibold text-primary-800 text-sm" style={{ fontFamily: 'Quicksand, sans-serif' }}>
            Upload CSV Data
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-primary-100 text-primary-500 hover:text-primary-700 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Drop Zone */}
      <div className="p-4">
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center transition-all
            ${isDragging 
              ? 'border-primary-500 bg-primary-50' 
              : 'border-primary-200 hover:border-primary-400 hover:bg-primary-50/50'
            }
            ${isLoading ? 'opacity-50 pointer-events-none' : ''}
          `}
        >
          <input
            type="file"
            accept=".csv,.tsv"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isLoading}
          />
          
          <div className="flex flex-col items-center gap-3">
            {isLoading ? (
              <>
                <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-primary-600" style={{ fontFamily: 'Quicksand, sans-serif' }}>
                  Parsing {fileName}...
                </p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                  <FileText size={24} className="text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-primary-700" style={{ fontFamily: 'Quicksand, sans-serif' }}>
                    Drop your CSV file here
                  </p>
                  <p className="text-xs text-primary-500 mt-1" style={{ fontFamily: 'Quicksand, sans-serif' }}>
                    or click to browse • Max 5MB
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700" style={{ fontFamily: 'Quicksand, sans-serif' }}>
              {error}
            </p>
          </div>
        )}

        {/* Supported Formats */}
        <div className="mt-4 text-center">
          <p className="text-xs text-primary-400" style={{ fontFamily: 'Quicksand, sans-serif' }}>
            Supported formats: CSV, TSV • Auto-detects headers and data types
          </p>
        </div>
      </div>
    </div>
  );
};

export default CSVUploader;
