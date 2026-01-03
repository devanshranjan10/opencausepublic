import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class OCRService {
  constructor(private configService: ConfigService) {
    // OCR is handled client-side with Tesseract.js
    // This service is kept for API compatibility but OCR is done in the frontend
  }

  /**
   * Extract text from a base64 image
   * Note: OCR is handled client-side with Tesseract.js in the frontend
   * This method is kept for API compatibility
   */
  async extractTextFromImage(base64Image: string): Promise<{
    extractedText: string;
    success: boolean;
    blocks?: any[];
  }> {
    // OCR is done client-side, so this is just a stub for API compatibility
    console.log("OCR service called, but OCR is handled client-side");
    return {
      extractedText: "",
      success: false,
    };
  }
}




