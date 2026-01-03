import * as faceapi from "face-api.js";
import { loadFaceModels } from "./face-detection";
import { createWorker } from "tesseract.js";

export interface DocumentValidationResult {
  isValid: boolean;
  documentType?: string;
  country?: string;
  confidence: number;
  reason?: string;
  hasFace?: boolean;
  ocrData?: {
    extractedText: string;
    matchedKeywords: string[];
  };
}

// Keywords that indicate a government-issued ID document
const ID_KEYWORDS = [
  // Document types
  "PASSPORT",
  "PASSORT", // Common typo
  "NATIONAL ID",
  "NATIONAL IDENTITY",
  "IDENTITY CARD",
  "ID CARD",
  "DRIVER",
  "DRIVING",
  "LICENSE",
  "LICENCE",
  "AADHAAR",
  "AADHAR",
  "AADHAAR NUMBER",
  "PAN CARD",
  "PAN",
  "VOTER ID",
  "VOTER",
  "RESIDENCE PERMIT",
  "PERMIT",
  "SOCIAL SECURITY",
  "SSN",
  "BIRTH CERTIFICATE",
  "CITIZENSHIP",
  "CITIZEN",
  "NATIONAL",
  "GOVERNMENT",
  "GOVT",
  "IDENTIFICATION",
  "IDENTITY",
  // Aadhaar/UIDAI specific keywords
  "UIDAI",
  "UNIQUE IDENTIFICATION AUTHORITY",
  "GOVERNMENT OF INDIA",
  "GOI",
  "ENROLLMENT",
  "ENROLMENT",
  "ENROLLMENT NO",
  "ENROLMENT NO",
  "ENROLLMENT NUMBER",
  "ENROLMENT NUMBER",
  "MALE",
  "FEMALE",
  "GENDER",
  "FATHER",
  "MOTHER",
  "HUSBAND",
  "WIFE",
  "ADDRESS",
  "VILLAGE",
  "POST",
  "DISTRICT",
  "STATE",
  "PIN",
  "PIN CODE",
  "DOB",
  "YEAR OF BIRTH",
  // Government terms
  "REPUBLIC",
  "MINISTRY",
  "DEPARTMENT",
  "AUTHORITY",
  "ISSUED BY",
  "ISSUING",
  // Common ID number patterns
  "ID NO",
  "ID NUMBER",
  "DOCUMENT NO",
  "DOCUMENT NUMBER",
  "PASSPORT NO",
  "PASSPORT NUMBER",
  "LICENSE NO",
  "LICENSE NUMBER",
  "REGISTRATION",
  "REGISTRATION NO",
  "REGISTRATION NUMBER",
  // Country-specific terms
  "INDIA",
  "INDIAN",
  "BHARAT",
  "UNITED STATES",
  "USA",
  "UK",
  "UNITED KINGDOM",
  "CANADA",
  "AUSTRALIA",
  // Date fields
  "DATE OF BIRTH",
  "DOB",
  "ISSUE DATE",
  "ISSUED DATE",
  "EXPIRY",
  "EXPIRY DATE",
  "EXPIRES",
  "VALID UNTIL",
  "VALID TILL",
  // Common document fields
  "NAME",
  "FULL NAME",
  "SIGNATURE",
  "PHOTO",
  "PHOTOGRAPH",
];

/**
 * Validate if uploaded image is a government-issued ID document
 * Supports documents from ALL countries worldwide
 */
