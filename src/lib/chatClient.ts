import { getChatConfig, categorizeError, ChatError, ChatErrorType, sleep, calculateBackoffDelay, chatLogger } from './chatConfig';

export interface ChatMessage {
  sessionId: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ChatResponse {
  reply?: string;
  error?: string;
  code?: string;
}

export interface HealthCheckResult {
  healthy: boolean;
  error?: string;
  latency?: number;
}

class ChatClient {
  private config = getChatConfig();
  private abortController: AbortController | null = null;
  private healthCheckCache: { result: HealthCheckResult; timestamp: number } | null = null;
  private readonly HEALTH_CHECK_CACHE_TTL = 30000; // 30 seconds

  // Health check with caching
  async checkHealth(): Promise<HealthCheckResult> {
    const now = Date.now();
    
    // Return cached result if still valid
    if (this.healthCheckCache && (now - this.healthCheckCache.timestamp) < this.HEALTH_CHECK_CACHE_TTL) {
      return this.healthCheckCache.result;
    }

    const startTime = Date.now();
    
    try {
      chatLogger.log('info', 'HEALTH_CHECK', 'Starting health check');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health check
      
      const response = await fetch(this.config.healthCheckEndpoint, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      if (response.ok) {
        const result: HealthCheckResult = { healthy: true, latency };
        this.healthCheckCache = { result, timestamp: now };
        
        chatLogger.log('info', 'HEALTH_CHECK', `Health check passed (${latency}ms)`);
        return result;
      } else {
        const result: HealthCheckResult = { 
          healthy: false, 
          error: `HTTP ${response.status}: ${response.statusText}`,
          latency 
        };
        this.healthCheckCache = { result, timestamp: now };
        
        chatLogger.log('warn', 'HEALTH_CHECK', `Health check failed: ${result.error}`);
        return result;
      }
    } catch (error: any) {
      const latency = Date.now() - startTime;
      const result: HealthCheckResult = { 
        healthy: false, 
        error: error.message || 'Health check failed',
        latency 
      };
      this.healthCheckCache = { result, timestamp: now };
      
      chatLogger.log('error', 'HEALTH_CHECK', 'Health check error', error);
      return result;
    }
  }

  // Send message with retry logic and proper error handling
  async sendMessage(messageData: ChatMessage): Promise<ChatResponse> {
    // Cancel any previous request
    if (this.abortController) {
      this.abortController.abort();
    }

    this.abortController = new AbortController();
    const { signal } = this.abortController;

    chatLogger.log('info', 'SEND_MESSAGE', 'Sending message', { 
      sessionId: messageData.sessionId,
      messageLength: messageData.message.length 
    });

    let lastError: ChatError | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Add exponential backoff delay for retries
        if (attempt > 1) {
          const delay = calculateBackoffDelay(attempt - 1, this.config.retryDelay);
          chatLogger.log('info', 'RETRY', `Retrying in ${delay}ms (attempt ${attempt}/${this.config.maxRetries})`);
          await sleep(delay);
        }

        const timeoutId = setTimeout(() => {
          if (!signal.aborted) {
            this.abortController?.abort();
          }
        }, this.config.timeout);

        const response = await fetch(this.config.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messageData),
          signal,
        });

        clearTimeout(timeoutId);

        chatLogger.log('info', 'RESPONSE', `Received response: ${response.status}`, {
          status: response.status,
          statusText: response.statusText,
          attempt
        });

        if (!response.ok) {
          const error = categorizeError(new Error(`HTTP ${response.status}`), response);
          lastError = error;

          // Don't retry non-retryable errors
          if (!error.retryable) {
            chatLogger.log('error', 'NON_RETRYABLE', `Non-retryable error: ${error.message}`, error);
            throw new Error(error.message);
          }

          // For retryable errors, continue to next attempt
          chatLogger.log('warn', 'RETRYABLE_ERROR', `Retryable error on attempt ${attempt}: ${error.message}`, error);
          continue;
        }

        // Parse response
        const contentType = response.headers.get('Content-Type');
        let data: any;

        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          data = { reply: text };
        }

        chatLogger.log('info', 'SUCCESS', 'Message sent successfully', { attempt });
        return data;

      } catch (error: any) {
        const chatError = categorizeError(error);
        lastError = chatError;

        // Create detailed error info for logging
        const errorInfo = {
          message: error.message || 'Unknown error',
          name: error.name || 'Error',
          type: chatError.type,
          retryable: chatError.retryable,
          statusCode: chatError.statusCode,
          stack: error.stack,
          attempt,
          maxRetries: this.config.maxRetries
        };

        chatLogger.log('error', 'REQUEST_ERROR', `Request error on attempt ${attempt}`, errorInfo);

        // Don't retry non-retryable errors or if this is the last attempt
        if (!chatError.retryable || attempt === this.config.maxRetries) {
          break;
        }
      }
    }

    // All attempts failed
    const finalError = lastError || {
      type: ChatErrorType.UNKNOWN,
      message: 'Failed to send message after multiple attempts',
      retryable: false
    };

    chatLogger.log('error', 'FINAL_FAILURE', 'All retry attempts failed', finalError);
    throw new Error(finalError.message);
  }

  // Cancel current request
  cancelRequest(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      chatLogger.log('info', 'CANCEL', 'Request cancelled');
    }
  }

  // Get error code for debugging
  getErrorCode(): string {
    return chatLogger.getErrorCode();
  }

  // Get recent logs for debugging
  getLogs() {
    return chatLogger.getLogs();
  }
}

// Singleton instance
export const chatClient = new ChatClient();

// Preflight check function
export async function performPreflightCheck(): Promise<{ success: boolean; error?: string }> {
  try {
    chatLogger.log('info', 'PREFLIGHT', 'Starting preflight check');
    
    const healthResult = await chatClient.checkHealth();
    
    if (!healthResult.healthy) {
      return {
        success: false,
        error: healthResult.error || 'Service health check failed'
      };
    }

    // Test with a simple echo message
    try {
      const testMessage: ChatMessage = {
        sessionId: 'preflight-test',
        message: 'ping',
        metadata: { preflight: true }
      };

      const response = await chatClient.sendMessage(testMessage);
      
      // Check if we got a valid response (even if it's a fallback message)
      if (response && (response.reply || response.error)) {
        chatLogger.log('info', 'PREFLIGHT', 'Preflight check passed', {
          hasReply: !!response.reply,
          hasError: !!response.error,
          replyLength: response.reply?.length || 0
        });
        return { success: true };
      } else {
        chatLogger.log('warn', 'PREFLIGHT', 'Preflight got unexpected response format', response);
        // Still consider it successful if we got any response
        return { success: true };
      }
      
    } catch (error: any) {
      chatLogger.log('warn', 'PREFLIGHT', 'Preflight message test failed, but health check passed', {
        errorMessage: error.message,
        errorName: error.name,
        errorType: typeof error
      });
      // If health check passed but message failed, still allow usage
      // This handles cases where the webhook might be temporarily unavailable
      return { success: true };
    }

  } catch (error: any) {
    chatLogger.log('error', 'PREFLIGHT', 'Preflight check failed', {
      errorMessage: error.message,
      errorName: error.name,
      errorStack: error.stack
    });
    return {
      success: false,
      error: error.message || 'Preflight check failed'
    };
  }
}