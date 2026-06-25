import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Check, RefreshCw } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import toast from 'react-hot-toast';

const CameraCaptureModal = ({ isOpen, onClose, onCapture, title = 'Take Selfie' }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Stop camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Start camera stream
  const startCamera = async () => {
    setPhotoUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err) {
      toast.error('Unable to access camera. Please check permissions.');
      console.error('Camera error:', err);
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return stopCamera;
  }, [isOpen]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image as base64 string
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setPhotoUrl(dataUrl);
    stopCamera();
  };

  const confirmPhoto = () => {
    if (!photoUrl) return;
    
    // Convert base64 to File object
    const arr = photoUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const file = new File([u8arr], 'live_selfie.jpg', { type: mime });
    
    onCapture(file);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col items-center justify-center space-y-6">
        
        {/* Viewport for Camera / Captured Image */}
        <div className="relative w-full max-w-sm aspect-[3/4] bg-black rounded-2xl overflow-hidden shadow-inner">
          {!photoUrl ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <img src={photoUrl} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />
          )}
          
          {/* Hidden Canvas for capturing */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 w-full px-4 pb-2">
          {!photoUrl ? (
            <button
              onClick={capturePhoto}
              disabled={!isCameraActive}
              className="w-16 h-16 rounded-full bg-primary/20 border-4 border-primary flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
            >
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white">
                <Camera className="w-6 h-6" />
              </div>
            </button>
          ) : (
            <div className="flex items-center justify-between w-full max-w-xs gap-4">
              <Button variant="outline" onClick={startCamera} className="flex-1 flex items-center gap-2 text-primary border-primary">
                <RefreshCw className="w-4 h-4" /> Retake
              </Button>
              <Button onClick={confirmPhoto} className="flex-1 flex items-center gap-2">
                <Check className="w-4 h-4" /> Confirm
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CameraCaptureModal;
