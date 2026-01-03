/**
 * Compress and resize image to reduce file size
 * @param base64Image - Base64 encoded image (with or without data URL prefix)
 * @param maxWidth - Maximum width in pixels (default: 1920)
 * @param maxHeight - Maximum height in pixels (default: 1920)
 * @param quality - JPEG quality 0-1 (default: 0.8)
 * @returns Compressed base64 image
 */
export async function compressImage(
  base64Image: string,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      // Calculate new dimensions
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = width * ratio;
        height = height * ratio;
      }
      
      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Draw image with smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to base64 with compression
      const mimeType = base64Image.includes('data:image/png') ? 'image/png' : 'image/jpeg';
      const compressedBase64 = canvas.toDataURL(mimeType, quality);
      
      resolve(compressedBase64);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    // Ensure image has data URL prefix for loading
    if (!base64Image.startsWith('data:')) {
      img.src = `data:image/jpeg;base64,${base64Image}`;
    } else {
      img.src = base64Image;
    }
  });
}

/**
 * Compress multiple images in parallel
 */
export async function compressImages(
  images: string[],
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.8
): Promise<string[]> {
  return Promise.all(
    images.map(img => compressImage(img, maxWidth, maxHeight, quality))
  );
}

