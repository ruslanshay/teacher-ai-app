/**
 * Very simple redaction helpers.
 * For production, consider a proper PII detection service.
 */
export function redactPII(text: string): string {
  if (!text) return text;
  let t = text;
  // Emails
  t = t.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[EMAIL]');
  // Phone numbers (very rough patterns)
  t = t.replace(/\+?\d[\d\s().-]{7,}\d/g, '[PHONE]');
  // ID-like sequences (8+ digits)
  t = t.replace(/\b\d{8,}\b/g, '[ID]');
  return t;
}
