"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { detectFace, isFacePositioned, calculateFaceQuality, captureImageFromVideo } from "@/lib/kyc/face-detection";
import { FaceData, FaceDetectionResult } from "@/lib/kyc/types";
import { KYC_CONFIG } from "@/lib/kyc/config";
import { AlertCircle, CheckCircle2, Camera, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FaceCaptureProps {
  onCapture: (faceData: FaceData) => void;
  onError?: (error: string) => void;
}

export function FaceCapture({ onCapture, onError }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceQuality, setFaceQuality] = useState(0);
  const [detection, setDetection] = useState<FaceDetectionResult | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const initializeCamera = async () => {
    if (isLoading) return; // Prevent multiple simultaneous initializations
    
    try {
      setIsLoading(true);
      setError(null);

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });

      if (!videoRef.current) {
        throw new Error("Video element not available");
      }

      // Store stream reference
        streamRef.current = stream;
      
      // Attach stream to video element
        videoRef.current.srcObject = stream;
      
      // Set video properties for better compatibility
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      
      // Play the video
        await videoRef.current.play();
      
      // Wait a short time for video to initialize
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify stream is still active
      if (!stream.active) {
        throw new Error("Camera stream became inactive");
      }
        
      // Camera is ready
      setCameraStarted(true);
      setIsReady(true);
      setIsLoading(false);
      
      // Start face detection after a brief delay
        startFaceDetection();
    } catch (err: any) {
      console.error("Camera initialization error:", err);
      
      // Clean up any streams
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Set appropriate error message
      const errorMessage = err.name === "NotAllowedError" 
        ? "Camera access denied. Please allow camera access to continue."
        : err.name === "NotFoundError"
        ? "No camera found. Please connect a camera and try again."
        : err.name === "NotReadableError"
        ? "Camera is already in use by another application."
        : err.message || "Failed to initialize camera. Please try again.";
      
      setError(errorMessage);
      onError?.(errorMessage);
      setIsLoading(false);
      setCameraStarted(false);
      setIsReady(false);
    }
  };

  const stopCamera = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.pause();
    }
  };

  const startFaceDetection = () => {
    if (detectionIntervalRef.current) return;

    // Wait a bit for video to be ready before starting detection
    setTimeout(() => {
    detectionIntervalRef.current = window.setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

      try {
        const result = await detectFace(video);
        setDetection(result);

        if (result && result.detected) {
          setFaceDetected(true);
          
          const quality = calculateFaceQuality(
            result,
            video.videoWidth,
            video.videoHeight
          );
          setFaceQuality(quality);

          const isPositioned = isFacePositioned(
            result,
            video.videoWidth,
            video.videoHeight
          );

          // Auto-capture if face is well positioned and quality is good
          if (
            isPositioned &&
            quality >= KYC_CONFIG.faceQualityThreshold &&
            !isCapturing
          ) {
            // Optionally auto-capture, or just indicate readiness
          }
        } else {
          setFaceDetected(false);
          setFaceQuality(0);
        }
      } catch (err) {
        console.error("Face detection error:", err);
          // Don't stop detection on error, just log it
      }
      }, 300); // Check every 300ms (reduced frequency)
    }, 500); // Wait 500ms before starting detection
  };

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || !detection || !faceDetected) return;

    try {
      setIsCapturing(true);

      const imageData = captureImageFromVideo(videoRef.current);
      
      const faceData: FaceData = {
        image: imageData,
        quality: faceQuality,
        landmarks: detection.landmarks,
      };

      // Get face descriptor/embedding for face matching - extract from captured image, not live video
      try {
        const { getFaceDescriptor } = await import("@/lib/kyc/face-detection");
        // Create an image element from the captured image data to extract embedding
        const capturedImage = new Image();
        await new Promise((resolve, reject) => {
          capturedImage.onload = resolve;
          capturedImage.onerror = reject;
          capturedImage.src = imageData;
        });
        const descriptor = await getFaceDescriptor(capturedImage);
        if (descriptor) {
          faceData.embedding = descriptor;
          console.log("Face embedding extracted from captured image, length:", descriptor.length);
        } else {
          console.warn("Failed to extract embedding from captured image");
        }
      } catch (err) {
        console.warn("Failed to extract face descriptor:", err);
      }

      onCapture(faceData);
    } catch (err: any) {
      setError("Failed to capture face. Please try again.");
      onError?.(err.message);
    } finally {
      setIsCapturing(false);
    }
  }, [detection, faceDetected, faceQuality, onCapture, onError]);

  const handleRetry = () => {
    setError(null);
    setIsCapturing(false);
    setCameraStarted(false);
    setIsReady(false);
    stopCamera();
    initializeCamera();
  };

  // Show camera start button if camera hasn't been started
  if (!cameraStarted && !isLoading) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <div className="mb-6">
          <h3 className="text-2xl font-semibold mb-2">Face Verification</h3>
          <p className="text-white/60">
            Click the button below to start your camera for face verification
          </p>
        </div>
        {error && (
          <Alert className="border-red-500/50 bg-red-500/10 mb-4">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          </Alert>
        )}
        <Button onClick={initializeCamera} size="lg" className="min-w-48">
          <Camera className="w-4 h-4 mr-2" />
          Start Camera
        </Button>
      </div>
    );
  }

  if (error && !streamRef.current && !isLoading) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <Alert className="border-red-500/50 bg-red-500/10 mb-4">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-400">{error}</AlertDescription>
        </Alert>
        <Button onClick={handleRetry} variant="outline">
          Retry Camera Access
        </Button>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-8">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-semibold mb-2">Face Verification</h3>
        <p className="text-white/60">
          Position your face in the frame and ensure good lighting
        </p>
      </div>

      <div className="relative flex justify-center mb-6">
        <div className="relative w-full max-w-2xl aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-white mx-auto mb-2" />
                <p className="text-white/60 text-sm">Initializing camera...</p>
              </div>
            </div>
          )}

          {/* Face overlay guide */}
          <AnimatePresence>
            {isReady && !isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none z-5"
              >
                <svg
                  className="w-full h-full"
                  style={{ transform: "scaleX(-1)" }}
                >
                  <ellipse
                    cx="50%"
                    cy="50%"
                    rx="35%"
                    ry="45%"
                    fill="none"
                    stroke={faceDetected && faceQuality >= KYC_CONFIG.faceQualityThreshold ? "#10b981" : "#ffffff"}
                    strokeWidth="3"
                    strokeDasharray={faceDetected && faceQuality >= KYC_CONFIG.faceQualityThreshold ? "0" : "10 5"}
                    opacity="0.6"
                  />
                </svg>

                {/* Face detection box */}
                {detection && detection.box && (
                  <div
                    className="absolute border-2 rounded-lg"
                    style={{
                      left: `${(detection.box.x / (videoRef.current?.videoWidth || 1)) * 100}%`,
                      top: `${(detection.box.y / (videoRef.current?.videoHeight || 1)) * 100}%`,
                      width: `${(detection.box.width / (videoRef.current?.videoWidth || 1)) * 100}%`,
                      height: `${(detection.box.height / (videoRef.current?.videoHeight || 1)) * 100}%`,
                      borderColor: faceQuality >= KYC_CONFIG.faceQualityThreshold ? "#10b981" : "#f59e0b",
                      transform: "scaleX(-1)",
                    }}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Status indicators */}
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            {faceDetected ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span className="text-sm text-green-400">Face Detected</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                <span className="text-sm text-yellow-400">Position your face</span>
              </>
            )}
          </div>

          {faceDetected && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/60">Quality:</span>
              <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${faceQuality * 100}%`,
                    backgroundColor: faceQuality >= KYC_CONFIG.faceQualityThreshold ? "#10b981" : "#f59e0b",
                  }}
                />
              </div>
              <span className="text-sm text-white/60">
                {Math.round(faceQuality * 100)}%
              </span>
            </div>
          )}
        </div>

        {faceDetected && faceQuality < KYC_CONFIG.faceQualityThreshold && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertCircle className="h-4 w-4 text-yellow-400" />
            <AlertDescription className="text-yellow-400 text-sm">
              Please ensure better lighting and keep your face still for better quality.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Capture button */}
      <div className="mt-6 flex justify-center">
        <Button
          onClick={handleCapture}
          disabled={!faceDetected || faceQuality < KYC_CONFIG.faceQualityThreshold * 0.8 || isCapturing || isLoading}
          size="lg"
          className="min-w-48"
        >
          {isCapturing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Capturing...
            </>
          ) : (
            <>
              <Camera className="w-4 h-4 mr-2" />
              Capture Face
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

