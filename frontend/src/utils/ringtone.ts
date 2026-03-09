/**
 * Ringtone utility — plays/stops the incoming call ringtone sound.
 * Shared between GlobalCallProvider and ChatPage.
 */

let ringingAudio: HTMLAudioElement | null = null;
let webAudioCtx: AudioContext | null = null;
let webAudioOsc: OscillatorNode | null = null;
let webAudioInterval: ReturnType<typeof setInterval> | null = null;

export function startRinging(): void {
  // Don't restart if already playing
  if (ringingAudio && !ringingAudio.paused) return;

  try {
    if (!ringingAudio) {
      ringingAudio = new Audio('/sounds/ringtone.wav');
      ringingAudio.loop = true;
      ringingAudio.volume = 0.7;
    }
    ringingAudio.currentTime = 0;
    ringingAudio.play().catch(() => {
      // Autoplay blocked — generate a tone via Web Audio API
      try {
        webAudioCtx = new AudioContext();
        webAudioOsc = webAudioCtx.createOscillator();
        const gain = webAudioCtx.createGain();
        webAudioOsc.type = 'sine';
        webAudioOsc.frequency.value = 440;
        gain.gain.value = 0.3;
        webAudioOsc.connect(gain);
        gain.connect(webAudioCtx.destination);
        webAudioOsc.start();
        // Pulse pattern: 0.5s on, 0.5s off
        const pulse = () => {
          if (!webAudioCtx) return;
          gain.gain.setValueAtTime(0.3, webAudioCtx.currentTime);
          gain.gain.setValueAtTime(0, webAudioCtx.currentTime + 0.5);
          gain.gain.setValueAtTime(0.3, webAudioCtx.currentTime + 1.0);
          gain.gain.setValueAtTime(0, webAudioCtx.currentTime + 1.5);
        };
        pulse();
        webAudioInterval = setInterval(pulse, 2000);
      } catch {
        // Silently fail — no audio available
      }
    });
  } catch {
    // Silently fail
  }
}

export function stopRinging(): void {
  try {
    if (ringingAudio) {
      ringingAudio.pause();
      ringingAudio.currentTime = 0;
    }
    if (webAudioOsc) { try { webAudioOsc.stop(); } catch {} webAudioOsc = null; }
    if (webAudioCtx) { try { webAudioCtx.close(); } catch {} webAudioCtx = null; }
    if (webAudioInterval) { clearInterval(webAudioInterval); webAudioInterval = null; }
  } catch {}
}