export async function validateDocument(
  imageDataUrl: string
): Promise<DocumentValidationResult> {
  
  try {
    console.log("Starting document validation...");

    // Step 1: Basic image checks
    const basicCheck = await validateImageQuality(imageDataUrl);
    if (!basicCheck.isValid) {
      return {
        isValid: false,
        confidence: 0,
        reason: basicCheck.reason,
      };
    }

    // Step 2: Check image structure/quality (aspect ratio, orientation)
    const structureCheck = await validateDocumentStructure(imageDataUrl);
    if (!structureCheck.isValid) {
      return {
        isValid: false,
        confidence: 30,
        reason: structureCheck.reason || "Invalid document format. Please upload a clear photo of your ID card, passport, or driver license.",
        hasFace: false,
      };
    }

    // Step 3: Verify document has face photo (most IDs have photos)
    const faceCheck = await verifyDocumentHasFace(imageDataUrl);
    
    // Step 4: Use OCR to extract text and check for ID keywords
    // Note: OCR quality may be poor, so we use it as an enhancement, not a requirement
    const ocrResult = await extractTextWithOCR(imageDataUrl);
    const hasIDKeywords = checkForIDKeywords(ocrResult.extractedText);
    
    // If OCR keywords found - high confidence validation
    if (hasIDKeywords.found) {
      return {
        isValid: true,
        documentType: hasIDKeywords.documentType || "Government ID",
        confidence: faceCheck.hasFace ? 90 : 80, // Higher confidence with OCR + face
        hasFace: faceCheck.hasFace,
        ocrData: {
          extractedText: ocrResult.extractedText,
          matchedKeywords: hasIDKeywords.matchedKeywords,
        },
      };
    }
    
    // OCR keywords not found - reject the document
    // Only accept if we have strong evidence it's a valid document
    // Don't rely on face detection alone as it can have false positives
    console.warn("OCR keywords not found - document validation failed");
    return {
      isValid: false,
      confidence: 30,
      reason: "Could not verify document authenticity. Please ensure the image is clear, well-lit, and shows your ID document with readable text.",
      hasFace: faceCheck.hasFace,
    };

  } catch (error) {
    console.error("Document validation error:", error);
    return {
      isValid: false,
      confidence: 0,
      reason: "Failed to process document. Please try again with a clearer photo.",
    };
  }
}

/**
 * Validate image quality and format
 */
async function validateImageQuality(
  imageDataUrl: string
): Promise<{ isValid: boolean; reason?: string }> {
  
  return new Promise((resolve) => {
    const img = new Image();
    
    img.onload = () => {
      // Check minimum dimensions
      if (img.width < 300 || img.height < 200) {
        resolve({
          isValid: false,
          reason: "Image resolution too low. Please upload a higher quality photo (minimum 300x200 pixels).",
        });
        return;
      }

      // Check maximum dimensions (prevent extremely large images)
      if (img.width > 5000 || img.height > 5000) {
        resolve({
          isValid: false,
          reason: "Image resolution too high. Please upload a smaller image (max 5000x5000 pixels).",
        });
        return;
      }

      resolve({ isValid: true });
    };

    img.onerror = () => {
      resolve({
        isValid: false,
        reason: "Invalid image format. Please upload JPG or PNG.",
      });
    };

    img.src = imageDataUrl;
  });
}

/**
 * Verify document contains a face photo
 * Note: This is a weak signal - many images have faces, so this alone doesn't validate a document
 */
async function verifyDocumentHasFace(
  imageDataUrl: string
): Promise<{ hasFace: boolean }> {
  
  try {
    // Ensure face models are loaded
    await loadFaceModels();
    
    const img = await loadImage(imageDataUrl);
    
    // Use face-api.js to detect if document has a face
    const detection = await faceapi.detectSingleFace(
      img,
      new faceapi.TinyFaceDetectorOptions()
    );

    return { hasFace: detection !== undefined };

  } catch (error) {
    console.error("Face detection on document failed:", error);
    // If face detection fails, assume no face (don't auto-pass)
    return { hasFace: false };
  }
}

/**
 * Validate document structure (orientation, aspect ratio, etc.)
 */
async function validateDocumentStructure(
  imageDataUrl: string
): Promise<{ isValid: boolean; reason?: string }> {
  
  return new Promise((resolve) => {
    const img = new Image();
    
    img.onload = () => {
      // Check aspect ratio (most IDs are landscape or portrait but not square)
      const aspectRatio = img.width / img.height;
      
      // IDs are typically between 1:1.4 and 1.8:1 (portrait) or 1.8:1 to 2.2:1 (landscape)
      // Reject square images (likely not an ID card)
      if (aspectRatio > 0.9 && aspectRatio < 1.1) {
        resolve({
          isValid: false,
          reason: "Invalid image orientation. ID documents are typically rectangular (landscape or portrait), not square.",
        });
        return;
      }

      // Check if image is too narrow (likely not a document)
      if (aspectRatio > 3 || aspectRatio < 0.3) {
        resolve({
          isValid: false,
          reason: "Invalid document format. Please upload a complete photo of your ID document.",
        });
        return;
      }

      resolve({ isValid: true });
    };

    img.onerror = () => {
      resolve({
        isValid: false,
        reason: "Failed to load image.",
      });
    };

    img.src = imageDataUrl;
  });
}

