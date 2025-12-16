/**
 * URL validation utilities for product URLs
 */

export const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
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
