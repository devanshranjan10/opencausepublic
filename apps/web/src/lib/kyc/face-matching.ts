import * as faceapi from "face-api.js";
import { FaceData, FaceMatchResult } from "./types";
import { loadFaceModels } from "./face-detection";

/**
 * Compare two faces and return match result
 * Threshold: 55% similarity required for match
 */
export async function matchFaces(
  documentFace: FaceData,
  capturedFace: FaceData
): Promise<FaceMatchResult> {
  try {
    await loadFaceModels();

    // Load images from base64
    const loadImage = (dataUrl: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = dataUrl;
      });
    };

    const img1 = await loadImage(documentFace.image);
    const img2 = await loadImage(capturedFace.image);

    // Detect faces and extract descriptors
    const detection1 = await faceapi
      .detectSingleFace(img1, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    const detection2 = await faceapi
      .detectSingleFace(img2, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection1 || !detection2) {
      throw new Error("Could not detect face in one or both images");
    }

    // Calculate Euclidean distance
    const distance = faceapi.euclideanDistance(
      detection1.descriptor,
      detection2.descriptor
    );

    // Convert distance to similarity percentage (0-100)
    // Lower distance = Higher similarity
    const similarityScore = Math.max(0, (1 - distance) * 100);

    // Threshold: 55% similarity required for match
    const SIMILARITY_THRESHOLD = 55;
    const matched = similarityScore >= SIMILARITY_THRESHOLD;

    console.log("Face match result:", {
      distance: distance.toFixed(4),
      matched,
      similarityScore: similarityScore.toFixed(2) + "%",
      threshold: SIMILARITY_THRESHOLD + "%",
    });

    return {
      matched,
      score: parseFloat(similarityScore.toFixed(2)),
      threshold: SIMILARITY_THRESHOLD,
    };
  } catch (error) {
    console.error("Face matching error:", error);
    throw error;
  }
}
