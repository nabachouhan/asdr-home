// src/utils/sanitize.js
// Centralized security helpers for input validation and sanitization

/**
 * Escape HTML special characters to prevent XSS in email templates
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validate SQL identifier names (table names, column names).
 * Only allows lowercase letters, digits, and underscores.
 */
function isValidIdentifier(name) {
  if (typeof name !== 'string') return false;
  return /^[a-z][a-z0-9_]{0,62}$/i.test(name);
}

/**
 * Validate SRID values (must be numeric only, e.g., "4326")
 */
function isValidSrid(srid) {
  if (typeof srid !== 'string' && typeof srid !== 'number') return false;
  return /^\d{1,6}$/.test(String(srid));
}

/**
 * Validate that a field name exists in the given columns list.
 * Used to prevent SQL injection via dynamic column references.
 */
function isFieldInColumns(field, validColumns) {
  if (typeof field !== 'string' || !Array.isArray(validColumns)) return false;
  return validColumns.includes(field.toLowerCase());
}

/**
 * Sanitize a filename to prevent path traversal attacks.
 * Strips directory separators and dangerous characters.
 */
function sanitizeFilename(filename) {
  if (typeof filename !== 'string') return '';
  // Remove path separators and null bytes
  return filename
    .replace(/[/\\]/g, '')
    .replace(/\0/g, '')
    .replace(/\.\./g, '');
}

export {
  escapeHtml,
  isValidIdentifier,
  isValidSrid,
  isFieldInColumns,
  sanitizeFilename
};
