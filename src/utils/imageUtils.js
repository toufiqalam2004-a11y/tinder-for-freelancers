export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validates file type and size according to specification.
 * @param {File} file 
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateProfileImage(file) {
  if (!file) {
    return { isValid: false, error: 'Please choose an image file.' };
  }

  const fileType = (file.type || '').toLowerCase();
  const fileName = (file.name || '').toLowerCase();
  const hasValidType = ALLOWED_IMAGE_TYPES.includes(fileType);
  const hasValidExt = ALLOWED_IMAGE_EXTENSIONS.some((ext) => fileName.endsWith(ext));

  if (!hasValidType && !hasValidExt) {
    return { isValid: false, error: 'Please choose a JPG, PNG, or WEBP image.' };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { isValid: false, error: 'Image must be smaller than 5 MB.' };
  }

  return { isValid: true };
}

/**
 * Reads and scales down an image to max dimensions to keep storage efficient.
 * @param {File} file 
 * @param {number} maxWidth 
 * @param {number} maxHeight 
 * @param {number} quality 
 * @returns {Promise<string>} Base64 data URL
 */
export function processImageFile(file, maxWidth = 320, maxHeight = 320, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(outputType, quality);
          resolve(dataUrl);
        } catch (err) {
          resolve(event.target.result);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image. The file may be corrupt.'));
      };

      img.src = event.target.result;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read image file.'));
    };

    reader.readAsDataURL(file);
  });
}
