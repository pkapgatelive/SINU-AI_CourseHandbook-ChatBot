// Session utility for generating and managing session IDs
// Uses localStorage to persist session ID across page reloads

/**
 * Generates a UUID using the crypto API when available, falls back to Math.random()
 * @returns A UUID string
 */
function generateUUID(): string {
  // Generate a 32-character session ID (no hyphens) as required
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  
  // Fallback to Math.random() implementation for environments without crypto
  // Generate 32 hex characters
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += Math.floor(Math.random() * 16).toString(16);
  }
  return result;
}

/**
 * Gets the current session ID, creating one if it doesn't exist
 * @returns The current session ID
 */
export function getSessionId(): string {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    throw new Error('getSessionId can only be called in a browser environment');
  }

  // Try to get existing session ID from localStorage
  let sessionId = localStorage.getItem('chatSessionId');
  
  // If no session ID exists, create a new one
  if (!sessionId) {
    sessionId = generateUUID();
    localStorage.setItem('chatSessionId', sessionId);
  }
  
  return sessionId;
}

/**
 * Resets the current session by generating a new session ID
 * @returns The new session ID
 */
export function resetSession(): string {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    throw new Error('resetSession can only be called in a browser environment');
  }

  // Generate a new session ID
  const newSessionId = generateUUID();
  
  // Store the new session ID in localStorage
  localStorage.setItem('chatSessionId', newSessionId);
  
  return newSessionId;
}