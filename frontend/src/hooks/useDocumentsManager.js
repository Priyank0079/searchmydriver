import { useState, useCallback, useMemo } from 'react';
import { uploadImage } from '../utils/upload';
import { validateImageFile } from '../utils/fileLimits';
import { EMPTY_DOCUMENT, documentsArrayToMap, documentsMapToArray } from '../utils/documents';

/**
 * Manages multiple document slots (one file per type). Re-upload replaces previous Cloudinary asset.
 * @param {string[]} documentTypes
 */
export function useDocumentsManager(documentTypes = []) {
  const [documents, setDocuments] = useState(() =>
    documentTypes.reduce((acc, type) => ({ ...acc, [type]: { ...EMPTY_DOCUMENT } }), {}),
  );

  const loadFromApiDocuments = useCallback(
    (apiDocuments) => {
      const map = documentsArrayToMap(apiDocuments, documentTypes.length ? documentTypes : null);
      setDocuments((prev) => {
        const next = { ...prev };
        documentTypes.forEach((type) => {
          next[type] = map[type] || { ...EMPTY_DOCUMENT };
        });
        return next;
      });
    },
    [documentTypes],
  );

  const uploadDocument = useCallback(async (type, file) => {
    if (!file || !type) return;

    const check = validateImageFile(file);
    if (!check.ok) {
      throw new Error(check.message);
    }

    let previousPublicId = null;
    setDocuments((prev) => {
      previousPublicId = prev[type]?.publicId;
      return {
        ...prev,
        [type]: { ...(prev[type] || EMPTY_DOCUMENT), loading: true },
      };
    });

    try {
      const result = await uploadImage(file, previousPublicId);
      setDocuments((prev) => ({
        ...prev,
        [type]: {
          url: result.url,
          publicId: result.publicId,
          loading: false,
        },
      }));
      return result;
    } catch (error) {
      setDocuments((prev) => ({
        ...prev,
        [type]: { ...(prev[type] || EMPTY_DOCUMENT), loading: false },
      }));
      throw error;
    }
  }, []);

  const isAnyUploading = useMemo(
    () => Object.values(documents).some((d) => d?.loading),
    [documents],
  );

  const allRequiredUploaded = useCallback(
    (requiredTypes) => requiredTypes.every((type) => Boolean(documents[type]?.url) && !documents[type]?.loading),
    [documents],
  );

  const toPayloadArray = useCallback(() => documentsMapToArray(documents), [documents]);

  return {
    documents,
    loadFromApiDocuments,
    uploadDocument,
    isAnyUploading,
    allRequiredUploaded,
    toPayloadArray,
  };
}
