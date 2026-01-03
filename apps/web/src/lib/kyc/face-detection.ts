import * as faceapi from "face-api.js";
import { FaceDetectionResult } from "./types";

let modelsLoaded = false;

/**
 * Load face-api.js models
 */
export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;

  try {
    // Load models from public/models directory
    // Models are organized in subdirectories: tiny_face_detector, face_landmark_68, face_recognition, face_expression
    const modelsPath = '/models';
    
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(`${modelsPath}/tiny_face_detector`),
      faceapi.nets.faceLandmark68Net.loadFromUri(`${modelsPath}/face_landmark_68`),
      faceapi.nets.faceRecognitionNet.loadFromUri(`${modelsPath}/face_recognition`),
      faceapi.nets.faceExpressionNet.loadFromUri(`${modelsPath}/face_expression`),
    ]);
    
    modelsLoaded = true;
    console.log("Face models loaded successfully");
  } catch (error) {
    console.error("Failed to load face models:", error);
    throw new Error("Failed to load face detection models. Make sure models are in /public/models/ directory.");
  }
}

/**
 * Detect face in image using face-api.js
 */
export async function detectFace(imageElement: HTMLImageElement | HTMLVideoElement): Promise<FaceDetectionResult | null> {
  try {
    await loadFaceModels();

    // Detect face with landmarks using TinyFaceDetector (fast and lightweight)
    const detection = await faceapi
      .detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks();

    if (!detection) {
      return null;
    }

    // Extract bounding box and landmarks
    const box = detection.detection.box;
    const landmarks = detection.landmarks;

    // Convert landmarks to our format
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const nose = landmarks.getNose();
    const mouth = landmarks.getMouth();

    return {
      detected: true,
      confidence: detection.detection.score,
      box: {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      },
      landmarks: {
        leftEye: {
          x: leftEye.reduce((sum: number, p: faceapi.Point) => sum + p.x, 0) / leftEye.length,
          y: leftEye.reduce((sum: number, p: faceapi.Point) => sum + p.y, 0) / leftEye.length,
        },
        rightEye: {
          x: rightEye.reduce((sum: number, p: faceapi.Point) => sum + p.x, 0) / rightEye.length,
          y: rightEye.reduce((sum: number, p: faceapi.Point) => sum + p.y, 0) / rightEye.length,
        },
        nose: {
          x: nose.reduce((sum: number, p: faceapi.Point) => sum + p.x, 0) / nose.length,
          y: nose.reduce((sum: number, p: faceapi.Point) => sum + p.y, 0) / nose.length,
        },
        mouth: {
          x: mouth.reduce((sum: number, p: faceapi.Point) => sum + p.x, 0) / mouth.length,
          y: mouth.reduce((sum: number, p: faceapi.Point) => sum + p.y, 0) / mouth.length,
        },
      },
    };
  } catch (error) {
    console.error("Face detection error:", error);
    return null;
  }
}

/**
 * Extract face descriptor/embedding for comparison
 */
export async function getFaceDescriptor(imageElement: HTMLImageElement | HTMLVideoElement): Promise<number[] | null> {
  try {
    await loadFaceModels();

    // Detect face with landmarks and extract descriptor (embedding)
    const detection = await faceapi
      .detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection || !detection.descriptor) {
      return null;
    }

    // Return descriptor as array (128 dimensions)
    return Array.from(detection.descriptor);
  } catch (error) {
    console.error("Failed to extract face descriptor:", error);
    return null;
  }
}

/**
 * Calculate cosine similarity between two face descriptors
 */
export function calculateFaceSimilarity(descriptor1: number[], descriptor2: number[]): number {
  if (descriptor1.length !== descriptor2.length) {
    return 0;
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < descriptor1.length; i++) {
    dotProduct += descriptor1[i] * descriptor2[i];
    norm1 += descriptor1[i] * descriptor1[i];
    norm2 += descriptor2[i] * descriptor2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}

/**
 * Check if face is properly positioned in frame
 */
export function isFacePositioned(detection: FaceDetectionResult, videoWidth: number, videoHeight: number): boolean {
  if (!detection.box) return false;

  const { x, y, width, height } = detection.box;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const frameCenterX = videoWidth / 2;
  const frameCenterY = videoHeight / 2;

  // Check if face is roughly centered (within 30% of center)
  const xOffset = Math.abs(centerX - frameCenterX) / videoWidth;
  const yOffset = Math.abs(centerY - frameCenterY) / videoHeight;

  // Check if face size is reasonable (between 30% and 70% of frame)
  const faceSizeRatio = (width * height) / (videoWidth * videoHeight);

  return xOffset < 0.3 && yOffset < 0.3 && faceSizeRatio > 0.09 && faceSizeRatio < 0.49;
}

/**
 * Calculate face quality score (0-1)
 */
export function calculateFaceQuality(detection: FaceDetectionResult, videoWidth: number, videoHeight: number): number {
  if (!detection.box) return 0;

  let score = detection.confidence || 0;

  // Position score (30%)
  const positionScore = isFacePositioned(detection, videoWidth, videoHeight) ? 0.3 : 0;
  score += positionScore;

  // Size score (30%)
  const { width, height } = detection.box;
  const faceSizeRatio = (width * height) / (videoWidth * videoHeight);
  if (faceSizeRatio >= 0.15 && faceSizeRatio <= 0.35) {
    score += 0.3;
  } else {
    score += 0.15;
  }

  // Landmarks score (40%) - check if landmarks are present and reasonable
  if (detection.landmarks) {
    const { leftEye, rightEye, nose, mouth } = detection.landmarks;
    
    // Check if landmarks are in reasonable positions
    const eyeDistance = Math.abs(leftEye.x - rightEye.x);
    const eyeNoseDistance = Math.abs(
      (leftEye.y + rightEye.y) / 2 - nose.y
    );
    
    if (eyeDistance > 0 && eyeNoseDistance > 0 && eyeDistance < videoWidth * 0.5) {
      score += 0.4;
    } else {
      score += 0.2;
    }
  }

  return Math.min(score, 1.0);
}

/**
 * Capture image from video element
 */
export function captureImageFromVideo(video: HTMLVideoElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  ctx.drawImage(video, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.8);
}

/**
 * Calculate Eye Aspect Ratio (EAR) for blink detection
 */
export function calculateEAR(eye: faceapi.Point[]): number {
  if (eye.length < 6) return 1;
  
  // Vertical distances
  const v1 = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2));
  const v2 = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2));
  
  // Horizontal distance
  const h = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2));
  
  // EAR formula
  return (v1 + v2) / (2.0 * h);
}

/**
 * Detect face with expressions and landmarks for liveness detection
 */
export async function detectFaceWithExpressions(
  imageElement: HTMLImageElement | HTMLVideoElement
) {
  try {
    await loadFaceModels();

    const detection = await faceapi
      .detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions();

    return detection;
  } catch (error) {
    console.error("Face detection with expressions error:", error);
    return null;
  }
}

