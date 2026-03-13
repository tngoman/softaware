/**
 * Media Processor Service
 *
 * Handles:
 *   - Image resize/compression (via sharp)
 *   - Thumbnail generation for images
 *   - Video thumbnail extraction (via ffmpeg CLI)
 *   - Audio duration extraction (via ffprobe CLI)
 *
 * Falls back gracefully if sharp/ffmpeg are not installed.
 */
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);
// ── Try to load sharp (optional dependency) ────────────
let sharp = null;
try {
    // @ts-ignore — sharp is optional; if not installed the catch handles it
    sharp = (await import('sharp')).default;
    console.log('[MediaProcessor] sharp loaded ✅');
}
catch {
    console.log('[MediaProcessor] sharp not installed — image compression disabled');
}
// ── Check for ffmpeg/ffprobe availability ───────────────
let ffmpegAvailable = false;
let ffprobeAvailable = false;
async function checkBinary(name) {
    try {
        await execFileAsync('which', [name]);
        return true;
    }
    catch {
        return false;
    }
}
(async () => {
    ffmpegAvailable = await checkBinary('ffmpeg');
    ffprobeAvailable = await checkBinary('ffprobe');
    if (ffmpegAvailable)
        console.log('[MediaProcessor] ffmpeg available ✅');
    else
        console.log('[MediaProcessor] ffmpeg not found — video processing disabled');
    if (ffprobeAvailable)
        console.log('[MediaProcessor] ffprobe available ✅');
    else
        console.log('[MediaProcessor] ffprobe not found — audio duration disabled');
})();
/**
 * Compress an image and generate a thumbnail.
 *
 * - Original: resized to max 1920px on longest side, 80% JPEG quality
 * - Thumbnail: 200px wide, 70% quality
 *
 * If sharp is not installed, returns null and the original is kept as-is.
 */
export async function processImage(inputPath, outputDir, fileBaseName) {
    if (!sharp)
        return null;
    try {
        const metadata = await sharp(inputPath).metadata();
        const { width = 0, height = 0 } = metadata;
        // ── Compress original ──
        const compressedName = `${fileBaseName}_compressed.jpg`;
        const compressedPath = path.join(outputDir, compressedName);
        let pipeline = sharp(inputPath).rotate(); // auto-rotate based on EXIF
        // Only resize if larger than 1920px
        if (width > 1920 || height > 1920) {
            pipeline = pipeline.resize(1920, 1920, { fit: 'inside', withoutEnlargement: true });
        }
        await pipeline
            .jpeg({ quality: 80, mozjpeg: true })
            .toFile(compressedPath);
        // Replace original with compressed version
        const compressedStats = fs.statSync(compressedPath);
        // ── Generate thumbnail ──
        const thumbName = `${fileBaseName}_thumb.jpg`;
        const thumbPath = path.join(outputDir, thumbName);
        await sharp(inputPath)
            .rotate()
            .resize(200, 200, { fit: 'cover' })
            .jpeg({ quality: 70 })
            .toFile(thumbPath);
        // Get final dimensions
        const compressedMeta = await sharp(compressedPath).metadata();
        return {
            filePath: compressedPath,
            thumbnailPath: thumbPath,
            thumbnailUrl: thumbName, // caller will prepend directory
            fileSize: compressedStats.size,
            width: compressedMeta.width || width,
            height: compressedMeta.height || height,
        };
    }
    catch (err) {
        console.error('[MediaProcessor] Image processing failed:', err);
        return null;
    }
}
/**
 * Extract a thumbnail from a video at the 1-second mark.
 * Also extracts duration via ffprobe.
 *
 * Returns null if ffmpeg is not available.
 */
export async function processVideo(inputPath, outputDir, fileBaseName) {
    if (!ffmpegAvailable)
        return null;
    try {
        const thumbName = `${fileBaseName}_thumb.jpg`;
        const thumbPath = path.join(outputDir, thumbName);
        // Extract thumbnail at 1s
        await execFileAsync('ffmpeg', [
            '-i', inputPath,
            '-ss', '00:00:01',
            '-vframes', '1',
            '-vf', 'scale=320:-1',
            '-q:v', '5',
            '-y',
            thumbPath,
        ], { timeout: 15000 });
        // Get duration
        let duration = null;
        if (ffprobeAvailable) {
            try {
                const { stdout } = await execFileAsync('ffprobe', [
                    '-v', 'quiet',
                    '-print_format', 'json',
                    '-show_format',
                    inputPath,
                ], { timeout: 10000 });
                const info = JSON.parse(stdout);
                duration = info.format?.duration ? parseFloat(info.format.duration) : null;
            }
            catch { /* non-critical */ }
        }
        return {
            thumbnailPath: thumbPath,
            thumbnailName: thumbName,
            duration,
        };
    }
    catch (err) {
        console.error('[MediaProcessor] Video processing failed:', err);
        return null;
    }
}
/**
 * Extract duration from an audio file via ffprobe.
 * Returns null if ffprobe is not available.
 */
export async function processAudio(inputPath) {
    if (!ffprobeAvailable)
        return null;
    try {
        const { stdout } = await execFileAsync('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            inputPath,
        ], { timeout: 10000 });
        const info = JSON.parse(stdout);
        const duration = info.format?.duration ? parseFloat(info.format.duration) : null;
        return { duration };
    }
    catch (err) {
        console.error('[MediaProcessor] Audio processing failed:', err);
        return null;
    }
}
/**
 * Check whether image compression is available (sharp is installed).
 */
export function isImageCompressionAvailable() {
    return !!sharp;
}
/**
 * Check whether video processing is available (ffmpeg is installed).
 */
export function isVideoProcessingAvailable() {
    return ffmpegAvailable;
}
