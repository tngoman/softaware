import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid';

interface AudioPlayerProps {
  src: string;
  duration?: number | null;
  /** Waveform: pre-computed bars (0-1) — if not supplied, we generate one from the audio */
  waveformData?: number[];
  compact?: boolean;
}

/**
 * Custom audio player with waveform visualization and seek support.
 * Replaces the default <audio> element for chat voice notes and audio files.
 */
export default function AudioPlayer({ src, duration, waveformData, compact }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [bars, setBars] = useState<number[]>(waveformData || []);
  const [loaded, setLoaded] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const waveformRef = useRef<HTMLDivElement>(null);

  const BAR_COUNT = compact ? 30 : 50;

  // Generate waveform from audio data
  useEffect(() => {
    if (waveformData && waveformData.length > 0) {
      setBars(waveformData);
      return;
    }

    // Decode audio to generate waveform
    let cancelled = false;
    const generateWaveform = async () => {
      try {
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const channelData = audioBuffer.getChannelData(0);
        const blockSize = Math.floor(channelData.length / BAR_COUNT);
        const generatedBars: number[] = [];

        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0;
          const start = i * blockSize;
          for (let j = start; j < start + blockSize && j < channelData.length; j++) {
            sum += Math.abs(channelData[j]);
          }
          generatedBars.push(sum / blockSize);
        }

        // Normalize to 0..1
        const max = Math.max(...generatedBars, 0.01);
        const normalized = generatedBars.map((b) => b / max);

        if (!cancelled) {
          setBars(normalized);
          if (!duration) setTotalDuration(audioBuffer.duration);
        }

        audioContext.close();
      } catch {
        // Fallback: show uniform bars
        if (!cancelled) {
          setBars(Array(BAR_COUNT).fill(0.5));
        }
      }
    };

    generateWaveform();
    return () => { cancelled = true; };
  }, [src, BAR_COUNT, duration, waveformData]);

  // Audio event handlers
  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setTotalDuration(audioRef.current.duration || duration || 0);
      setLoaded(true);
    }
  }, [duration]);

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current) return;
    const cur = audioRef.current.currentTime;
    const dur = audioRef.current.duration || totalDuration;
    setCurrentTime(cur);
    setProgress(dur > 0 ? cur / dur : 0);
  }, [totalDuration]);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  }, []);

  // Play / Pause
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
    setPlaying(!playing);
  }, [playing]);

  // Seek by clicking on waveform
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !waveformRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const dur = audioRef.current.duration || totalDuration;
    audioRef.current.currentTime = ratio * dur;
    setProgress(ratio);
    setCurrentTime(ratio * dur);
  }, [totalDuration]);

  // Playback speed toggle
  const cycleSpeed = useCallback(() => {
    const speeds = [1, 1.5, 2, 0.5];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const next = speeds[nextIdx];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }, [playbackRate]);

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return '0:00';
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Determine display bars (pad or truncate)
  const displayBars = useMemo(() => {
    if (bars.length === 0) return Array(BAR_COUNT).fill(0.3);
    if (bars.length >= BAR_COUNT) return bars.slice(0, BAR_COUNT);
    // Interpolate
    const result: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      const idx = (i / BAR_COUNT) * bars.length;
      const low = Math.floor(idx);
      const high = Math.min(low + 1, bars.length - 1);
      const frac = idx - low;
      result.push(bars[low] * (1 - frac) + bars[high] * frac);
    }
    return result;
  }, [bars, BAR_COUNT]);

  return (
    <div className={`flex items-center gap-2 ${compact ? 'py-1' : 'py-1.5'} min-w-[200px] max-w-[280px]`}>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />

      {/* Play / Pause button */}
      <button
        onClick={togglePlay}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-sm transition-colors"
      >
        {playing ? (
          <PauseIcon className="w-4 h-4 text-blue-600" />
        ) : (
          <PlayIcon className="w-4 h-4 text-blue-600 ml-0.5" />
        )}
      </button>

      {/* Waveform + time */}
      <div className="flex-1 min-w-0">
        {/* Waveform bars */}
        <div
          ref={waveformRef}
          className="flex items-end gap-[1px] h-6 cursor-pointer"
          onClick={handleSeek}
        >
          {displayBars.map((bar, i) => {
            const playedRatio = progress * displayBars.length;
            const isPlayed = i < playedRatio;
            return (
              <div
                key={i}
                className={`flex-1 rounded-full transition-colors duration-100 ${
                  isPlayed ? 'bg-blue-600' : 'bg-blue-300/60'
                }`}
                style={{
                  height: `${Math.max(12, bar * 100)}%`,
                  minWidth: '2px',
                  maxWidth: '4px',
                }}
              />
            );
          })}
        </div>

        {/* Time + speed */}
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[10px] text-gray-500 font-mono">
            {playing || currentTime > 0
              ? formatTime(currentTime)
              : formatTime(totalDuration)}
          </span>
          <button
            onClick={cycleSpeed}
            className="text-[9px] font-medium text-gray-400 hover:text-gray-600 px-1 rounded"
            title="Playback speed"
          >
            {playbackRate}×
          </button>
        </div>
      </div>
    </div>
  );
}
