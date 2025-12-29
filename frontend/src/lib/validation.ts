/**
 * URL validation utilities for product URLs
 */

export const isValidUrl = (url: string): boolean => {
  // Quick rejection for obvious non-URLs
  const trimmed = url.trim();

  // Reject if it contains common conversational patterns
  const conversationalPatterns = [
    /^(i'?ve|i'?m|let'?s|please|thanks|yes|no|ok|continue|next|back|select)/i,
    /\b(selected|continue|let's|variant|option)\b/i,
    /(^|\s)(the|a|an|this|that|these|those)\s/i
  ];

  if (conversationalPatterns.some(pattern => pattern.test(trimmed))) {
    return false;
  }

  // Reject if it has too many spaces (URLs typically don't have many spaces)
  const spaceCount = (trimmed.match(/\s/g) || []).length;
  if (spaceCount > 2) {
    return false;
  }

  // Must start with http:// or https:// OR look like a domain
  const startsWithProtocol = /^https?:\/\//i.test(trimmed);
  const looksLikeDomain = /^[a-z0-9][a-z0-9-]*\.[a-z]{2,}/i.test(trimmed);

  if (!startsWithProtocol && !looksLikeDomain) {
    return false;
  }

  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    // Protocol must be http or https
    const validProtocol = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    // Hostname must contain at least one dot (e.g. example.com) to avoid single words
    const validHost = parsed.hostname.includes('.') || parsed.hostname === 'localhost';
    // Hostname must be at least 3 chars
    const validLength = parsed.hostname.length >= 3;
    // Hostname should not contain spaces or quotes
    const noSpaces = !parsed.hostname.includes(' ') && !parsed.hostname.includes("'") && !parsed.hostname.includes('"');

    return validProtocol && validHost && validLength && noSpaces;
  } catch {
    return false;
  }
};

export const isProductUrl = (url: string): boolean => {
  if (!isValidUrl(url)) return false;

  // Basic check for product-like URLs (contains common e-commerce patterns)
  const lowerUrl = url.toLowerCase();
  const productPatterns = [
    '/product',
    '/item',
    '/p/',
    '/dp/',
    '/products/',
    '/shop/',
    '/buy/',
    '.html',
    'id=',
    'sku='
  ];

  // Either has product patterns or has a path (not just domain)
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return productPatterns.some(pattern => lowerUrl.includes(pattern)) ||
      parsed.pathname.length > 1;
  } catch {
    return false;
  }
};

/**
 * Sanitize user input to prevent XSS
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim()
    .slice(0, 2000); // Limit length
};

/**
 * Validate campaign configuration
 */
export const validateCampaignConfig = (config: Record<string, string>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!config.objective) {
    errors.push('Campaign objective is required');
  }

  if (!config.budget) {
    errors.push('Budget is required');
  } else {
    const budget = parseFloat(config.budget);
    if (isNaN(budget) || budget < 1) {
      errors.push('Budget must be at least $1');
    }
    if (budget > 100000) {
      errors.push('Budget cannot exceed $100,000');
    }
  }

  if (!config.duration) {
    errors.push('Duration is required');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Format error messages for display
 */
export const formatErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
};
