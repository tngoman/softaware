/**
 * Strip Markdown for Speech — Converts markdown-formatted LLM output
 * into clean plain text suitable for Text-to-Speech engines.
 *
 * Removes: bold/italic markers, headers, code blocks, links, images,
 * blockquotes, horizontal rules, HTML tags, table formatting, and
 * excessive whitespace — while preserving readable sentence flow.
 */

export function stripMarkdownForSpeech(md: string): string {
  if (!md) return '';

  let text = md;

  // ── Code blocks (fenced) — remove entirely or keep inner text ──
  text = text.replace(/```[\s\S]*?```/g, ' (code example omitted) ');

  // ── Inline code — keep the content, strip backticks ──
  text = text.replace(/`([^`]+)`/g, '$1');

  // ── Images — replace with alt text ──
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');

  // ── Links — keep the label, drop the URL ──
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

  // ── Bold + italic combined (***text*** or ___text___) ──
  text = text.replace(/(\*{3}|_{3})(.+?)\1/g, '$2');

  // ── Bold (**text** or __text__) ──
  text = text.replace(/(\*{2}|_{2})(.+?)\1/g, '$2');

  // ── Italic (*text* or _text_) — careful not to break contractions ──
  text = text.replace(/(\*|_)(?=\S)(.+?)(?<=\S)\1/g, '$2');

  // ── Strikethrough (~~text~~) ──
  text = text.replace(/~~(.+?)~~/g, '$1');

  // ── Headers (# to ######) ──
  text = text.replace(/^#{1,6}\s+/gm, '');

  // ── Blockquotes ──
  text = text.replace(/^>\s?/gm, '');

  // ── Horizontal rules (---, ***, ___) ──
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');

  // ── Unordered list bullets (-, *, +) ──
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');

  // ── Ordered list numbers (1., 2., etc.) ──
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');

  // ── Table formatting (pipes and dashes) ──
  // Remove separator rows  |---|---|
  text = text.replace(/^\|[-:\s|]+\|\s*$/gm, '');
  // Remove leading/trailing pipes from data rows
  text = text.replace(/^\|(.+)\|\s*$/gm, (_, content: string) => {
    return content.replace(/\|/g, ', ').trim();
  });

  // ── HTML tags ──
  text = text.replace(/<[^>]+>/g, '');

  // ── Escape characters ──
  text = text.replace(/\\([\\`*_{}[\]()#+\-.!|~>])/g, '$1');

  // ── Stray asterisks — catch any remaining * not consumed by bold/italic/bullet rules ──
  text = text.replace(/\*/g, '');

  // ── Stray underscores used as emphasis that slipped through ──
  text = text.replace(/(?<![a-zA-Z0-9])_|_(?![a-zA-Z0-9])/g, '');

  // ── Emoji shortcodes like :smile: — keep them ──
  // (TTS handles emoji reasonably well, leave as-is)

  // ── Clean up whitespace ──
  text = text.replace(/\n{3,}/g, '\n\n');       // Collapse triple+ newlines
  text = text.replace(/[ \t]{2,}/g, ' ');         // Collapse multiple spaces
  text = text.replace(/\n/g, '. ');                // Newlines → sentence breaks for natural pauses
  text = text.replace(/\.\s*\.\s*/g, '. ');        // Collapse double periods
  text = text.replace(/,\s*\.\s*/g, '. ');         // Fix comma-period combos
  text = text.trim();

  return text;
}
