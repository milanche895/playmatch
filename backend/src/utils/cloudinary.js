const cloudinary = require('cloudinary').v2;
const axios = require('axios');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload image from URL to Cloudinary
 * @param {string} imageUrl - URL of the image to upload
 * @param {string} folder - Folder path in Cloudinary (optional)
 * @param {string} publicId - Public ID for the image (optional)
 * @returns {Promise<string>} - Cloudinary URL of the uploaded image
 */
async function uploadImageFromUrl(imageUrl, folder = 'avatars', publicId = null) {
  try {
    if (!imageUrl) {
      return null;
    }

    // Download the image from the URL
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'stream',
      timeout: 10000 // 10 second timeout
    });

    // Upload to Cloudinary
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          public_id: publicId,
          resource_type: 'image',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto' },
            { format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            resolve(result.secure_url);
          }
        }
      );

      response.data.pipe(uploadStream);
    });
  } catch (error) {
    console.error('Error uploading image to Cloudinary:', error.message);
    // If upload fails, return the original URL as fallback
    return imageUrl;
  }
}

module.exports = {
  uploadImageFromUrl
};
