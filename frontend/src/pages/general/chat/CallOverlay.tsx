/**
 * CallOverlay — Full-screen overlay for active voice/video calls.
 *
 * Shows:
 *   - Ringing state (outgoing/incoming animation)
 *   - Active call with local + remote video tiles
 *   - Floating controls: mute, camera, screen share, speaker, end
 *   - Call timer
 *   - Group call grid layout (up to 6 tiles)
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  PhoneXMarkIcon,
  MicrophoneIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ComputerDesktopIcon,
} from '@heroicons/react/24/solid';
import type { CallState } from '../../../services/webrtcService';

/* ────────────────────────────────────────────────────────── */

interface CallOverlayProps {
  callState: CallState;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  participantNames: Map<string, string>;
  participantAvatars: Map<string, string | null>;
  callerName?: string;
}

export default function CallOverlay({
  callState,
  localStream,
  remoteStreams,
  onEndCall,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  isMuted,
  isCameraOff,
  isScreenSharing,
  participantNames,
  participantAvatars,
  callerName,
}: CallOverlayProps) {
  const [elapsed, setElapsed] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(true);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Timer
  useEffect(() => {
    if (callState.status !== 'active') {
      setElapsed(0);
      return;
    }
    const start = callState.startedAt || Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [callState.status, callState.startedAt]);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const isVideo = callState.callType === 'video';
  const isRinging = callState.status === 'ringing' || callState.status === 'connecting';
  const remoteEntries = useMemo(() => Array.from(remoteStreams.entries()), [remoteStreams]);

  // Determine grid columns for multiple participants
  const gridCols = remoteEntries.length <= 1 ? 1 : remoteEntries.length <= 4 ? 2 : 3;

  return (
    <div className="fixed inset-0 z-[9999] bg-gray-900 flex flex-col">
      {/* ── Top bar ──────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-900/80">
        <div>
          <p className="text-white/60 text-xs uppercase tracking-wider">
            {callState.callType === 'video' ? 'Video Call' : 'Voice Call'}
          </p>
          <p className="text-white text-sm font-medium mt-0.5">
            {callerName || 'Call'}
          </p>
        </div>
        <div className="text-white/80 text-sm font-mono">
          {isRinging ? (
            <span className="animate-pulse">
              {callState.direction === 'outgoing' ? 'Ringing...' : 'Connecting...'}
            </span>
          ) : (
            formatTime(elapsed)
          )}
        </div>
      </div>

      {/* ── Main content area ────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        {isRinging ? (
          /* ── Ringing state ── */
          <div className="flex-1 flex flex-col items-center justify-center h-full">
            {/* Pulse rings */}
            <div className="relative mb-8">
              <div className="absolute inset-0 w-28 h-28 rounded-full bg-blue-500/20 animate-ping" />
              <div className="absolute inset-2 w-24 h-24 rounded-full bg-blue-500/30 animate-ping animation-delay-200" />
              <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl">
                {callerName ? (
                  <span className="text-white text-3xl font-bold">
                    {callerName.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <PhoneXMarkIcon className="w-10 h-10 text-white" />
                )}
              </div>
            </div>
            <h2 className="text-white text-2xl font-semibold mb-1">{callerName || 'Unknown'}</h2>
            <p className="text-white/60 text-sm">
              {callState.direction === 'outgoing' ? 'Calling...' : 'Incoming call'}
            </p>
          </div>
        ) : isVideo ? (
          /* ── Video call layout ── */
          <>
            {/* Remote video grid */}
            <div
              className="w-full h-full grid gap-1 p-1"
              style={{
                gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                gridAutoRows: '1fr',
              }}
            >
              {remoteEntries.length > 0 ? (
                remoteEntries.map(([userId, stream]) => (
                  <RemoteVideoTile
                    key={userId}
                    stream={stream}
                    name={participantNames.get(userId) || userId}
                    avatarUrl={participantAvatars.get(userId)}
                  />
                ))
              ) : (
                <div className="flex items-center justify-center bg-gray-800 rounded-lg">
                  <p className="text-white/40 text-sm">Waiting for participant...</p>
                </div>
              )}
            </div>

            {/* Local video PIP */}
            <div className="absolute bottom-24 right-4 w-36 h-48 rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700/50 bg-gray-800">
              {!isCameraOff && localStream ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                  style={{ transform: 'scaleX(-1)' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-700">
                  <VideoCameraSlashIcon className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div className="absolute bottom-1 left-1 text-[10px] text-white/70 bg-black/50 px-1.5 py-0.5 rounded">
                You
              </div>
            </div>
          </>
        ) : (
          /* ── Voice call layout ── */
          <div className="flex-1 flex flex-col items-center justify-center h-full">
            {/* Participant avatars in a row */}
            <div className="flex items-center gap-4 mb-8">
              {remoteEntries.length > 0 ? (
                remoteEntries.map(([userId]) => {
                  const name = participantNames.get(userId) || userId;
                  const avatar = participantAvatars.get(userId);
                  return (
                    <div key={userId} className="flex flex-col items-center">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl mb-2">
                        {avatar ? (
                          <img src={avatar} alt="" className="w-24 h-24 rounded-full object-cover" />
                        ) : (
                          <span className="text-white text-3xl font-bold">
                            {name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="text-white text-sm font-medium">{name}</p>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl mb-2">
                    <span className="text-white text-3xl font-bold">
                      {(callerName || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-white text-sm font-medium">{callerName}</p>
                </div>
              )}
            </div>

            {/* Audio waveform visualization */}
            <div className="flex items-center gap-1 mb-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-blue-400 rounded-full animate-pulse"
                  style={{
                    height: `${Math.random() * 24 + 8}px`,
                    animationDelay: `${i * 100}ms`,
                    animationDuration: `${600 + Math.random() * 400}ms`,
                  }}
                />
              ))}
            </div>

            <p className="text-white/50 text-sm">{formatTime(elapsed)}</p>
          </div>
        )}
      </div>

      {/* ── Controls ─────────────────────────────────── */}
      <div className="flex items-center justify-center gap-4 py-6 bg-gradient-to-t from-gray-900 via-gray-900/95 to-transparent">
        {/* Mute */}
        <button
          onClick={onToggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            isMuted
              ? 'bg-red-500/20 text-red-400 ring-2 ring-red-500/40'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M1.5 4.83l2.22 2.22A6.98 6.98 0 003 11v1c0 3.87 3.13 7 7 7v-2c-2.76 0-5-2.24-5-5v-1c0-.73.16-1.43.44-2.06l1.56 1.56V11c0 1.66 1.34 3 3 3 .23 0 .44-.03.65-.08l1.66 1.66C11.55 15.85 11.29 16 11 16H9c-2.76 0-5 2.24-5 5h2c0-1.66 1.34-3 3-3h2c.36 0 .71-.07 1.03-.18l5.47 5.47 1.41-1.41L2.91 3.41 1.5 4.83zM12 1c-1.66 0-3 1.34-3 3v4.17l6 6V4c0-1.66-1.34-3-3-3z" />
            </svg>
          ) : (
            <MicrophoneIcon className="w-6 h-6" />
          )}
        </button>

        {/* Camera (video calls only) */}
        {isVideo && (
          <button
            onClick={onToggleCamera}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isCameraOff
                ? 'bg-red-500/20 text-red-400 ring-2 ring-red-500/40'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isCameraOff ? (
              <VideoCameraSlashIcon className="w-6 h-6" />
            ) : (
              <VideoCameraIcon className="w-6 h-6" />
            )}
          </button>
        )}

        {/* Screen share (video calls only) */}
        {isVideo && (
          <button
            onClick={onToggleScreenShare}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isScreenSharing
                ? 'bg-blue-500/20 text-blue-400 ring-2 ring-blue-500/40'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            <ComputerDesktopIcon className="w-6 h-6" />
          </button>
        )}

        {/* Speaker */}
        <button
          onClick={() => setSpeakerOn(!speakerOn)}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            !speakerOn
              ? 'bg-red-500/20 text-red-400 ring-2 ring-red-500/40'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title={speakerOn ? 'Mute speaker' : 'Unmute speaker'}
        >
          {speakerOn ? (
            <SpeakerWaveIcon className="w-6 h-6" />
          ) : (
            <SpeakerXMarkIcon className="w-6 h-6" />
          )}
        </button>

        {/* End call */}
        <button
          onClick={onEndCall}
          className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white shadow-lg shadow-red-600/30 transition-all hover:scale-105"
          title="End call"
        >
          <PhoneXMarkIcon className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  Remote Video Tile                                          */
/* ═══════════════════════════════════════════════════════════ */

function RemoteVideoTile({
  stream,
  name,
  avatarUrl,
}: {
  stream: MediaStream;
  name: string;
  avatarUrl?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
    // Check if stream has active video tracks
    const videoTracks = stream.getVideoTracks();
    setHasVideo(videoTracks.length > 0 && videoTracks[0].enabled);

    const handleTrackChange = () => {
      const vt = stream.getVideoTracks();
      setHasVideo(vt.length > 0 && vt[0].enabled);
    };
    stream.addEventListener('addtrack', handleTrackChange);
    stream.addEventListener('removetrack', handleTrackChange);
    return () => {
      stream.removeEventListener('addtrack', handleTrackChange);
      stream.removeEventListener('removetrack', handleTrackChange);
    };
  }, [stream]);

  return (
    <div className="relative rounded-lg overflow-hidden bg-gray-800">
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-2">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <span className="text-white text-2xl font-bold">{name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <audio ref={videoRef as any} autoPlay playsInline />
        </div>
      )}
      <div className="absolute bottom-2 left-2 text-xs text-white bg-black/60 px-2 py-1 rounded-md">
        {name}
      </div>
    </div>
  );
}
