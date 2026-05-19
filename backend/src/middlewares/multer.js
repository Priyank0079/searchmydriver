import multer from 'multer';

const storage = multer.memoryStorage();

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
const MAX_IMAGE_BYTES = 200 * 1024;

const imageFileFilter = (req, file, cb) => {
  if (IMAGE_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, JPG, and WEBP are allowed.'), false);
  }
};

export const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_IMAGE_BYTES,
  },
});

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v)$/i;

function isAllowedVideo(file) {
  const mime = (file.mimetype || '').toLowerCase();
  const name = file.originalname || '';

  if (mime.startsWith('video/')) return true;
  if (mime === 'application/octet-stream' && VIDEO_EXTENSIONS.test(name)) return true;

  return ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov', 'video/x-msvideo'].includes(mime);
}

const videoFileFilter = (req, file, cb) => {
  if (isAllowedVideo(file)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only MP4, WEBM, and MOV videos are allowed.'), false);
  }
};

export const uploadVideo = multer({
  storage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});
