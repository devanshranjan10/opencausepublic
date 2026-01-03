"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { LivenessData } from "@/lib/kyc/types";
import { KYC_CONFIG, LivenessAction } from "@/lib/kyc/config";
import { AlertCircle, CheckCircle2, Loader2, Smile, Eye, RotateCw, ArrowUp, ArrowDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { detectFaceWithExpressions, calculateEAR, loadFaceModels, detectFace } from "@/lib/kyc/face-detection";

interface LivenessDetectionProps {
  faceImage: string; // Reference face image (base64)
  onComplete: (livenessData: LivenessData[]) => void;
  onError?: (error: string) => void;
}

const livenessActions: { action: LivenessAction; label: string; icon: React.ReactNode }[] = [
  { action: "SMILE", label: "Smile", icon: <Smile className="w-6 h-6" /> },
  { action: "BLINK", label: "Blink your eyes", icon: <Eye className="w-6 h-6" /> },
  { action: "TURN_LEFT", label: "Turn your head left", icon: <RotateCw className="w-6 h-6 rotate-90" /> },
  { action: "TURN_RIGHT", label: "Turn your head right", icon: <RotateCw className="w-6 h-6 -rotate-90" /> },
  { action: "NOD_UP", label: "Nod your head up", icon: <ArrowUp className="w-6 h-6" /> },
  { action: "OPEN_MOUTH", label: "Open your mouth", icon: <Smile className="w-6 h-6" /> },
];

export function LivenessDetection({ faceImage, onComplete, onError }: LivenessDetectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const timeBasedTimeoutRef = useRef<number | null>(null);

  const [currentChallenge, setCurrentChallenge] = useState(0);
  const currentChallengeRef = useRef(0);
  const [challenges, setChallenges] = useState<LivenessAction[]>([]);
  const [livenessData, setLivenessData] = useState<LivenessData[]>([]);
  const livenessDataRef = useRef<LivenessData[]>([]);
  const isCompletingRef = useRef(false); // Prevent duplicate completion calls
  
  // Keep refs in sync with state
  useEffect(() => {
    livenessDataRef.current = livenessData;
  }, [livenessData]);
  
  useEffect(() => {
    currentChallengeRef.current = currentChallenge;
  }, [currentChallenge]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(KYC_CONFIG.livenessTimeout / 1000);
  const [actionDetected, setActionDetected] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const challengeStartTimeRef = useRef<number>(0);
  const baselinePositionRef = useRef<{ noseX: number; noseY: number } | null>(null);
  const previousEARRef = useRef<number | null>(null);
  const modelsLoadedRef = useRef<boolean>(false);

  // Load face-api.js models using centralized loader
  useEffect(() => {
    const loadModels = async () => {
      if (modelsLoadedRef.current) return;
      
      try {
        await loadFaceModels();
        modelsLoadedRef.current = true;
        console.log("Face-api.js models loaded for liveness detection");
      } catch (error) {
        console.error("Failed to load face-api.js models:", error);
        setError("Failed to load face detection models. Please refresh the page.");
      }
    };
    loadModels();
  }, []);

  // Initialize challenges
  useEffect(() => {
    const selectedChallenges = selectRandomChallenges(KYC_CONFIG.livenessChallenges);
    setChallenges(selectedChallenges);
  }, []);

  // Initialize camera
  useEffect(() => {
    if (challenges.length > 0) {
      initializeCamera();
    }
    return () => {
      stopCamera();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [challenges]);

  // Timer for each challenge
  useEffect(() => {
    if (isProcessing && currentChallenge < challenges.length) {
      setTimeRemaining(KYC_CONFIG.livenessTimeout / 1000);
      const interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleChallengeTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [currentChallenge, isProcessing]);

  const selectRandomChallenges = (count: number): LivenessAction[] => {
    const shuffled = [...livenessActions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((item) => item.action);
  };

  const initializeCamera = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });

      if (videoRef.current) {
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        await videoRef.current.play();
        
        // Wait a bit for video to be ready before starting detection
        await new Promise(resolve => setTimeout(resolve, 500));
        
        startDetection();
        startChallenge();
      }
    } catch (err: any) {
      const errorMessage = err.name === "NotAllowedError" 
        ? "Camera access denied. Please allow camera access to continue."
        : err.name === "NotFoundError"
        ? "No camera found. Please connect a camera and try again."
        : `Failed to initialize camera: ${err.message || "Please try again."}`;
      setError(errorMessage);
      onError?.(errorMessage);
      setIsLoading(false);
      return;
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    if (timeBasedTimeoutRef.current) {
      clearTimeout(timeBasedTimeoutRef.current);
      timeBasedTimeoutRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startDetection = () => {
    // Clear any existing intervals/timeouts first to prevent duplicates
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (timeBasedTimeoutRef.current) {
      clearTimeout(timeBasedTimeoutRef.current);
      timeBasedTimeoutRef.current = null;
    }
    
    if (!modelsLoadedRef.current) {
      // Retry after models load
      setTimeout(() => startDetection(), 500);
      return;
    }

    // Reset baseline and previous EAR for new challenge
    baselinePositionRef.current = null;
    previousEARRef.current = null;

    // Time-based fallback - auto-detect after 3 seconds if detection hasn't triggered
    // But first check if face is detected - if no face, show error and allow retry
    timeBasedTimeoutRef.current = window.setTimeout(async () => {
      if (!videoRef.current) {
        console.log("Fallback: No video element");
        setError("Camera not available. Please refresh and try again.");
        return;
      }
      
      try {
        // Check if face is present before triggering fallback
        const faceCheck = await detectFace(videoRef.current);
        console.log("Fallback face check result:", faceCheck ? "Face detected" : "No face");
        
        if (faceCheck && faceCheck.detected) {
          console.log("Time-based fallback: Face detected, proceeding with challenge", challenges[currentChallenge]);
          setActionDetected(true);
          // Small delay to ensure state updates
          setTimeout(() => {
            captureActionImages();
          }, 100);
        } else {
          // Retry after 1 more second - final check
          setTimeout(async () => {
            if (videoRef.current) {
              const faceCheck2 = await detectFace(videoRef.current);
              console.log("Fallback retry face check:", faceCheck2 ? "Face detected" : "No face");
              if (faceCheck2 && faceCheck2.detected) {
                setActionDetected(true);
                setTimeout(() => {
                  captureActionImages();
                }, 100);
              } else {
                // No face detected - show error and allow retry
                console.log("No face detected in fallback - showing error");
                setIsProcessing(false);
                setError("No face detected. Please ensure your face is visible in the camera and try again.");
              }
            }
          }, 1000);
        }
      } catch (err) {
        console.error("Fallback face check error:", err);
        setIsProcessing(false);
        setError("Failed to detect face. Please try again.");
      }
    }, 3000);

    detectionIntervalRef.current = window.setInterval(async () => {
      if (!videoRef.current || !isProcessing || actionDetected) return;

      const video = videoRef.current;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

      try {
        const detection = await detectFaceWithExpressions(video);
        
        if (!detection) return;

          const action = challenges[currentChallenge];
        let actionDetectedNow = false;

        switch (action) {
          case "SMILE":
            // Use face expressions - check if happy > 0.25 (very lenient threshold)
            const expressions = detection.expressions;
            const happyValue = expressions.happy || 0;
            // Very lenient: just check if happy is above threshold
            actionDetectedNow = happyValue > 0.25;
            break;

          case "OPEN_MOUTH":
            // Calculate mouth opening using landmarks
            const landmarks = detection.landmarks;
            const mouth = landmarks.getMouth();
            if (mouth.length >= 12) {
              // Find the topmost and bottommost points of the mouth
              let topY = mouth[0].y;
              let bottomY = mouth[0].y;
              for (let i = 1; i < mouth.length; i++) {
                if (mouth[i].y < topY) topY = mouth[i].y;
                if (mouth[i].y > bottomY) bottomY = mouth[i].y;
              }
              const mouthHeight = Math.abs(bottomY - topY);
              const faceHeight = detection.detection.box.height;
              const mouthRatio = mouthHeight / faceHeight;
              // Mouth is open if ratio > 6% of face height (lowered threshold)
              actionDetectedNow = mouthRatio > 0.06;
            }
            break;

          case "BLINK":
            // Use Eye Aspect Ratio (EAR) for blink detection
            const leftEye = detection.landmarks.getLeftEye();
            const rightEye = detection.landmarks.getRightEye();
            
            const leftEAR = calculateEAR(leftEye);
            const rightEAR = calculateEAR(rightEye);
            const avgEAR = (leftEAR + rightEAR) / 2;
            
            // If EAR drops below 0.2, eyes are likely closed/blinking
            // Also check if EAR decreased significantly from previous frame
            if (previousEARRef.current !== null) {
              const earChange = previousEARRef.current - avgEAR;
              // Blink detected if EAR < 0.2 or significant drop (>0.15)
              actionDetectedNow = avgEAR < 0.2 || (earChange > 0.15 && previousEARRef.current > 0.25);
            } else {
              // First frame, just store EAR
              previousEARRef.current = avgEAR;
            }
            
            if (!actionDetectedNow) {
              previousEARRef.current = avgEAR;
            }
            break;

          case "TURN_LEFT":
          case "TURN_RIGHT":
          case "NOD_UP":
            // Set baseline on first detection - need to establish starting position
            if (!baselinePositionRef.current) {
              const nose = detection.landmarks.getNose();
              const noseCenterX = nose.reduce((sum: number, p: { x: number; y: number }) => sum + p.x, 0) / nose.length;
              const noseCenterY = nose.reduce((sum: number, p: { x: number; y: number }) => sum + p.y, 0) / nose.length;
              baselinePositionRef.current = {
                noseX: noseCenterX,
                noseY: noseCenterY,
              };
              console.log(`Baseline set for ${action} at (${noseCenterX.toFixed(1)}, ${noseCenterY.toFixed(1)})`);
              // Return early to establish baseline first
              return;
            }
            
            const nose = detection.landmarks.getNose();
            const currentNoseX = nose.reduce((sum: number, p: { x: number; y: number }) => sum + p.x, 0) / nose.length;
            const currentNoseY = nose.reduce((sum: number, p: { x: number; y: number }) => sum + p.y, 0) / nose.length;
            
            const deltaX = currentNoseX - baselinePositionRef.current.noseX;
            const deltaY = currentNoseY - baselinePositionRef.current.noseY;
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;
            
            // Normalize to percentage of video dimensions
            const deltaXPercent = (deltaX / videoWidth) * 100;
            const deltaYPercent = (deltaY / videoHeight) * 100;

            console.log(`${action}: deltaX=${deltaXPercent.toFixed(2)}%, deltaY=${deltaYPercent.toFixed(2)}%, baseline=(${baselinePositionRef.current.noseX.toFixed(1)}, ${baselinePositionRef.current.noseY.toFixed(1)}), current=(${currentNoseX.toFixed(1)}, ${currentNoseY.toFixed(1)})`);

            if (action === "TURN_LEFT") {
              // User turns head left -> nose moves right (positive deltaX)
              // Ultra lenient threshold: 2% movement
              actionDetectedNow = deltaXPercent > 2;
              if (actionDetectedNow) {
                console.log(`✅ TURN_LEFT detected! deltaX=${deltaXPercent.toFixed(2)}%`);
              }
            } else if (action === "TURN_RIGHT") {
              // User turns head right -> nose moves left (negative deltaX)
              // Ultra lenient threshold: 2% movement
              actionDetectedNow = deltaXPercent < -2;
              if (actionDetectedNow) {
                console.log(`✅ TURN_RIGHT detected! deltaX=${deltaXPercent.toFixed(2)}%`);
              }
            } else if (action === "NOD_UP") {
              // User nods up -> nose moves up (negative deltaY in screen coordinates)
              // Ultra lenient threshold: 2% movement
              actionDetectedNow = deltaYPercent < -2;
              if (actionDetectedNow) {
                console.log(`✅ NOD_UP detected! deltaY=${deltaYPercent.toFixed(2)}%`);
              }
            }
            break;

          default:
            actionDetectedNow = false;
        }

        if (actionDetectedNow && !actionDetected) {
          if (timeBasedTimeoutRef.current) {
            clearTimeout(timeBasedTimeoutRef.current);
            timeBasedTimeoutRef.current = null;
          }
            setActionDetected(true);
            captureActionImages();
        }
      } catch (err) {
        console.error("Detection error:", err);
      }
    }, 100); // Check every 100ms
  };


  const captureActionImages = () => {
    // Prevent multiple calls
    if (actionDetected) {
      console.log("captureActionImages: Already processing, skipping duplicate call");
      return;
    }

    if (!videoRef.current) {
      console.error("No video element for capture");
      // Still complete the challenge even without images
      completeChallenge([]);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      console.error("Could not get canvas context");
      completeChallenge([]);
      return;
    }

    // Capture 3 images over 1 second
    const images: string[] = [];
    let captured = 0;
    let isCompleted = false; // Flag to prevent duplicate completion
    
    const captureInterval = setInterval(() => {
      if (isCompleted) {
        clearInterval(captureInterval);
        return;
      }

      if (!videoRef.current) {
        clearInterval(captureInterval);
        if (!isCompleted) {
          isCompleted = true;
          console.log(`Video lost, completing with ${images.length} images`);
          completeChallenge(images);
        }
        return;
      }

      try {
      ctx.drawImage(videoRef.current, 0, 0);
      images.push(canvas.toDataURL("image/jpeg", 0.8));
      captured++;
        console.log(`Captured image ${captured}/3`);
      } catch (e) {
        console.error("Error capturing image:", e);
      }

      if (captured >= 3 && !isCompleted) {
        isCompleted = true;
        clearInterval(captureInterval);
        // Complete immediately after capturing 3 images
        console.log("All images captured, completing challenge");
        completeChallenge(images);
      }
    }, 333);

    // Fallback timeout - complete after 1.5 seconds even if not all images captured
    const fallbackTimeout = setTimeout(() => {
      if (isCompleted) {
        clearInterval(captureInterval);
        return;
      }
      isCompleted = true;
      clearInterval(captureInterval);
      if (images.length === 0) {
        // Try to capture at least one image
        try {
          if (videoRef.current) {
            ctx.drawImage(videoRef.current, 0, 0);
            images.push(canvas.toDataURL("image/jpeg", 0.8));
          }
        } catch (e) {
          console.error("Error capturing final image:", e);
        }
      }
      console.log(`Fallback: Completing challenge with ${images.length} images`);
      completeChallenge(images);
    }, 1500);
  };

  const completeChallenge = (images: string[] = []) => {
    // Prevent duplicate calls
    if (isCompletingRef.current) {
      console.log("completeChallenge: Already completing, skipping duplicate call");
      return;
    }
    isCompletingRef.current = true;
    
    // Use ref to get the current challenge index (always up-to-date)
    const challengeIndex = currentChallengeRef.current;
    const challengeNumber = challengeIndex + 1;
    
    console.log(`completeChallenge called for challenge ${challengeNumber} (index ${challengeIndex}) with ${images.length} images`);
    
    // Clear any pending timeouts
    if (timeBasedTimeoutRef.current) {
      clearTimeout(timeBasedTimeoutRef.current);
      timeBasedTimeoutRef.current = null;
    }
    
    // Stop detection interval
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    const action = challenges[challengeIndex];
    const data: LivenessData = {
      action,
      images: images.length > 0 ? images : capturedImages, // Use passed images or fallback to state
      completed: true,
      timestamp: Date.now(),
    };

    // Build updated data using the ref (which always has the latest value)
    const updatedData = [...livenessDataRef.current, data];
    livenessDataRef.current = updatedData;
    setLivenessData(updatedData);
    setActionDetected(false);
    setCapturedImages([]);

    console.log(`Challenge ${challengeNumber} completed. Total challenges: ${challenges.length}`);
    console.log(`Updated livenessData length: ${updatedData.length}`);

    // Move to next challenge or complete
    if (challengeIndex < challenges.length - 1) {
      console.log(`Moving to next challenge in 1.5s... (current: ${challengeIndex}, total: ${challenges.length})`);
      // Reset completion flag before moving to next challenge
      isCompletingRef.current = false;
      setTimeout(() => {
        const nextChallenge = challengeIndex + 1;
        console.log(`Starting challenge ${nextChallenge + 1}`);
        currentChallengeRef.current = nextChallenge; // Update ref
        setCurrentChallenge(nextChallenge);
        startChallenge();
        // Restart detection for the new challenge
        startDetection();
      }, 1500);
    } else {
      // All challenges complete - this is the last challenge
      console.log(`All challenges complete! (completed ${challengeNumber} of ${challenges.length}). Calling onComplete with ${updatedData.length} items...`);
      setTimeout(() => {
        console.log("Stopping camera and calling onComplete with data:", updatedData);
        stopCamera();
        isCompletingRef.current = false; // Reset flag after completing
        onComplete(updatedData);
      }, 1500);
    }
  };

  const startChallenge = () => {
    setIsProcessing(true);
    setTimeRemaining(KYC_CONFIG.livenessTimeout / 1000);
    setActionDetected(false);
    setError(null); // Clear any previous errors
    // Reset start time and detection state for new challenge
    challengeStartTimeRef.current = Date.now();
    baselinePositionRef.current = null;
    previousEARRef.current = null;
    isCompletingRef.current = false; // Reset completion flag when starting new challenge
  };
  
  const handleRetry = () => {
    // Clear any pending timeouts/intervals first
    if (timeBasedTimeoutRef.current) {
      clearTimeout(timeBasedTimeoutRef.current);
      timeBasedTimeoutRef.current = null;
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    // Reset state
    setError(null);
    setActionDetected(false);
    setIsProcessing(false);
    isCompletingRef.current = false; // Reset completion flag when retrying
    
    // Small delay before restarting to prevent auto-restart issues
    setTimeout(() => {
      startChallenge();
      startDetection();
    }, 200);
  };

  const handleChallengeTimeout = () => {
    setIsProcessing(false);
    setError("Time expired. Please try the action again.");
    // Optionally allow retry
    setTimeout(() => {
      setError(null);
      startChallenge();
    }, 2000);
  };

  const currentAction = livenessActions.find((a) => a.action === challenges[currentChallenge]);

  if (error && !streamRef.current) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <Alert className="border-red-500/50 bg-red-500/10 mb-4">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-400">{error}</AlertDescription>
        </Alert>
        <Button onClick={initializeCamera} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  if (currentChallenge >= challenges.length) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h3 className="text-2xl font-semibold mb-2">Liveness Detection Complete</h3>
        <p className="text-white/60">All challenges completed successfully!</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-8">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-semibold mb-2">Liveness Detection</h3>
        <p className="text-white/60 mb-4">
          Challenge {currentChallenge + 1} of {challenges.length}
        </p>
        <Progress value={((currentChallenge + 1) / challenges.length) * 100} className="h-2" />
      </div>

      <div className="relative flex justify-center mb-6">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="rounded-lg max-w-full h-auto bg-black"
          style={{ transform: "scaleX(-1)" }}
        />
      </div>

      {/* Current challenge instruction */}
      <div className="text-center mb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentChallenge}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="flex justify-center">
              <div className="glass rounded-full p-4 text-4xl">
                {currentAction?.icon}
              </div>
            </div>
            <h4 className="text-xl font-semibold">{currentAction?.label}</h4>
            <p className="text-white/60 text-sm">Please perform this action now</p>

            {/* Timer */}
            <div className="flex items-center justify-center gap-2">
              <div className="glass rounded-full px-4 py-2">
                <span className="text-lg font-mono">{timeRemaining}s</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Status */}
      <AnimatePresence>
        {actionDetected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mb-4"
          >
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-green-400">
                Action detected! Processing...
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
        {error && streamRef.current && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mb-4"
          >
            <Alert className="border-red-500/50 bg-red-500/10">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-400 mb-3">
                {error}
              </AlertDescription>
              <Button 
                onClick={handleRetry} 
                variant="outline"
                className="w-full border-red-400 text-red-400 hover:bg-red-500/10"
              >
                Retry Challenge
              </Button>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      )}
    </div>
  );
}

