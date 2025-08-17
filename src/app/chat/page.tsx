"use client";

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSessionId, resetSession } from '@/lib/session';
import { useToast } from '@/components/ToastProvider';
import MarkdownRenderer from '@/components/MarkdownRenderer';

export default function ChatPage() {
  const [messages, setMessages] = useState<{id: number, text: string, sender: 'user' | 'bot'}[]>([
    { id: 1, text: "Hello! How can I help you today?", sender: 'bot' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const chatContainerRef = useRef<null | HTMLDivElement>(null);
  const textareaRef = useRef<null | HTMLTextAreaElement>(null);
  const isUserScrolling = useRef(false);
  const lastMessageId = useRef<number | null>(null);
  const lastSentMessage = useRef<string>('');
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const messageIdCounter = useRef<number>(2); // Start from 2 since initial message has id 1

  // Generate or retrieve session ID
  useEffect(() => {
    // Get session ID using the utility function
    const sessionId = getSessionId();
    setSessionId(sessionId);
  }, []);

  // Create mutation for sending messages
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { sessionId: string; message: string; metadata?: any }) => {
      // Guard against undefined/empty message data
      if (!messageData) {
        throw new Error('Invalid message data: message data is required');
      }

      // Validate session ID
      if (!messageData.sessionId) {
        throw new Error('Invalid message data: session ID is required');
      }

      if (typeof messageData.sessionId !== 'string') {
        throw new Error('Invalid message data: session ID must be a string');
      }

      if (messageData.sessionId.trim().length === 0) {
        throw new Error('Invalid message data: session ID cannot be empty');
      }

      // Validate message content
      if (!messageData.message) {
        throw new Error('Invalid message data: message content is required');
      }

      if (typeof messageData.message !== 'string') {
        throw new Error('Invalid message data: message must be a string');
      }

      const trimmedMessage = messageData.message.trim();
      if (trimmedMessage.length === 0) {
        throw new Error('Invalid message data: message cannot be empty');
      }

      // Additional validation for message content
      if (trimmedMessage.length > 1000) {
        throw new Error('Invalid message data: message is too long (max 1000 characters)');
      }

      // Validate session ID format (basic validation)
      if (messageData.sessionId.length < 8) {
        throw new Error('Invalid session ID: session ID is too short');
      }

      if (messageData.sessionId.length > 100) {
        throw new Error('Invalid session ID: session ID is too long');
      }

      // Sanitize message content (remove any leading/trailing whitespace)
      const sanitizedMessageData = {
        ...messageData,
        message: trimmedMessage
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sanitizedMessageData),
      });

      // Verify response Content-Type header
      const responseContentType = response.headers.get('Content-Type');
      if (responseContentType) {
        // For streaming responses, check for appropriate content types
        const isStreaming = responseContentType.includes('text/event-stream') || responseContentType.includes('text/plain');
        const isJson = responseContentType.includes('application/json');
        
        if (!isStreaming && !isJson) {
          console.warn('Unexpected Content-Type in response:', responseContentType);
        }
      } else {
        console.warn('Missing Content-Type header in response');
      }

      if (!response.ok) {
        // Try to get error details from the response with improved error handling
        let errorDetails = 'Failed to send message. Please try again.';
        try {
          // First, check the content type to determine how to parse the response
          const contentType = response.headers.get('Content-Type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorDetails = errorData.error || errorData.message || errorDetails;
          } else {
            // If not JSON, try to get text
            errorDetails = await response.text();
            // If text is empty, use status text
            if (!errorDetails) {
              errorDetails = response.statusText || `HTTP ${response.status}`;
            }
          }
        } catch (e) {
          // If we can't parse the error response, try to get text
          try {
            errorDetails = await response.text();
          } catch (textError) {
            // If we can't get text either, use the status text
            errorDetails = response.statusText || `HTTP ${response.status}`;
          }
        }
        
        if (response.status === 429) {
          throw new Error(errorDetails || 'Rate limit exceeded. Please try again later.');
        } else {
          throw new Error(errorDetails);
        }
      }

      // Check if response is streaming
      const contentType = response.headers.get('Content-Type');
      if (contentType && (contentType.includes('text/event-stream') || contentType.includes('text/plain'))) {
        return response;
      }

      // Handle non-streaming response with improved error handling
      try {
        // First, check the content type to determine how to parse the response
        const contentType = response.headers.get('Content-Type');
        if (contentType && contentType.includes('application/json')) {
          // Try to parse as JSON first
          return await response.json();
        } else {
          // If not JSON, return as text
          const text = await response.text();
          return { message: text };
        }
      } catch (e) {
        // If parsing fails, try to get text content
        try {
          const text = await response.text();
          return { message: text };
        } catch (textError) {
          // If we can't get text either, throw an error
          throw new Error('Failed to parse response from server');
        }
      }
    },
    onSuccess: async (data) => {
      // Handle streaming response
      if (data instanceof Response) {
        // Create initial bot message
        const botMessageId = messageIdCounter.current++;
        lastMessageId.current = botMessageId;
        
        const botMessage = {
          id: botMessageId,
          text: '',
          sender: 'bot' as const
        };
        
        setMessages(prev => [...prev, botMessage]);
        setIsBotTyping(false);
        setError(null);
        
        // Handle streaming data
        const reader = data.body?.getReader();
        const decoder = new TextDecoder();
        
        if (reader) {
          let accumulatedText = '';
          const contentType = data.headers.get('Content-Type');
          const isSSE = contentType && contentType.includes('text/event-stream');
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              const chunk = decoder.decode(value, { stream: true });
              
              if (isSSE) {
                // Handle SSE format: data: ...\n\n
                const lines = chunk.split('\n');
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6); // Remove 'data: ' prefix
                    if (data === '[DONE]') {
                      // End of stream signal
                      break;
                    }
                    try {
                      const parsed = JSON.parse(data);
                      accumulatedText += parsed.content || parsed.text || data;
                    } catch (e) {
                      // If not JSON, treat as plain text
                      accumulatedText += data;
                    }
                  }
                }
              } else {
                // Handle plain chunked text
                accumulatedText += chunk;
              }
              
              // Update the last message with accumulated text
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage.id === botMessageId && lastMessage.sender === 'bot') {
                  newMessages[newMessages.length - 1] = {
                    ...lastMessage,
                    text: accumulatedText
                  };
                }
                return newMessages;
              });
            }
          } catch (error) {
            console.error('Error reading stream:', error);
            setError('Error reading response stream');
            
            // Add error message to chat
            const errorMessage = {
              id: messageIdCounter.current++,
              text: "Sorry, I encountered an error while processing your message. Please try again.",
              sender: 'bot' as const
            };
            setMessages(prev => [...prev, errorMessage]);
          } finally {
            reader.releaseLock();
          }
        } else {
          // Handle case where reader is not available
          console.error('Stream reader is not available');
          setError('Error reading response stream');
          
          // Add error message to chat
          const errorMessage = {
            id: messageIdCounter.current++,
            text: "Sorry, I encountered an error while processing your message. Please try again.",
            sender: 'bot' as const
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      } else {
        // Handle non-streaming JSON response
        console.log('[Debug] Received response data:', data);
        
        // Try multiple possible response field names from n8n webhook
        let responseText = '';
        if (data.reply) {
          responseText = data.reply;
        } else if (data.response) {
          responseText = data.response;
        } else if (data.message) {
          responseText = data.message;
        } else if (data.text) {
          responseText = data.text;
        } else if (data.content) {
          responseText = data.content;
        } else if (data.output) {
          responseText = data.output;
        } else if (data.result) {
          responseText = data.result;
        } else if (data.answer) {
          responseText = data.answer;
        } else if (typeof data === 'string') {
          responseText = data;
        } else {
          // If none of the expected fields exist, try to extract any text content
          const possibleTextFields = Object.values(data).find(value =>
            typeof value === 'string' && value.trim().length > 0
          ) as string | undefined;
          responseText = possibleTextFields || "I received your message. This is a simulated response.";
        }
        
        const botMessage = {
          id: messageIdCounter.current++,
          text: responseText,
          sender: 'bot' as const
        };
        setMessages(prev => [...prev, botMessage]);
        setIsBotTyping(false);
        setError(null);
      }
    },
    onError: (error: Error) => {
      console.error('Error sending message:', error);
      // Show error in toast instead of adding to chat
      addToast(error.message || "Sorry, I encountered an error. Please try again.", 'error');
      setIsBotTyping(false);
      setError(null); // Clear inline error since we're using toast
    },
  });

  // Focus management for accessibility
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Handle scroll events to detect user scrolling
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px threshold
    
    // If user scrolls to bottom, enable auto-scrolling
    if (isAtBottom) {
      isUserScrolling.current = false;
      setShowJumpToLatest(false);
    } else {
      // If user scrolls up, disable auto-scrolling and show jump to latest
      isUserScrolling.current = true;
      setShowJumpToLatest(true);
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      // Always scroll to bottom for new messages unless user is actively scrolling up
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    // Auto-scroll to bottom when new messages are added
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100); // Small delay to ensure DOM is updated
    
    return () => clearTimeout(timer);
  }, [messages]);

  // Add scroll event listener
  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      chatContainer.addEventListener('scroll', handleScroll);
      return () => {
        chatContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);

  const handleResetSession = () => {
    // Reset the session and update the state
    const newSessionId = resetSession();
    setSessionId(newSessionId);
    
    // Reset message counter and clear the chat messages when resetting session
    messageIdCounter.current = 2;
    setMessages([
      { id: 1, text: "Hello! How can I help you today?", sender: 'bot' }
    ]);
  };

  const handleSend = async () => {
    // Client-side guard: if message is empty/whitespace, show toast
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) {
      addToast('Please enter a message before sending', 'warning');
      return;
    }

    // Additional validation for message length
    if (trimmedInput.length > 1000) {
      addToast('Message is too long (max 1000 characters)', 'warning');
      return;
    }

    // Additional guard for session ID
    if (!sessionId || sessionId.trim() === '') {
      console.error('Session ID is missing or invalid');
      addToast('Session error. Please refresh the page.', 'error');
      return;
    }

    // Debounce duplicate sends (500ms cooldown)
    const messageKey = `${sessionId}:${trimmedInput}`;
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    // Check if this exact message was sent recently
    if (lastSentMessage.current === messageKey) {
      console.debug('[Telemetry] Duplicate message send prevented');
      return;
    }
    
    // Set the current message as the last sent
    lastSentMessage.current = messageKey;
    
    // Set debounce timeout to clear the last sent message reference
    debounceTimeout.current = setTimeout(() => {
      lastSentMessage.current = '';
    }, 500);

    // Add user message immediately
    const newUserMessage = {
      id: messageIdCounter.current++,
      text: trimmedInput,
      sender: 'user' as const
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    setInputValue('');
    setIsBotTyping(true);
    setError(null); // Clear any previous inline errors
    
    // Reset scroll state for new message
    isUserScrolling.current = false;
    setShowJumpToLatest(false); // Hide jump to latest when sending new message

    // Log message count per session (client-side telemetry)
    if (typeof window !== 'undefined' && sessionId) {
      try {
        // Get current message count from localStorage
        const messageCountKey = `messageCount_${sessionId}`;
        const currentCount = parseInt(localStorage.getItem(messageCountKey) || '0', 10);
        const newCount = currentCount + 1;
        
        // Store updated count
        localStorage.setItem(messageCountKey, newCount.toString());
        
        // Log to console for devtools visibility
        console.log(`[Telemetry] Session ${sessionId} - Message #${newCount}`);
      } catch (e) {
        // Silently fail telemetry logging to not affect user experience
        console.debug('Telemetry logging failed:', e);
      }
    }

    // Send message using mutation
    // Prepare metadata - can be extended later with user profile or RAG context
    const metadata = {
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      // Add any other metadata that might be useful
    };
    
    sendMessageMutation.mutate({
      sessionId,
      message: trimmedInput,
      metadata
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    
    // Accessibility: Allow user to navigate messages with arrow keys
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (chatContainerRef.current) {
        e.key === 'ArrowUp'
          ? chatContainerRef.current.scrollBy(0, -50)
          : chatContainerRef.current.scrollBy(0, 50);
      }
    }
  };

  // Handle focus for accessibility
  const handleFocusMessages = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.focus();
    }
  };

  return (
    <div className="flex justify-center w-full h-screen bg-background">
      <div className="w-full h-full md:w-[50vw] flex flex-col bg-background shadow-lg rounded-lg overflow-hidden">
        <main
          className="flex-1 overflow-hidden"
          role="main"
          aria-label="Chat interface"
        >
          {/* Header with reset button */}
          <div className="flex justify-between items-center p-4 border-b border-secondary bg-background">
            <h1 className="text-xl font-bold text-foreground">Chat</h1>
            <button
              onClick={handleResetSession}
              className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-200 shadow-sm"
              aria-label="Reset session"
            >
              Reset
            </button>
          </div>
          
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 bg-background"
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                if (textareaRef.current) {
                  textareaRef.current.focus();
                }
              }
            }}
          >
            {/* Jump to latest button */}
            {showJumpToLatest && (
              <div className="flex justify-center mb-4">
                <button
                  onClick={() => {
                    if (messagesEndRef.current) {
                      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
                      isUserScrolling.current = false;
                      setShowJumpToLatest(false);
                    }
                  }}
                  className="bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-medium hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-200 shadow-sm"
                  aria-label="Jump to latest message"
                >
                  Jump to latest
                </button>
              </div>
            )}
            
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl shadow-sm ${
                      message.sender === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-secondary text-foreground rounded-bl-none border border-secondary'
                    }`}
                    role="status"
                    aria-label={`${message.sender === 'user' ? 'You' : 'Bot'} said: ${message.text}`}
                  >
                    {message.sender === 'bot' ? (
                      <MarkdownRenderer content={message.text} />
                    ) : (
                      message.text
                    )}
                  </div>
                </div>
              ))}
              {isBotTyping && (
                <div className="flex justify-start">
                  <div className="bg-secondary text-foreground px-4 py-3 rounded-2xl rounded-bl-none border border-secondary shadow-sm">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-secondary bg-background p-4">
            <div className="flex items-end space-x-2">
              <div className="flex-1 relative">
                <label htmlFor="message-input" className="sr-only">
                  Type your message
                </label>
                <textarea
                  id="message-input"
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="w-full border border-secondary rounded-2xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none shadow-sm transition-all duration-200"
                  rows={1}
                  aria-label="Type your message"
                  aria-describedby="chat-instructions"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={inputValue.trim() === '' || sendMessageMutation.isPending}
                className="bg-primary text-primary-foreground rounded-2xl p-3 hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm"
                aria-label="Send message"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </div>
            <div id="chat-instructions" className="text-xs text-foreground/60 mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}