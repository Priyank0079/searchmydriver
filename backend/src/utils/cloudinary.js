import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a file buffer to Cloudinary using upload_stream
 * @param {Buffer} fileBuffer - The file buffer from multer
 * @param {string} folder - The destination folder in Cloudinary
 * @returns {Promise<Object>} - The Cloudinary upload response (secure_url, public_id)
 */
export const uploadToCloudinary = (fileBuffer, folder = 'searchmydriver', options = {}) => {
  const { resourceType = 'auto' } = options;
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

/**
 * Deletes a file from Cloudinary using its public_id
 * @param {string} publicId - The public_id of the file to delete
 * @returns {Promise<Object>} - The Cloudinary destruction response
 */
export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    if (!publicId) return null;
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return result;
  } catch (error) {
    console.error(`Error deleting from Cloudinary (${publicId}):`, error);
    return null; // Return null on error so we don't crash the main process if deletion fails
  }
};
