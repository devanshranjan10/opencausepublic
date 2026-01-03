"use client";

import { useState, useRef } from "react";
import { Button } from "./button";
import { motion } from "framer-motion";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { getApiUrl } from "@/lib/api";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  className?: string;
}

export function ImageUpload({ value, onChange, label = "Campaign Image", className = "" }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(value || null);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(value || "");
  const [useUrl, setUseUrl] = useState(!!value);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB");
      return;
    }

    setUploading(true);

    try {
      // Upload to Firebase Storage via API
      const formData = new FormData();
      formData.append("files", file); // Use "files" to match the expected field name

      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication required");
      }

      const apiUrl = getApiUrl();
      const result = await fetch(`${apiUrl}/uploads/campaign-image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!result.ok) {
        const error = await result.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(error.message || "File upload failed");
      }

      const uploadResult = await result.json();
      const imageUrl = uploadResult.url;
      
      setPreview(imageUrl);
      onChange(imageUrl);
      setImageUrl(imageUrl);
      setUseUrl(true);
      setUploading(false);
    } catch (error: any) {
      console.error("Error uploading image:", error);
      alert(error.message || "Failed to upload image");
      setUploading(false);
    }
  };

  const handleUrlChange = (url: string) => {
    setImageUrl(url);
    if (url.trim()) {
      setPreview(url);
      onChange(url);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setImageUrl("");
    onChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className={className}>
      <label className="block mb-2 text-sm font-medium">{label}</label>
      
      {/* Toggle between URL and Upload */}
      <div className="flex gap-2 mb-3">
        <Button
          type="button"
          variant={!useUrl ? "default" : "outline"}
          size="sm"
          onClick={() => setUseUrl(false)}
          className="flex-1"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload
        </Button>
        <Button
          type="button"
          variant={useUrl ? "default" : "outline"}
          size="sm"
          onClick={() => setUseUrl(true)}
          className="flex-1"
        >
          <ImageIcon className="w-4 h-4 mr-2" />
          URL
        </Button>
      </div>

      {!useUrl ? (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="image-upload"
          />
          <label
            htmlFor="image-upload"
            className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
          >
            {uploading ? (
              <div className="text-white/60">Uploading...</div>
            ) : preview ? (
              <div className="relative w-full h-full">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-full object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRemove();
                  }}
                  className="absolute top-2 right-2 p-2 bg-black/80 rounded-full hover:bg-black transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 text-white/40 mb-4" />
                <p className="text-sm text-white/60 mb-2">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-white/40">PNG, JPG, GIF up to 5MB</p>
              </>
            )}
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="url"
            value={imageUrl || ""}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          {preview && (
            <div className="relative">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-48 object-cover rounded-lg"
                onError={() => {
                  setPreview(null);
                  alert("Failed to load image from URL");
                }}
              />
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-2 right-2 p-2 bg-black/80 rounded-full hover:bg-black transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
