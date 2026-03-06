/**
 * Lightweight HTML sanitizer for deal descriptions.
 * Strips all tags except safe formatting tags.
 * Prevents XSS from merchant-submitted or AI-generated content.
 */
const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 'br', 'p', 'div', 'span',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
]);

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  // Remove script/style tags and their content entirely
  let clean = html.replace(/<(script|style|iframe|object|embed|form|input|textarea|button|select)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Remove self-closing dangerous tags
  clean = clean.replace(/<(script|style|iframe|object|embed|form|input|textarea|button|select)\b[^>]*\/?>/gi, '');
  // Remove event handlers (onclick, onerror, etc.)
  clean = clean.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  // Remove javascript: URLs
  clean = clean.replace(/href\s*=\s*["']?\s*javascript:/gi, 'href="');
  // Strip disallowed tags but keep their text content
  clean = clean.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
    if (ALLOWED_TAGS.has(tag.toLowerCase())) return match;
    return '';
  });
  return clean;
}
