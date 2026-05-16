import { useState, useCallback } from 'react';
import api from '../utils/api';

/**
 * Upload training video to Cloudinary via API.
 */
export function useVideoUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const uploadVideo = useCallback(async (file, oldPublicId = '') => {
    if (!file) return null;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('video', file);
      if (oldPublicId) formData.append('oldPublicId', oldPublicId);

      const res = await api.post('/common/upload/video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Video upload failed');
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  return { uploadVideo, uploading, error, clearError: () => setError('') };
}
