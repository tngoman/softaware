# Mobile App — TTS Voice Selection Wiring Guide

> **Created:** March 14, 2026  
> **Purpose:** Step-by-step guide for wiring TTS voice selection and preview into the React Native mobile app so users can choose their preferred OpenAI TTS voice.  
> **Audience:** Mobile developer(s)  
> **Pre-requisite reading:** `opt/documentation/Mobile/MOBILE_APP_REFERENCE.md` (app structure)

---

## Table of Contents

1. [Overview](#1-overview)
2. [What Already Exists](#2-what-already-exists)
3. [What Changed on the Backend](#3-what-changed-on-the-backend)
4. [Available Voices](#4-available-voices)
5. [API Endpoints](#5-api-endpoints)
6. [TypeScript Types](#6-typescript-types)
7. [API Module Changes — `api/ai.ts`](#7-api-module-changes)
8. [Hook Changes — `useVoiceAssistant.ts`](#8-hook-changes)
9. [Voice Picker Component — `VoicePicker.tsx`](#9-voice-picker-component)
10. [Screen Changes — `AssistantFormScreen.tsx`](#10-screen-changes--assistantformscreentsx)
11. [Screen Changes — `AiChatScreen.tsx`](#11-screen-changes--aichatscreentsx)
12. [Caching & Persistence](#12-caching--persistence)
13. [Implementation Checklist](#13-implementation-checklist)

---

## 1. Overview

The app already has fully working TTS via the `useVoiceAssistant` hook, which uses `react-native-tts` for local speech synthesis. The backend also provides server-side TTS via OpenAI's `tts-1` model at `POST /api/v1/mobile/tts`.

**What's new:** Users can now choose from 6 OpenAI voices (alloy, echo, fable, onyx, nova, shimmer) and preview each one before selecting. The preference is stored per-assistant in the database via a new `tts_voice` column.

**Summary of work:**

| Area | Change |
|------|--------|
| **Backend** (already done) | New `tts_voice` column on `assistants` table. New `POST /tts/preview` endpoint. `POST /tts` now looks up user's saved voice as fallback. All assistant CRUD routes return `tts_voice`. |
| **Mobile** (you do this) | Add voice picker UI. Wire preview playback. Pass selected voice to TTS calls. Persist preference via assistant update API. |

---

## 2. What Already Exists

| Component | File | Relevant Detail |
|-----------|------|-----------------|
| `useVoiceAssistant` hook | `src/hooks/useVoiceAssistant.ts` | Push-to-talk state machine. Uses `react-native-tts` for local TTS. The hook handles STT → intent API → TTS response cycle. |
| `AiChatScreen` | `src/screens/ai/AiChatScreen.tsx` | Voice push-to-talk UI, text fallback, assistant picker. Consumes `useVoiceAssistant`. |
| `AssistantFormScreen` | `src/screens/ai/AssistantFormScreen.tsx` | Create/edit assistant — personality, voice style chips, preferred model. **This is where the voice picker should go.** |
| `aiApi` module | `src/api/ai.ts` | `aiApi.getAssistants()`, `aiApi.createAssistant()`, `aiApi.updateAssistant()`, `aiApi.sendIntent()` — all assistant CRUD + mobile intent. |
| `react-native-tts` | Installed | Local on-device TTS. Currently used by the voice assistant hook. |
| `react-native-audio-recorder-player` | Installed | Audio playback. Can be used for playing MP3 previews from the server. |
| `react-native-video` | Installed | Video playback — could also play audio but `react-native-audio-recorder-player` is simpler for MP3. |

### Current TTS Flow (Before This Change)

```
User speaks → STT → text
  → POST /api/v1/mobile/intent → AI reply text
  → react-native-tts.speak(replyText)  ← local on-device voice
```

The `/tts` endpoint exists but the mobile app currently uses the **local** `react-native-tts` engine, not the server-side OpenAI TTS. This wiring guide covers both approaches:

- **Option A:** Keep using local `react-native-tts` but let users pick a voice (local voices only — limited selection, varies by device)
- **Option B (recommended):** Switch TTS to use the server-side `/tts` endpoint with OpenAI voices (consistent across all devices, 6 distinct high-quality voices)

The web app already uses Option B. For consistency, the mobile app should too.

---

## 3. What Changed on the Backend

All backend changes are **already deployed**. No backend work is needed from the mobile developer.

### Database

```sql
-- New column added to the `assistants` table
ALTER TABLE assistants ADD COLUMN tts_voice VARCHAR(20) DEFAULT 'nova' AFTER voice_style;
```

### Routes Updated

| Route | File | Change |
|-------|------|--------|
| `GET /api/v1/mobile/my-assistant` | `myAssistant.ts` | All SELECT queries now include `tts_voice` |
| `POST /api/v1/mobile/my-assistant` | `myAssistant.ts` | INSERT now accepts and stores `tts_voice` (default `'nova'`) |
| `PUT /api/v1/mobile/my-assistant/:id` | `myAssistant.ts` | `tts_voice` is in the allowed update fields list |
| `GET /api/v1/mobile/staff-assistant` | `staffAssistant.ts` | Same — `tts_voice` in all SELECTs |
| `POST /api/v1/mobile/tts` | `mobileIntent.ts` | Now resolves voice: explicit `voice` param → user's saved `tts_voice` → default `'nova'` |
| `POST /api/v1/mobile/tts/preview` | `mobileIntent.ts` | **NEW** — generates a short voice sample for a given voice name |

---

## 4. Available Voices

OpenAI `tts-1` provides 6 voices. The `tts_voice` column stores one of these values:

| Value | Label | Description | Character |
|-------|-------|-------------|-----------|
| `nova` | Nova | Warm & friendly female voice | Default. Natural conversational tone. |
| `alloy` | Alloy | Neutral & balanced | Gender-neutral, clear, versatile. |
| `echo` | Echo | Smooth & clear male voice | Calm, professional male. |
| `fable` | Fable | Expressive British accent | Storytelling quality, British English. |
| `onyx` | Onyx | Deep & authoritative male voice | Low pitch, serious tone. |
| `shimmer` | Shimmer | Bright & upbeat female voice | Higher pitch, energetic. |

**Validation:** The backend validates that the value is one of these 6. Any other value falls back to `'nova'`.

---

## 5. API Endpoints

### 5.1 Get Assistant (includes `tts_voice`)

```
GET /api/v1/mobile/my-assistant
Authorization: Bearer <jwt>
```

**Response:**
```json
{
  "success": true,
  "assistants": [
    {
      "id": "staff-assistant-1710000000",
      "name": "My Assistant",
      "personality": "professional",
      "voice_style": "concise",
      "tts_voice": "nova",
      "preferred_model": "",
      ...
    }
  ]
}
```

### 5.2 Update Assistant (set `tts_voice`)

```
PUT /api/v1/mobile/my-assistant/:id
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "tts_voice": "echo"
}
```

**Response:**
```json
{
  "success": true,
  "assistant": {
    "id": "staff-assistant-1710000000",
    "tts_voice": "echo",
    ...
  }
}
```

### 5.3 TTS — Speak Text (uses saved voice as fallback)

```
POST /api/v1/mobile/tts
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "text": "Hello, this is a test message.",
  "voice": "echo"            ← optional; if omitted, uses the user's saved tts_voice
}
```

**Response:** Raw `audio/mpeg` binary stream (MP3).

**Behaviour:**
1. If `voice` is provided and valid → uses it
2. If `voice` is omitted or invalid → looks up the user's staff assistant `tts_voice` column
3. If no assistant found → defaults to `'nova'`

### 5.4 TTS Preview — Short Voice Sample (NEW)

```
POST /api/v1/mobile/tts/preview
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "voice": "echo"            ← required, one of: alloy, echo, fable, onyx, nova, shimmer
}
```

**Response:** Raw `audio/mpeg` binary stream (MP3).

**Details:**
- Generates a fixed sample sentence: *"Hi there! This is what I sound like. I can read your messages, summarise tasks, and keep you updated throughout the day."*
- Response has `Cache-Control: public, max-age=86400` so the device / network layer can cache previews for 24 hours
- ~2-3 seconds of audio, ~30-50KB

**Error responses:**
```json
{ "success": false, "error": "A valid voice name is required (alloy, echo, fable, onyx, nova, shimmer)." }
```

---

## 6. TypeScript Types

### Add to `src/types/index.ts` (or wherever assistant types live)

```typescript
// ── TTS Voice Types ──────────────────────────────────────────────────

/** OpenAI TTS voice identifiers */
export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

/** Voice option for the picker UI */
export interface TTSVoiceOption {
  value: TTSVoice;
  label: string;
  description: string;
  /** MaterialCommunityIcons icon name for visual differentiation */
  icon: string;
}

/** Static list of available voices — used by the voice picker */
export const TTS_VOICE_OPTIONS: TTSVoiceOption[] = [
  { value: 'nova',    label: 'Nova',    description: 'Warm & friendly',          icon: 'account-voice' },
  { value: 'alloy',   label: 'Alloy',   description: 'Neutral & balanced',       icon: 'equalizer' },
  { value: 'echo',    label: 'Echo',    description: 'Smooth & clear',           icon: 'waveform' },
  { value: 'fable',   label: 'Fable',   description: 'Expressive British',       icon: 'book-open-variant' },
  { value: 'onyx',    label: 'Onyx',    description: 'Deep & authoritative',     icon: 'microphone' },
  { value: 'shimmer', label: 'Shimmer', description: 'Bright & upbeat',          icon: 'star-four-points' },
];
```

### Update the existing Assistant interface

Add the `tts_voice` field to whatever interface represents an assistant in your types:

```typescript
export interface Assistant {
  id: string;
  name: string;
  // ... existing fields ...
  voice_style: string | null;
  tts_voice: string | null;       // ← ADD THIS
  preferred_model: string | null;
  // ... rest of fields ...
}
```

Also update `AssistantCreatePayload` / `AssistantUpdatePayload` (or equivalent):

```typescript
export interface AssistantCreatePayload {
  name: string;
  // ... existing fields ...
  voice_style?: string;
  tts_voice?: string;             // ← ADD THIS
  preferred_model?: string;
  // ...
}
```

---

## 7. API Module Changes — `api/ai.ts`

Add two new methods to the `aiApi` object:

```typescript
// ── In src/api/ai.ts ────────────────────────────────────────────────

/**
 * Speak text using OpenAI TTS. Returns an ArrayBuffer of MP3 audio.
 * If no voice is provided, the backend uses the user's saved tts_voice preference.
 */
async speakText(text: string, voice?: string): Promise<ArrayBuffer> {
  const token = await AsyncStorage.getItem('jwt_token');
  const response = await fetch(`${API_BASE_URL}/api/v1/mobile/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ text, ...(voice && { voice }) }),
  });

  if (!response.ok) {
    throw new Error(`TTS failed: ${response.status}`);
  }

  return response.arrayBuffer();
},

/**
 * Preview a TTS voice. Returns an ArrayBuffer of a short MP3 sample.
 */
async previewVoice(voice: string): Promise<ArrayBuffer> {
  const token = await AsyncStorage.getItem('jwt_token');
  const response = await fetch(`${API_BASE_URL}/api/v1/mobile/tts/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ voice }),
  });

  if (!response.ok) {
    throw new Error(`Voice preview failed: ${response.status}`);
  }

  return response.arrayBuffer();
},
```

> **Note:** These endpoints return raw binary audio, **not** JSON. You must use `response.arrayBuffer()` (not `api.post()`) because the API client auto-unwraps JSON envelopes which would corrupt binary data.

---

## 8. Hook Changes — `useVoiceAssistant.ts`

The `useVoiceAssistant` hook currently uses `react-native-tts` (local on-device TTS). To use OpenAI server-side TTS instead:

### Option B (Recommended): Server-Side OpenAI TTS

Replace the local TTS speak call with a fetch to `/tts` + audio playback:

```typescript
import RNFS from 'react-native-fs';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';

const audioPlayer = new AudioRecorderPlayer();

/**
 * Speak text using server-side OpenAI TTS.
 * Downloads MP3, writes to temp file, plays via native audio player.
 */
async function speakWithOpenAI(text: string, voice?: string): Promise<void> {
  const token = await AsyncStorage.getItem('jwt_token');

  const response = await fetch(`${API_BASE_URL}/api/v1/mobile/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ text, ...(voice && { voice }) }),
  });

  if (!response.ok) throw new Error(`TTS failed: ${response.status}`);

  // Write MP3 to a temp file
  const arrayBuffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);
  const tempPath = `${RNFS.CachesDirectoryPath}/tts_response_${Date.now()}.mp3`;
  await RNFS.writeFile(tempPath, base64, 'base64');

  // Play the audio file
  await audioPlayer.startPlayer(tempPath);

  // Return a promise that resolves when playback ends
  return new Promise<void>((resolve) => {
    audioPlayer.addPlayBackListener((e) => {
      if (e.currentPosition >= e.duration - 100) {
        audioPlayer.stopPlayer();
        audioPlayer.removePlayBackListener();
        // Clean up temp file
        RNFS.unlink(tempPath).catch(() => {});
        resolve();
      }
    });
  });
}

/** Convert ArrayBuffer to base64 string */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
```

### Wire into the Hook's State Machine

In the hook's `speak` phase, replace:

```typescript
// BEFORE (local TTS):
Tts.speak(responseText);

// AFTER (server-side OpenAI TTS):
const assistant = /* get from context or param */;
await speakWithOpenAI(responseText, assistant?.tts_voice || undefined);
```

The hook should accept the user's selected voice (from the assistant's `tts_voice` field) as a parameter or read it from the active assistant context.

### Considerations

| Concern | Solution |
|---------|----------|
| **Network required** | Server TTS needs connectivity. If offline, fall back to local `react-native-tts`. |
| **Latency** | Server TTS adds ~1-2s of network round-trip. Show a "generating speech" indicator during this time. |
| **Concurrent playback** | Call `audioPlayer.stopPlayer()` before starting a new one to prevent overlap. |
| **File cleanup** | Delete temp MP3 files after playback. The code above does this in the playback listener. |

### Fallback Strategy

```typescript
async function speak(text: string, voice?: string): Promise<void> {
  try {
    await speakWithOpenAI(text, voice);
  } catch (error) {
    console.warn('[Voice] Server TTS failed, falling back to local:', error);
    // Fall back to on-device TTS
    Tts.speak(text);
  }
}
```

---

## 9. Voice Picker Component — `VoicePicker.tsx`

Create a new reusable component for voice selection with preview.

**File:** `src/components/ai/VoicePicker.tsx`  
**Estimated LOC:** ~180

### Props

```typescript
interface VoicePickerProps {
  /** Currently selected voice value */
  selectedVoice: TTSVoice;
  /** Called when user taps a voice card to select it */
  onVoiceSelect: (voice: TTSVoice) => void;
  /** Optional: disable interaction (e.g., while saving) */
  disabled?: boolean;
}
```

### Behaviour

1. Renders a 2-column grid of voice option cards
2. Each card shows: icon, label, description, and a play/stop button
3. The selected voice has an accent border and checkmark
4. Tapping the play button calls `POST /tts/preview` and plays the returned audio
5. Only one preview can play at a time — tapping another stops the current one
6. Tapping the same voice's play button while it's playing stops it

### UI Sketch

```
┌─────────────────────┐  ┌─────────────────────┐
│ ✓ Nova          [▶] │  │   Alloy         [▶] │
│   Warm & friendly    │  │   Neutral & balanced │
│   ─── selected ───   │  │                      │
└─────────────────────┘  └─────────────────────┘
┌─────────────────────┐  ┌─────────────────────┐
│   Echo          [▶] │  │   Fable         [▶] │
│   Smooth & clear     │  │   Expressive British │
└─────────────────────┘  └─────────────────────┘
┌─────────────────────┐  ┌─────────────────────┐
│   Onyx          [▶] │  │   Shimmer       [▶] │
│   Deep & authoritative│ │   Bright & upbeat   │
└─────────────────────┘  └─────────────────────┘
```

### Reference Implementation

```typescript
import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Primary, Gray, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '../../theme';
import { API_BASE_URL } from '../../constants/config';
import type { TTSVoice, TTSVoiceOption } from '../../types';
import { TTS_VOICE_OPTIONS } from '../../types';

interface VoicePickerProps {
  selectedVoice: TTSVoice;
  onVoiceSelect: (voice: TTSVoice) => void;
  disabled?: boolean;
}

const audioPlayer = new AudioRecorderPlayer();

export function VoicePicker({ selectedVoice, onVoiceSelect, disabled }: VoicePickerProps) {
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const currentTempFile = useRef<string | null>(null);

  const stopPreview = useCallback(async () => {
    try {
      await audioPlayer.stopPlayer();
      audioPlayer.removePlayBackListener();
    } catch {}
    if (currentTempFile.current) {
      RNFS.unlink(currentTempFile.current).catch(() => {});
      currentTempFile.current = null;
    }
    setPreviewingVoice(null);
    setLoadingVoice(null);
  }, []);

  const playPreview = useCallback(async (voice: string) => {
    // If same voice is playing, stop it
    if (previewingVoice === voice) {
      await stopPreview();
      return;
    }

    // Stop any current preview
    await stopPreview();
    setLoadingVoice(voice);

    try {
      const token = await AsyncStorage.getItem('jwt_token');
      const response = await fetch(`${API_BASE_URL}/api/v1/mobile/tts/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ voice }),
      });

      if (!response.ok) throw new Error(`Preview failed: ${response.status}`);

      // Write to temp file
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      const tempPath = `${RNFS.CachesDirectoryPath}/voice_preview_${voice}.mp3`;
      await RNFS.writeFile(tempPath, base64, 'base64');
      currentTempFile.current = tempPath;

      setPreviewingVoice(voice);
      setLoadingVoice(null);

      await audioPlayer.startPlayer(tempPath);
      audioPlayer.addPlayBackListener((e) => {
        if (e.currentPosition >= e.duration - 100) {
          stopPreview();
        }
      });
    } catch (error) {
      console.warn('[VoicePicker] Preview error:', error);
      setLoadingVoice(null);
      setPreviewingVoice(null);
    }
  }, [previewingVoice, stopPreview]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>TTS Voice</Text>
      <Text style={styles.hint}>
        Choose the voice for text-to-speech. Tap the play button to preview.
      </Text>
      <View style={styles.grid}>
        {TTS_VOICE_OPTIONS.map((opt) => {
          const isSelected = selectedVoice === opt.value;
          const isPlaying = previewingVoice === opt.value;
          const isLoading = loadingVoice === opt.value;

          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.card,
                isSelected && styles.cardSelected,
                disabled && styles.cardDisabled,
              ]}
              onPress={() => !disabled && onVoiceSelect(opt.value)}
              activeOpacity={0.7}
            >
              <View style={styles.cardContent}>
                <View style={styles.cardLeft}>
                  <MaterialCommunityIcons
                    name={opt.icon}
                    size={20}
                    color={isSelected ? Primary[500] : Gray[500]}
                  />
                  <View style={styles.cardText}>
                    <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.cardDesc}>{opt.description}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.playButton, isPlaying && styles.playButtonActive]}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    playPreview(opt.value);
                  }}
                  disabled={disabled}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={Primary[500]} />
                  ) : (
                    <MaterialCommunityIcons
                      name={isPlaying ? 'stop' : 'play'}
                      size={18}
                      color={isPlaying ? '#fff' : Gray[600]}
                    />
                  )}
                </TouchableOpacity>
              </View>

              {isSelected && (
                <View style={styles.checkmark}>
                  <MaterialCommunityIcons name="check-circle" size={16} color={Primary[500]} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.lg },
  label: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Gray[800],
    marginBottom: 4,
  },
  hint: {
    fontSize: FontSize.xs,
    color: Gray[500],
    marginBottom: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  card: {
    width: '48%',
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Gray[200],
    backgroundColor: '#fff',
  },
  cardSelected: {
    borderColor: Primary[500],
    backgroundColor: Primary[50] || '#EBF8FF',
  },
  cardDisabled: { opacity: 0.5 },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardText: { marginLeft: Spacing.sm, flex: 1 },
  cardLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Gray[900],
  },
  cardLabelSelected: { color: Primary[600] || Primary[500] },
  cardDesc: {
    fontSize: FontSize.xs,
    color: Gray[500],
    marginTop: 2,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.xs,
  },
  playButtonActive: {
    backgroundColor: Primary[500],
  },
  checkmark: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
});
```

---

## 10. Screen Changes — `AssistantFormScreen.tsx`

The `AssistantFormScreen` is where users configure personality, voice style, and preferred model. **Add the voice picker here**, below the existing "Voice Style" chips.

### Changes

1. **Import** the `VoicePicker` component and the `TTSVoice` type
2. **Add `tts_voice` to form state** (initialized from the assistant data or default `'nova'`)
3. **Render `<VoicePicker>`** after the Voice Style section
4. **Include `tts_voice`** in the create/update API payload

### Code Diff (Conceptual)

```typescript
// ── In AssistantFormScreen.tsx ────────────────────────────────────────

// 1. Imports
import { VoicePicker } from '../../components/ai/VoicePicker';
import type { TTSVoice } from '../../types';

// 2. Form state — add tts_voice
const [ttsVoice, setTtsVoice] = useState<TTSVoice>(
  (route.params?.assistant?.tts_voice as TTSVoice) || 'nova'
);

// 3. In the form JSX, after the Voice Style chip row:
<VoicePicker
  selectedVoice={ttsVoice}
  onVoiceSelect={setTtsVoice}
  disabled={saving}
/>

// 4. In the save handler, include tts_voice in the payload:
const payload = {
  name,
  personality,
  voice_style: voiceStyle,
  tts_voice: ttsVoice,          // ← ADD THIS
  personality_flare: flare,
  preferred_model: model,
  // ...
};

if (isEditing) {
  await aiApi.updateAssistant(assistantId, payload);
} else {
  await aiApi.createAssistant(payload);
}
```

---

## 11. Screen Changes — `AiChatScreen.tsx`

The `AiChatScreen` uses `useVoiceAssistant` for the push-to-talk flow. When TTS fires, it should use the selected voice.

### Changes

1. **Read `tts_voice`** from the active assistant (already available from the assistant picker or context)
2. **Pass the voice** to the TTS function (either the hook's speak method or the new server-side approach)

```typescript
// In AiChatScreen, where the voice assistant hook is initialized or where TTS is triggered:

const activeAssistant = /* from state or context */;

// When calling the speak function:
await speak(responseText, activeAssistant?.tts_voice || 'nova');
```

If you switch to server-side TTS (recommended), the backend will automatically use the user's saved voice even if you don't pass it — but it's better to pass it explicitly for immediate consistency before the assistant is saved.

---

## 12. Caching & Persistence

### Voice Previews

The `/tts/preview` response has `Cache-Control: public, max-age=86400`. Since there are only 6 voices with a fixed preview sentence, you can optionally cache the downloaded MP3 files locally:

```typescript
const PREVIEW_CACHE_DIR = `${RNFS.CachesDirectoryPath}/voice_previews`;

async function getCachedOrFetchPreview(voice: string): Promise<string> {
  const cachedPath = `${PREVIEW_CACHE_DIR}/${voice}.mp3`;

  // Check if cached file exists and is less than 24 hours old
  const exists = await RNFS.exists(cachedPath);
  if (exists) {
    const stat = await RNFS.stat(cachedPath);
    const age = Date.now() - new Date(stat.mtime).getTime();
    if (age < 24 * 60 * 60 * 1000) {
      return cachedPath; // Use cached version
    }
  }

  // Fetch from server
  const token = await AsyncStorage.getItem('jwt_token');
  const response = await fetch(`${API_BASE_URL}/api/v1/mobile/tts/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ voice }),
  });

  if (!response.ok) throw new Error(`Preview failed: ${response.status}`);

  // Ensure cache directory exists
  await RNFS.mkdir(PREVIEW_CACHE_DIR);

  // Write to cache
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  await RNFS.writeFile(cachedPath, btoa(binary), 'base64');

  return cachedPath;
}
```

This avoids hitting the OpenAI API repeatedly when the user is browsing voices. Only 6 files × ~50KB each = ~300KB total cache.

### Voice Preference

The voice preference is persisted server-side via the assistant update API. No additional AsyncStorage caching is needed for the preference itself — it comes back with every `GET /my-assistant` response.

---

## 13. Implementation Checklist

### Files to Create

| # | File | Purpose | Est. LOC |
|---|------|---------|----------|
| 1 | `src/components/ai/VoicePicker.tsx` | Voice selection grid with preview playback | ~180 |

### Files to Modify

| # | File | Change | Est. LOC Δ |
|---|------|--------|------------|
| 2 | `src/types/index.ts` | Add `TTSVoice`, `TTSVoiceOption`, `TTS_VOICE_OPTIONS`, add `tts_voice` to `Assistant` interface | +25 |
| 3 | `src/api/ai.ts` | Add `speakText()` and `previewVoice()` methods | +35 |
| 4 | `src/screens/ai/AssistantFormScreen.tsx` | Import `VoicePicker`, add `tts_voice` state, render picker, include in save payload | +15 |
| 5 | `src/screens/ai/AiChatScreen.tsx` | Pass `tts_voice` from active assistant to TTS function | +5 |
| 6 | `src/hooks/useVoiceAssistant.ts` | (Optional) Replace local `react-native-tts` with server-side `/tts` + fallback | +40 |

### Step-by-Step Order

- [ ] **Step 1:** Add types (`TTSVoice`, `TTS_VOICE_OPTIONS`, update `Assistant` interface)
- [ ] **Step 2:** Add `speakText()` and `previewVoice()` to `src/api/ai.ts`
- [ ] **Step 3:** Create `VoicePicker.tsx` component
- [ ] **Step 4:** Wire `VoicePicker` into `AssistantFormScreen.tsx` (form state + save)
- [ ] **Step 5:** Pass `tts_voice` to TTS in `AiChatScreen.tsx`
- [ ] **Step 6:** (Optional) Switch `useVoiceAssistant` from local TTS to server-side TTS with fallback
- [ ] **Step 7:** Test: create assistant with voice → preview all 6 voices → select one → save → verify TTS uses selected voice
- [ ] **Step 8:** Test: offline fallback → verify local TTS kicks in when server is unreachable

### Testing

| Test Case | Expected Behaviour |
|-----------|-------------------|
| Open AssistantForm, see voice picker | 6 voice cards rendered, default `nova` selected |
| Tap play on "Echo" | ~2s loading spinner, then audio plays the preview sentence in Echo's voice |
| Tap play on "Fable" while Echo is playing | Echo stops, Fable starts |
| Tap play on "Fable" while Fable is playing | Fable stops (toggle off) |
| Select "Onyx", save assistant | API call includes `tts_voice: 'onyx'` |
| Open AI chat, send a message, auto-speak | Response is spoken in Onyx voice |
| Turn off WiFi, send a message, auto-speak | Falls back to local `react-native-tts` |
| Reload app, open AssistantForm | Previously saved voice (Onyx) is pre-selected |

---

*End of wiring guide.*