/**
 * Validate that image looks like a document (has text-like structure, not just any image)
 */
async function validateDocumentLikeStructure(
  imageDataUrl: string
): Promise<{ isValid: boolean; reason?: string }> {
  
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    img.onload = () => {
      if (!ctx) {
        resolve({ isValid: false, reason: "Canvas context not available" });
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Check for document-like characteristics:
      // 1. Documents typically have areas of high contrast (text on background)
      // 2. Documents usually have more structured, less colorful content
      // 3. Calculate variance in pixel values (documents have more variation due to text)

      let contrastScore = 0;
      let colorVariation = 0;
      const sampleSize = Math.min(10000, data.length / 4); // Sample pixels
      const step = Math.floor(data.length / 4 / sampleSize);

      for (let i = 0; i < data.length - 12; i += step * 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Check for high contrast areas (text-like)
        const brightness = (r + g + b) / 3;
        const nextBrightness = (data[i + step * 4] + data[i + step * 4 + 1] + data[i + step * 4 + 2]) / 3;
        const contrast = Math.abs(brightness - nextBrightness);
        contrastScore += contrast;

        // Check color variation (documents are usually less colorful)
        const colorSpread = Math.max(r, g, b) - Math.min(r, g, b);
        colorVariation += colorSpread;
      }

      const avgContrast = contrastScore / sampleSize;
      const avgColorVariation = colorVariation / sampleSize;

      // Calculate color saturation (how "pure" the colors are)
      // Documents are typically desaturated (grays, whites, muted colors)
      // Artistic images are highly saturated (vibrant colors)
      let saturationSum = 0;
      for (let i = 0; i < data.length - 12; i += step * 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        saturationSum += saturation * 255; // Scale to 0-255
      }
      const avgSaturation = saturationSum / sampleSize;

      console.log("Document validation metrics:", {
        avgContrast: avgContrast.toFixed(2),
        avgColorVariation: avgColorVariation.toFixed(2),
        avgSaturation: avgSaturation.toFixed(2),
      });

      // Check for document-like characteristics
      // Real documents typically have:
      // - Moderate to high contrast (text creates contrast) - usually >15
      // - Low to moderate color saturation (muted colors, not vibrant)
      // - Structured appearance with text
      
      // Reject artistic/colorful images:
      // 1. Very high saturation (>80) = vibrant artistic images
      // 2. High color variation (>100) with low contrast (<15) = colorful but no structure
      // 3. Very high color variation (>120) = too colorful for documents
      
      const isTooSaturated = avgSaturation > 80;
      const isTooColorful = avgColorVariation > 100;
      const hasLowContrast = avgContrast < 15;
      
      if (isTooSaturated) {
        console.log("Rejected: Too saturated (artistic image)");
        resolve({
          isValid: false,
          reason: "This doesn't appear to be a document. Please upload a clear photo of your government-issued ID (Passport, National ID, Driver License, Aadhaar, etc.).",
        });
        return;
      }
      
      if (isTooColorful && hasLowContrast) {
        console.log("Rejected: Too colorful with low contrast (artistic image)");
        resolve({
          isValid: false,
          reason: "This doesn't look like a document. Please upload a clear photo of your ID card, passport, or driver license.",
        });
        return;
      }
      
      if (avgColorVariation > 120) {
        console.log("Rejected: Extremely high color variation (artistic image)");
        resolve({
          isValid: false,
          reason: "Image doesn't appear to be a document. Please upload a clear photo of your government-issued ID.",
        });
        return;
      }

      console.log("Document validation passed");
      // Allow through - appears to be a valid document
      resolve({ isValid: true });
    };

    img.onerror = () => {
      resolve({
        isValid: false,
        reason: "Failed to analyze image.",
      });
    };

    img.src = imageDataUrl;
  });
}

/**
 * Extract text from image using Tesseract.js (runs in browser, no API keys needed)
 */
