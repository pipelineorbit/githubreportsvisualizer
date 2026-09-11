"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { processFile } from "@/lib/fileParser";
import { GitHubBillingReport } from "@/types/billing";

interface FileUploadProps {
  onDataLoaded: (data: GitHubBillingReport) => void;
}

export function FileUpload({ onDataLoaded }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setError(null);
      setSuccess(null);

      try {
        const result = await processFile(file);

        if (result.success && result.data) {
          setSuccess(
            `Loaded ${result.data.diagnostics?.acceptedRows ?? 0} accepted billing records`,
          );
          onDataLoaded(result.data);
        } else {
          setError(result.error || "Failed to process file");
        }
      } catch (err) {
        setError("An unexpected error occurred while processing the file");
      } finally {
        setIsProcessing(false);
      }
    },
    [onDataLoaded],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile],
  );

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 sm:p-8 text-center transition-colors focus-within:ring-2 focus-within:ring-sky-400
          ${
            isDragOver
              ? "border-green-400 bg-green-400/10"
              : "border-gray-600 hover:border-gray-500"
          }
          ${isProcessing ? "opacity-50 pointer-events-none" : ""}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          aria-label="Upload billing CSV"
          accept=".csv"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing}
        />

        <div className="flex flex-col items-center space-y-4">
          <div
            className={`
            w-16 h-16 rounded-full flex items-center justify-center
            ${isDragOver ? "bg-green-400/20" : "bg-gray-700"}
          `}
          >
            {isProcessing ? (
              <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload
                className={`w-8 h-8 ${
                  isDragOver ? "text-green-400" : "text-gray-400"
                }`}
              />
            )}
          </div>

          <div aria-live="polite">
            <p className="text-lg font-medium text-white mb-2">
              {isProcessing
                ? "Processing file..."
                : "Upload your GitHub billing report"}
            </p>
            <p className="text-sm text-gray-400">
              Drag and drop your CSV file here, or click to browse
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Only CSV format is supported
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 p-4 bg-red-900/20 border border-red-700 rounded-lg flex items-center space-x-3"
        >
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mt-4 p-4 bg-green-900/20 border border-green-700 rounded-lg flex items-center space-x-3"
        >
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
          <p className="text-green-300 text-sm">{success}</p>
        </div>
      )}

      <div className="mt-6 text-center">
        <p className="text-xs text-gray-500">
          <FileText className="w-4 h-4 inline mr-1" />
          Your data is processed locally and never stored on our servers
        </p>
      </div>
    </div>
  );
}
