import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MicrophoneIcon, StopIcon, TrashIcon, PaperAirplaneIcon } from '@heroicons/react/24/solid';

interface VoiceRecorderProps {
  onSend: (file: { name: string; type: string; size: number; base64: string; duration: number }) => void;
  onCancel: () => void;
}

/**
 * VoiceRecorder — Hold-to-record voice note with live waveform visualizer.
 *
 * States:
 *   idle → recording → review (play back & send or discard)
 */
export default function VoiceRecorder({ onSend, onCancel }: VoiceRecorderProps) {
  const [state, setState] = useState<'idle' | 'recording' | 'review'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [reviewPlaying, setReviewPlaying] = useState(false);
  const [reviewProgress, setReviewProgress] = useState(0);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const analyser = useRef<AnalyserNode | null>(null);
  const animFrame = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const startTimeRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Waveform bars for review display (sampled during recording)
  const waveformBars = useRef<number[]>([]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopRecording(true);
      if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    };
  }, []);

  /* ─── Start recording ─── */
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Audio analyser for waveform
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createAnalyser();
      node.fftSize = 256;
      source.connect(node);
      analyser.current = node;

      // MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunks.current = [];
      waveformBars.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: mimeType });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setReviewUrl(url);
        setWaveform([...waveformBars.current]);
        setState('review');
      };

      recorder.start(100); // Collect chunks every 100ms
      mediaRecorder.current = recorder;
      startTimeRef.current = Date.now();
      setState('recording');
      setElapsed(0);

      // Timer
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 200);

      // Waveform animation
      drawWaveform();
    } catch (err: any) {
      console.error('Microphone access error:', err);
      onCancel();
    }
  }, [onCancel]);

  /* ─── Draw live waveform onto canvas ─── */
  const drawWaveform = useCallback(() => {
    const draw = () => {
      if (!analyser.current || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const data = new Uint8Array(analyser.current.frequencyBinCount);
      analyser.current.getByteTimeDomainData(data);

      // Average amplitude → 0..1
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += Math.abs(data[i] - 128);
      }
      const avg = sum / data.length / 128;
      waveformBars.current.push(Math.min(avg * 2.5, 1)); // Boost a bit
      if (waveformBars.current.length > 200) waveformBars.current.shift();

      // Draw bars
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const bars = waveformBars.current;
      const barWidth = 3;
      const gap = 1;
      const maxBars = Math.floor(width / (barWidth + gap));
      const startIdx = Math.max(0, bars.length - maxBars);

      ctx.fillStyle = '#3b82f6';
      for (let i = startIdx; i < bars.length; i++) {
        const x = (i - startIdx) * (barWidth + gap);
        const barH = Math.max(2, bars[i] * height * 0.9);
        const y = (height - barH) / 2;
        ctx.fillRect(x, y, barWidth, barH);
      }

      animFrame.current = requestAnimationFrame(draw);
    };
    draw();
  }, []);

  /* ─── Stop recording ─── */
  const stopRecording = useCallback((cleanup = false) => {
    cancelAnimationFrame(animFrame.current);
    if (timerRef.current) clearInterval(timerRef.current);

    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (cleanup) {
      mediaRecorder.current = null;
      analyser.current = null;
    }
  }, []);

  /* ─── Discard recording ─── */
  const handleDiscard = useCallback(() => {
    stopRecording(true);
    if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    setReviewUrl(null);
    blobRef.current = null;
    setWaveform([]);
    setElapsed(0);
    setState('idle');
    onCancel();
  }, [reviewUrl, stopRecording, onCancel]);

  /* ─── Send the recording ─── */
  const handleSend = useCallback(async () => {
    const blob = blobRef.current;
    if (!blob) return;

    // Convert blob to base64
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const ext = blob.type.includes('webm') ? 'webm' : 'mp4';
    onSend({
      name: `voice_note_${Date.now()}.${ext}`,
      type: blob.type,
      size: blob.size,
      base64,
      duration: elapsed,
    });

    // Clean up
    if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    setReviewUrl(null);
    blobRef.current = null;
    setWaveform([]);
    setElapsed(0);
    setState('idle');
  }, [elapsed, onSend, reviewUrl]);

  /* ─── Review: play/pause ─── */
  const toggleReviewPlay = useCallback(() => {
    if (!audioElRef.current) return;
    if (reviewPlaying) {
      audioElRef.current.pause();
    } else {
      audioElRef.current.play();
    }
    setReviewPlaying(!reviewPlaying);
  }, [reviewPlaying]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  /* ─── Render ─── */

  // Idle → show mic button
  if (state === 'idle') {
    return (
      <button
        onMouseDown={startRecording}
        className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors"
        title="Record voice note"
      >
        <MicrophoneIcon className="w-5 h-5" />
      </button>
    );
  }

  // Recording → show live waveform + stop button
  if (state === 'recording') {
    return (
      <div className="flex items-center gap-2 flex-1 bg-red-50 rounded-2xl px-3 py-2 border border-red-200">
        {/* Discard */}
        <button
          onClick={handleDiscard}
          className="p-1.5 rounded-full hover:bg-red-100 text-red-400"
          title="Cancel"
        >
          <TrashIcon className="w-4 h-4" />
        </button>

        {/* Duration */}
        <span className="text-sm font-mono text-red-600 min-w-[40px]">
          {formatTime(elapsed)}
        </span>

        {/* Recording indicator */}
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />

        {/* Live waveform canvas */}
        <canvas
          ref={canvasRef}
          width={200}
          height={32}
          className="flex-1 max-w-[200px]"
        />

        {/* Stop & go to review */}
        <button
          onClick={() => stopRecording()}
          className="p-2 rounded-full bg-red-500 hover:bg-red-600 text-white"
          title="Stop recording"
        >
          <StopIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Review → show waveform, play/send/discard
  return (
    <div className="flex items-center gap-2 flex-1 bg-blue-50 rounded-2xl px-3 py-2 border border-blue-200">
      {/* Hidden audio for playback */}
      {reviewUrl && (
        <audio
          ref={audioElRef}
          src={reviewUrl}
          onTimeUpdate={() => {
            if (audioElRef.current) {
              setReviewProgress(
                audioElRef.current.duration
                  ? audioElRef.current.currentTime / audioElRef.current.duration
                  : 0,
              );
            }
          }}
          onEnded={() => {
            setReviewPlaying(false);
            setReviewProgress(0);
          }}
        />
      )}

      {/* Discard */}
      <button
        onClick={handleDiscard}
        className="p-1.5 rounded-full hover:bg-red-100 text-red-400"
        title="Discard"
      >
        <TrashIcon className="w-4 h-4" />
      </button>

      {/* Play / Pause */}
      <button
        onClick={toggleReviewPlay}
        className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white"
        title={reviewPlaying ? 'Pause' : 'Play'}
      >
        {reviewPlaying ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <rect x="5" y="3" width="4" height="14" rx="1" />
            <rect x="11" y="3" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
          </svg>
        )}
      </button>

      {/* Static waveform with progress overlay */}
      <div className="flex-1 flex items-center gap-[1px] h-8 max-w-[200px] relative">
        {waveform.length > 0 && waveform.slice(-60).map((bar, i, arr) => {
          const progress = reviewProgress * arr.length;
          const isPlayed = i < progress;
          return (
            <div
              key={i}
              className={`w-[3px] rounded-full transition-colors ${
                isPlayed ? 'bg-blue-500' : 'bg-blue-300'
              }`}
              style={{ height: `${Math.max(8, bar * 100)}%` }}
            />
          );
        })}
      </div>

      {/* Duration */}
      <span className="text-xs font-mono text-blue-600 min-w-[32px]">
        {formatTime(elapsed)}
      </span>

      {/* Send */}
      <button
        onClick={handleSend}
        className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white"
        title="Send voice note"
      >
        <PaperAirplaneIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
