import api from './api';

/**
 * Uploads an image file to the backend, which forwards it to Cloudinary.
 * @param {File} file - The image file from the input element
 * @param {string} [oldPublicId] - Optional. The public_id of the previous image to delete from Cloudinary
 * @returns {Promise<{url: string, publicId: string}>} - The Cloudinary secure URL and public_id
 */
export const uploadImage = async (file, oldPublicId = null) => {
  const formData = new FormData();
  formData.append('image', file);
  if (oldPublicId) {
    formData.append('oldPublicId', oldPublicId);
  }

  const response = await api.post('/common/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.data;
};
