import { useCallback, useEffect, useRef, useState } from 'react';
import { Circle, Square, Video } from 'lucide-react';
import Button from './Button';
import {
  LIVE_VERIFICATION_MIN_SECONDS,
  LIVE_VERIFICATION_MAX_SECONDS,
} from '../utils/driverOnboarding';

/**
 * In-browser live camera recording only (no file upload).
 */
const LiveVideoRecorder = ({
  minSeconds = LIVE_VERIFICATION_MIN_SECONDS,
  maxSeconds = LIVE_VERIFICATION_MAX_SECONDS,
  onRecordingComplete,
  disabled = false,
}) => {
  const videoRef = useRef(null);
  const previewRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const secondsRef = useRef(0);

  const [phase, setPhase] = useState('idle'); // idle | recording | preview
  const [seconds, setSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopStream();
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, [stopStream]);

  const pickMimeType = () => {
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  };

  const startRecording = async () => {
    setError('');
    setStarting(true);
    setRecordedBlob(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stopStream();
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'video/webm',
        });
        const duration = secondsRef.current;
        setRecordedBlob(blob);
        setPhase('preview');
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        onRecordingComplete?.(blob, duration);
      };

      recorder.start(1000);
      setPhase('recording');
      setSeconds(0);
      secondsRef.current = 0;

      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          secondsRef.current = next;
          if (next >= maxSeconds) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      console.error(err);
      setError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Allow camera access to continue.'
          : 'Could not access camera. Use HTTPS and a supported browser.',
      );
      stopStream();
    } finally {
      setStarting(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const discardRecording = () => {
    setRecordedBlob(null);
    setSeconds(0);
    setPhase('idle');
    setError('');
    if (previewRef.current) {
      previewRef.current.removeAttribute('src');
      URL.revokeObjectURL(previewRef.current.src);
    }
  };

  useEffect(() => {
    if (phase === 'preview' && recordedBlob && previewRef.current) {
      const url = URL.createObjectURL(recordedBlob);
      previewRef.current.src = url;
      return () => URL.revokeObjectURL(url);
    }
    return undefined;
  }, [phase, recordedBlob]);

  const canStop = phase === 'recording' && seconds >= minSeconds;
  const tooShort = phase === 'preview' && seconds < minSeconds;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-black/90 overflow-hidden aspect-[3/4] max-h-[420px] relative">
        {phase === 'preview' ? (
          <video
            ref={previewRef}
            className="w-full h-full object-cover"
            controls
            playsInline
          />
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full object-cover mirror"
            muted
            playsInline
            autoPlay
          />
        )}

        {phase === 'recording' && (
          <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-600/90 text-white text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            REC {String(Math.floor(seconds / 60)).padStart(2, '0')}:
            {String(seconds % 60).padStart(2, '0')}
          </div>
        )}

        {phase === 'idle' && !streamRef.current && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-2 pointer-events-none">
            <Video className="w-10 h-10" />
            <p className="text-xs">Camera preview will appear here</p>
          </div>
        )}
      </div>

      {error && <p className="text-danger text-xs font-medium">{error}</p>}

      {tooShort && (
        <p className="text-amber-700 text-xs font-medium">
          Recording was too short. Please record at least {minSeconds} seconds.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {phase === 'idle' && (
          <Button
            type="button"
            fullWidth
            onClick={startRecording}
            loading={starting}
            disabled={disabled || starting}
            className="rounded-full py-4"
          >
            <Circle className="w-4 h-4 mr-2 inline" />
            Start live recording
          </Button>
        )}

        {phase === 'recording' && (
          <Button
            type="button"
            fullWidth
            variant="outline"
            onClick={stopRecording}
            disabled={!canStop}
            className="rounded-full py-4 border-rose-300 text-rose-700"
          >
            <Square className="w-4 h-4 mr-2 inline fill-current" />
            {canStop ? 'Stop recording' : `Record at least ${minSeconds}s…`}
          </Button>
        )}

        {phase === 'preview' && (
          <Button
            type="button"
            fullWidth
            variant="outline"
            onClick={discardRecording}
            disabled={disabled}
            className="rounded-full py-4"
          >
            Re-record video
          </Button>
        )}
      </div>

      <style>{`
        .mirror { transform: scaleX(-1); }
      `}</style>
    </div>
  );
};

export default LiveVideoRecorder;
