"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, X, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { validateDocument, DocumentValidationResult } from "@/lib/kyc/document-validation";
import { motion } from "framer-motion";

interface DocumentUploadProps {
  label: string;
  accept?: string;
  maxSizeMB?: number;
  value?: string; // base64
  onChange: (base64: string | undefined) => void;
  onOcrDataChange?: (ocrData: { extractedText: string; matchedKeywords: string[] } | undefined) => void;
  required?: boolean;
}

export function DocumentUpload({
  label,
  accept = "image/*,application/pdf",
  maxSizeMB = 10,
  value,
  onChange,
  onOcrDataChange,
  required = false,
}: DocumentUploadProps) {
  const [preview, setPreview] = useState<string | null>(value || null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<DocumentValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    setError(null);
    setIsUploading(true);

    try {
      // Validate file size
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > maxSizeMB) {
        throw new Error(`File size exceeds ${maxSizeMB}MB limit`);
      }

      // Validate file type
      const validTypes = accept.split(",").map((t) => t.trim());
      const isValidType = validTypes.some((type) => {
        if (type.endsWith("/*")) {
          return file.type.startsWith(type.split("/")[0] + "/");
        }
        return file.type === type;
      });

      if (!isValidType) {
        throw new Error(`Invalid file type. Accepted: ${accept}`);
      }

      // Convert to base64
      const base64 = await fileToBase64(file);
      
      // Validate document (only for documentFront - required documents)
      if (required) {
        setIsValidating(true);
        setValidationResult(null);
        try {
          const validation = await validateDocument(base64);
          setValidationResult(validation);
          
          if (!validation.isValid) {
            setError(validation.reason || "Invalid document. Please upload a valid government-issued ID.");
            setPreview(null);
            onChange(undefined);
            onOcrDataChange?.(undefined);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
            setIsValidating(false);
            return;
          }
          
          // Pass OCR data to parent if validation succeeded
          if (validation.ocrData && onOcrDataChange) {
            onOcrDataChange(validation.ocrData);
          }
        } catch (err: any) {
          console.error("Document validation error:", err);
          setError("Failed to validate document. Please try again.");
          setPreview(null);
          onChange(undefined);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          setIsValidating(false);
          return;
        } finally {
          setIsValidating(false);
        }
      }
      
      setPreview(base64);
      onChange(base64);
    } catch (err: any) {
      setError(err.message || "Failed to process file");
      onChange(undefined);
    } finally {
      setIsUploading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to convert file to base64"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(undefined);
    setError(null);
    setValidationResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label} {required && <span className="text-red-400">*</span>}
      </Label>

      {/* Validation Loading */}
      {isValidating && (
        <div className="border border-blue-500/50 bg-blue-500/10 rounded-lg p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          <span className="text-blue-400">Validating document...</span>
        </div>
      )}

      {!preview ? (
        <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center hover:border-white/40 transition-colors">
          <div className="space-y-4">
            <div className="flex justify-center">
              <Upload className="w-12 h-12 text-white/40" />
            </div>
            <div>
              <p className="text-sm text-white/60 mb-2">
                Drag and drop or click to upload
              </p>
              <p className="text-xs text-white/40">
                Max size: {maxSizeMB}MB | Accepted: {accept}
              </p>
              {required && (
                <p className="text-xs text-yellow-400 mt-1">
                  Must be a government-issued ID (Passport, National ID, Driver License)
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isValidating}
              >
                <FileText className="w-4 h-4 mr-2" />
                Choose File
              </Button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="relative border border-white/20 rounded-lg p-4">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              {preview.startsWith("data:image") ? (
                <img
                  src={preview}
                  alt="Preview"
                  className="w-20 h-20 object-cover rounded"
                />
              ) : (
                <div className="w-20 h-20 bg-white/10 rounded flex items-center justify-center">
                  <FileText className="w-8 h-8 text-white/40" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-sm text-white/80">
                  {validationResult?.isValid ? "Valid document" : "File uploaded"}
                </span>
              </div>
              <p className="text-xs text-white/40">
                {validationResult?.documentType || (preview.startsWith("data:image") ? "Image" : "PDF")} file ready
                {validationResult?.hasFace && " • Face photo detected"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {error && (
        <Alert className="border-red-500/50 bg-red-500/10">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-400 text-sm">
            {error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

