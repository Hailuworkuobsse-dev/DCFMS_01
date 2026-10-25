import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadCloud, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

export interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeBytes?: number;
  label?: string;
  helperText?: string;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  accept = '.pdf,.jpg,.jpeg,.png',
  maxSizeBytes = 5 * 1024 * 1024, // 5MB default
  label,
  helperText,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    setError(null);
    if (file.size > maxSizeBytes) {
      setError(
        t('upload.fileTooLarge', 'File size exceeds maximum allowed {{max}} MB', {
          max: (maxSizeBytes / (1024 * 1024)).toFixed(0),
        })
      );
      return;
    }
    setSelectedFile(file);
    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-stone-700">
          {label}
        </label>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`border-2 border-dashed p-4 text-center transition-colors cursor-pointer rounded-none ${
          disabled
            ? 'bg-stone-100 border-stone-200 cursor-not-allowed opacity-60'
            : isDragging
            ? 'border-forest-600 bg-forest-50/50'
            : 'border-stone-300 bg-white hover:border-stone-400 hover:bg-stone-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
            }
          }}
        />

        <div className="flex flex-col items-center justify-center space-y-2">
          {selectedFile ? (
            <div className="flex items-center gap-2 text-forest-700">
              <FileText className="w-6 h-6" />
              <div className="text-left">
                <p className="text-sm font-semibold text-stone-900 truncate max-w-xs">
                  {selectedFile.name}
                </p>
                <p className="text-xs font-mono text-stone-500">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-forest-600 ml-2" />
            </div>
          ) : (
            <>
              <UploadCloud className="w-7 h-7 text-stone-400" />
              <div className="text-xs text-stone-600">
                <span className="font-semibold text-forest-700 hover:underline">
                  {t('upload.clickToUpload', 'Click to upload')}
                </span>{' '}
                {t('upload.orDragAndDrop', 'or drag and drop')}
              </div>
              <p className="text-[11px] text-stone-400 font-mono">
                {helperText || `${accept.toUpperCase()} up to ${(maxSizeBytes / (1024 * 1024)).toFixed(0)}MB`}
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
