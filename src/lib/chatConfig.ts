// Chat configuration and API utilities
export interface ChatConfig {
  apiEndpoint: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  healthCheckEndpoint: string;
}

// Default configuration
const DEFAULT_CONFIG: ChatConfig = {
  apiEndpoint: '/api/chat',
  timeout: 30000, // 30 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second base delay
  healthCheckEndpoint: '/api/chat', // Use GET for health check
};

// Get configuration from environment or use defaults
export function getChatConfig(): ChatConfig {
  if (typeof window === 'undefined') {
    // Server-side: use environment variables
    return {
      ...DEFAULT_CONFIG,
      apiEndpoint: process.env.NEXT_PUBLIC_CHAT_API_ENDPOINT || DEFAULT_CONFIG.apiEndpoint,
      timeout: parseInt(process.env.NEXT_PUBLIC_CHAT_TIMEOUT || String(DEFAULT_CONFIG.timeout)),
      maxRetries: parseInt(process.env.NEXT_PUBLIC_CHAT_MAX_RETRIES || String(DEFAULT_CONFIG.maxRetries)),
      retryDelay: parseInt(process.env.NEXT_PUBLIC_CHAT_RETRY_DELAY || String(DEFAULT_CONFIG.retryDelay)),
    };
  }

  // Client-side: use window globals or defaults
  return {
    ...DEFAULT_CONFIG,
    apiEndpoint: (window as any).__CHAT_CONFIG__?.apiEndpoint || DEFAULT_CONFIG.apiEndpoint,
    timeout: (window as any).__CHAT_CONFIG__?.timeout || DEFAULT_CONFIG.timeout,
    maxRetries: (window as any).__CHAT_CONFIG__?.maxRetries || DEFAULT_CONFIG.maxRetries,
    retryDelay: (window as any).__CHAT_CONFIG__?.retryDelay || DEFAULT_CONFIG.retryDelay,
  };
}

// Error types for better error handling
export enum ChatErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  UNKNOWN = 'UNKNOWN'
}

export interface ChatError {
  type: ChatErrorType;
  message: string;
  code?: string;
  retryable: boolean;
  statusCode?: number;
}

// Utility to categorize errors
export function categorizeError(error: any, response?: Response): ChatError {
  // Network/connection errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return {
      type: ChatErrorType.NETWORK_ERROR,
      message: 'Unable to connect to the chat service. Please check your internet connection.',
      retryable: true
    };
  }

  // Timeout errors
  if (error.name === 'AbortError' || error.message.includes('timeout')) {
    return {
      type: ChatErrorType.TIMEOUT,
      message: 'Request timed out. The service may be experiencing high load.',
      retryable: true
    };
  }

  // HTTP status-based errors
  if (response) {
    const statusCode = response.status;
    
    if (statusCode === 429) {
      return {
        type: ChatErrorType.RATE_LIMIT,
        message: 'Too many requests. Please wait a moment before trying again.',
        retryable: true,
        statusCode
      };
    }

    if (statusCode >= 500) {
      return {
        type: ChatErrorType.SERVICE_UNAVAILABLE,
        message: 'The chat service is temporarily unavailable. Please try again in a few moments.',
        retryable: true,
        statusCode
      };
    }

    if (statusCode >= 400) {
      return {
        type: ChatErrorType.INVALID_RESPONSE,
        message: 'There was an issue with your request. Please try rephrasing your message.',
        retryable: false,
        statusCode
      };
    }
  }

  // Parse error message for specific codes
  const errorMessage = error.message || String(error);
  if (errorMessage.includes('RATE_LIMIT')) {
    return {
      type: ChatErrorType.RATE_LIMIT,
      message: 'Rate limit exceeded. Please wait before sending another message.',
      retryable: true
    };
  }

  // Default unknown error
  return {
    type: ChatErrorType.UNKNOWN,
    message: 'An unexpected error occurred. Please try again.',
    retryable: true
  };
}

// Sleep utility for retry delays
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Exponential backoff calculation
export function calculateBackoffDelay(attempt: number, baseDelay: number): number {
  return Math.min(baseDelay * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
}

// Logging utility
export interface ChatLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  category: string;
  message: string;
  data?: any;
}

class ChatLogger {
  private logs: ChatLogEntry[] = [];
  private maxLogs = 100;

  log(level: 'info' | 'warn' | 'error', category: string, message: string, data?: any) {
    // Safely serialize data for logging
    let serializedData = data;
    if (data && typeof data === 'object') {
      try {
        // Handle Error objects specially
        if (data instanceof Error) {
          serializedData = {
            name: data.name,
            message: data.message,
            stack: data.stack,
            cause: data.cause
          };
        } else {
          // For other objects, create a safe copy
          serializedData = JSON.parse(JSON.stringify(data));
        }
      } catch (e) {
        // If serialization fails, convert to string
        serializedData = String(data);
      }
    }

    const entry: ChatLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data: serializedData
    };

    this.logs.push(entry);
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console logging for development
    if (process.env.NODE_ENV === 'development') {
      const logMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      logMethod(`[Chat:${category}] ${message}`, serializedData || '');
    }
  }

  getLogs(): ChatLogEntry[] {
    return [...this.logs];
  }

  getErrorCode(): string {
    const recentErrors = this.logs
      .filter(log => log.level === 'error')
      .slice(-3);
    
    if (recentErrors.length === 0) return 'OK';
    
    const errorTypes = recentErrors.map(log => log.category);
    return `ERR-${errorTypes.join('-')}-${Date.now().toString(36).slice(-4)}`;
  }
}

export const chatLogger = new ChatLogger();