async function extractTextWithOCR(
  imageDataUrl: string
): Promise<{ extractedText: string; success: boolean }> {
  
  try {
    console.log("Starting Tesseract.js OCR...");
    
    // Create Tesseract worker with English language
    const worker = await createWorker("eng", 1, {
      logger: (m) => {
        // Only log progress updates, not every message
        if (m.status === "recognizing text" && m.progress % 0.1 < 0.05) {
          console.log(`OCR progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    // Set worker parameters optimized for document/ID card recognition
    await worker.setParameters({
      tessedit_pageseg_mode: 11 as any, // Sparse text (default for documents) - PSM 11
      tessedit_ocr_engine_mode: "1", // LSTM only (best for documents)
      // Remove character whitelist - let it recognize all characters for better accuracy
    });

    // Perform OCR with higher confidence threshold
    const { data } = await worker.recognize(imageDataUrl, {
      rectangle: undefined, // Process entire image
    });
    const text = data.text;
    
    // Terminate worker
    await worker.terminate();

    // Extract text with better formatting
    // Combine words with spaces, but preserve structure
    let extractedText = text
      .replace(/\r\n/g, " ") // Replace line breaks with spaces
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .trim();

    console.log("Tesseract OCR extracted text length:", extractedText.length);
    console.log("Tesseract extracted text (first 500 chars):", extractedText.substring(0, 500));
    
    if (!extractedText || extractedText.length < 10) {
      console.warn("Tesseract extracted very little or no text - length:", extractedText.length);
      return { extractedText: "", success: false };
    }
    
    return { extractedText: extractedText.toUpperCase(), success: true };
    
  } catch (error) {
    console.error("Tesseract OCR extraction error:", error);
    return { extractedText: "", success: false };
  }
}

/**
 * Check if extracted text contains ID document keywords
 */
function checkForIDKeywords(
  extractedText: string
): { found: boolean; documentType?: string; matchedKeywords: string[] } {
  
  if (!extractedText || extractedText.length < 10) {
    return { found: false, matchedKeywords: [] };
  }
  
  const upperText = extractedText.toUpperCase();
  const matchedKeywords: string[] = [];
  let documentType: string | undefined;
  
  // Check for each keyword
  for (const keyword of ID_KEYWORDS) {
    if (upperText.includes(keyword)) {
      matchedKeywords.push(keyword);
      
      // Determine document type
      if (!documentType) {
        if (keyword.includes("PASSPORT")) documentType = "Passport";
        else if (keyword.includes("AADHAAR") || keyword.includes("AADHAR")) documentType = "Aadhaar";
        else if (keyword.includes("DRIVER") || keyword.includes("DRIVING") || keyword.includes("LICENSE")) documentType = "Driver License";
        else if (keyword.includes("NATIONAL ID")) documentType = "National ID";
        else if (keyword.includes("PAN")) documentType = "PAN Card";
        else if (keyword.includes("VOTER")) documentType = "Voter ID";
        else if (keyword.includes("RESIDENCE") || keyword.includes("PERMIT")) documentType = "Residence Permit";
        else if (keyword.includes("SOCIAL SECURITY") || keyword.includes("SSN")) documentType = "Social Security Card";
        else documentType = "Government ID";
      }
    }
  }
  
  // Require at least 1 keyword (reduced from 2 for better acceptance)
  // Strong keywords (like AADHAAR, PASSPORT, UIDAI) count as 2
  const strongKeywords = ["AADHAAR", "AADHAR", "PASSPORT", "UIDAI", "NATIONAL ID", "DRIVER", "DRIVING", "LICENSE"];
  const hasStrongKeyword = matchedKeywords.some(kw => strongKeywords.some(sk => kw.includes(sk)));
  
  // Require at least 1 keyword, or if we have a strong keyword, that's enough
  const found = matchedKeywords.length >= 1 || hasStrongKeyword;
  
  console.log("ID keyword check:", {
    found,
    matchedKeywords: matchedKeywords.slice(0, 20), // Log first 20
    matchedKeywordsCount: matchedKeywords.length,
    documentType,
    textLength: extractedText.length,
    hasStrongKeyword,
    extractedTextPreview: extractedText.substring(0, 200), // Show preview of extracted text
  });
  
  return { found, documentType, matchedKeywords };
}

/**
 * Load image from data URL
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

