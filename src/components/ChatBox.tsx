'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { chatClient, performPreflightCheck, ChatMessage } from '@/lib/chatClient';
import { ChatErrorType, chatLogger } from '@/lib/chatConfig';

type GenericFunction<Args extends unknown[]> = (...args: Args) => void;
const throttle = <Args extends unknown[]>(func: GenericFunction<Args>, limit: number) => {
  let inThrottle = false;
  return (...args: Args) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
};
import { getSessionId, resetSession } from '@/lib/session';
import { useToast } from '@/components/ToastProvider';
import MarkdownRenderer from '@/components/MarkdownRenderer';

interface ChatBoxProps {
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

interface ServiceStatus {
  online: boolean;
  error?: string;
  checking: boolean;
}

interface RetryState {
  canRetry: boolean;
  lastMessage?: string;
  retrying: boolean;
}

export default function ChatBox({ inputRef }: ChatBoxProps) {
  const [messages, setMessages] = useState<{id: number, text: string, sender: 'user' | 'bot', errorCode?: string}[]>([
    { id: 1, text: "Hello! I'm SINU's AI assistant. How can I help you today? You can ask me about diploma programs, entry requirements, or any other questions about SINU.", sender: 'bot' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({ online: true, checking: false });
  const [retryState, setRetryState] = useState<RetryState>({ canRetry: false, retrying: false });

  const { addToast } = useToast();
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const chatContainerRef = useRef<null | HTMLDivElement>(null);
  const localTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = inputRef || localTextareaRef;
  const messageIdCounter = useRef<number>(2);

  useEffect(() => {
    const sessionId = getSessionId();
    setSessionId(sessionId);
    
    // Perform preflight check on component mount
    performInitialHealthCheck();
  }, []);

  const performInitialHealthCheck = async () => {
    setServiceStatus({ online: true, checking: true });
    
    try {
      const result = await performPreflightCheck();
      
      if (result.success) {
        setServiceStatus({ online: true, checking: false });
        chatLogger.log('info', 'INIT', 'Service is online and ready');
      } else {
        setServiceStatus({ 
          online: false, 
          checking: false, 
          error: result.error || 'Service unavailable' 
        });
        chatLogger.log('warn', 'INIT', 'Service appears to be offline', { error: result.error });
      }
    } catch (error: any) {
      setServiceStatus({ 
        online: false, 
        checking: false, 
        error: 'Failed to check service status' 
      });
      chatLogger.log('error', 'INIT', 'Health check failed', error);
    }
  };

  const [isPinned, setIsPinned] = useState(true);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  const scrollToBottom = () => {
    if (messagesEndRef.current && isPinned) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  };

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollHeight, scrollTop, clientHeight } = chatContainerRef.current;
    const atBottom = scrollHeight - (scrollTop + clientHeight) <= 40;
    setIsPinned(atBottom);
    setShowJumpToBottom(!atBottom);
  };

  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      const throttledScroll = throttle(handleScroll, 60);
      chatContainer.addEventListener('scroll', throttledScroll);
      return () => chatContainer.removeEventListener('scroll', throttledScroll);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: ChatMessage) => {
      return await chatClient.sendMessage(messageData);
    },
    onSuccess: async (data) => {
      // Helper to robustly extract readable text
      const extractText = (input: unknown, visited = new Set<object>()): string | null => {
        const preferred = ['reply', 'response', 'message', 'text', 'content', 'output', 'result', 'answer'];
        if (input == null) return null;
        if (typeof input === 'string') {
          const trimmed = input.trim();
          return trimmed.length > 0 ? trimmed : null;
        }
        if (typeof input === 'number' || typeof input === 'boolean') {
          return String(input);
        }
        if (Array.isArray(input)) {
          for (const item of input) {
            const ex = extractText(item, visited);
            if (ex) return ex;
          }
          return null;
        }
        if (typeof input === 'object') {
          const obj = input as Record<string, unknown>;
          if (visited.has(obj)) return null;
          visited.add(obj);
          for (const key of preferred) {
            const ex = extractText(obj[key], visited);
            if (ex) return ex;
          }
          const containers = ['data', 'json', 'body', 'payload', 'choices'];
          for (const key of containers) {
            if (key in obj) {
              const ex = extractText(obj[key], visited);
              if (ex) return ex;
            }
          }
          for (const value of Object.values(obj)) {
            const ex = extractText(value, visited);
            if (ex) return ex;
          }
          return null;
        }
        return null;
      };

      const tryParseJsonString = (value: string): unknown => {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      };

      let responseText = extractText(data) || '';

      // If responseText looks like a JSON object string, attempt to parse and extract
      if (!responseText || (/^\s*\{[\s\S]*\}\s*$/.test(responseText) || /^\s*\[[\s\S]*\]\s*$/.test(responseText))) {
        const parsed = typeof responseText === 'string' ? tryParseJsonString(responseText) : null;
        const fromParsed = parsed ? extractText(parsed) : null;
        if (fromParsed) responseText = fromParsed;
      }

      // Friendly fallback if still empty or looks like {"output":null}
      if (!responseText || /"output"\s*:\s*null/.test(responseText)) {
        responseText = 'Sorry, I could not generate a response at the moment. Please try again or rephrase your question.';
      }
      
      const botMessage = {
        id: messageIdCounter.current++,
        text: responseText,
        sender: 'bot' as const
      };
      setMessages(prev => [...prev, botMessage]);
      setIsBotTyping(false);
      setRetryState({ canRetry: false, retrying: false });
      
      // Update service status to online if it was offline
      if (!serviceStatus.online) {
        setServiceStatus({ online: true, checking: false });
      }
    },
    onError: (error: Error) => {
      console.error('Error sending message:', error);
      
      const errorCode = chatClient.getErrorCode();
      let errorMessage = error.message;
      let canRetry = true;
      
      // Categorize error for better UX
      if (error.message.includes('connect') || error.message.includes('network')) {
        errorMessage = 'Unable to connect to the chat service. Please check your internet connection.';
        setServiceStatus({ online: false, checking: false, error: 'Connection failed' });
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. The service may be experiencing high load.';
      } else if (error.message.includes('Rate limit')) {
        errorMessage = 'Too many requests. Please wait a moment before trying again.';
      } else if (error.message.includes('unavailable')) {
        errorMessage = 'The chat service is temporarily unavailable. Please try again in a few moments.';
        setServiceStatus({ online: false, checking: false, error: 'Service unavailable' });
      } else if (error.message.includes('rephrasing')) {
        canRetry = false;
      }

      // Add error message to chat
      const errorBotMessage = {
        id: messageIdCounter.current++,
        text: errorMessage,
        sender: 'bot' as const,
        errorCode: errorCode
      };
      setMessages(prev => [...prev, errorBotMessage]);
      
      setIsBotTyping(false);
      setRetryState({ 
        canRetry, 
        lastMessage: retryState.lastMessage,
        retrying: false 
      });
      
      addToast(`${errorMessage} (Error: ${errorCode})`, 'error');
    },
  });

  const handleSend = async (messageText?: string) => {
    const trimmedInput = (messageText || inputValue).trim();
    if (!trimmedInput) {
      addToast('Please enter a message before sending', 'warning');
      return;
    }

    if (trimmedInput.length > 1000) {
      addToast('Message is too long (max 1000 characters)', 'warning');
      return;
    }

    if (!sessionId || sessionId.trim() === '') {
      console.error('Session ID is missing or invalid');
      addToast('Session error. Please refresh the page.', 'error');
      return;
    }

    // Check service status before sending
    if (!serviceStatus.online && !serviceStatus.checking) {
      addToast('Chat service is currently offline. Please try again later.', 'error');
      return;
    }

    const newUserMessage = {
      id: messageIdCounter.current++,
      text: trimmedInput,
      sender: 'user' as const
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    if (!messageText) setInputValue(''); // Only clear input if this is a new message, not a retry
    setIsBotTyping(true);
    setRetryState({ canRetry: false, lastMessage: trimmedInput, retrying: !!messageText });

    const metadata = {
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      retry: !!messageText
    };
    
    sendMessageMutation.mutate({
      sessionId,
      message: trimmedInput,
      metadata
    });
  };

  const handleRetry = () => {
    if (retryState.lastMessage && retryState.canRetry) {
      handleSend(retryState.lastMessage);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleHealthCheck = async () => {
    setServiceStatus({ ...serviceStatus, checking: true });
    await performInitialHealthCheck();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Service Status Banner */}
      {(!serviceStatus.online || serviceStatus.checking) && (
        <div className={`px-4 py-2 text-sm font-medium ${
          serviceStatus.checking 
            ? 'bg-yellow-50 text-yellow-800 border-b border-yellow-200' 
            : 'bg-red-50 text-red-800 border-b border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {serviceStatus.checking ? (
                <>
                  <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Checking service status...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>Service offline: {serviceStatus.error}</span>
                </>
              )}
            </div>
            {!serviceStatus.checking && (
              <button
                onClick={handleHealthCheck}
                className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs font-medium transition-colors"
              >
                Retry Connection
              </button>
            )}
          </div>
        </div>
      )}

      {/* Chat Header */}
      <div className="flex justify-between items-center p-4 sm:p-6 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-20 h-20 bg-gradient-to-r from-sky-600 to-indigo-600 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h1 id="chat-modal-title" className="text-lg font-semibold bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">SINU AI Assistant</h1>
            <p className="text-sm text-slate-500">
              {serviceStatus.checking ? 'Checking status...' : serviceStatus.online ? 'Online • Ready to help' : 'Offline • Limited functionality'}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            const newSessionId = resetSession();
            setSessionId(newSessionId);
            messageIdCounter.current = 2;
            setMessages([
              { id: 1, text: "Hello! I'm SINU's AI assistant. How can I help you today? You can ask me about diploma programs, entry requirements, or any other questions about SINU.", sender: 'bot' }
            ]);
            setRetryState({ canRetry: false, retrying: false });
            chatClient.cancelRequest();
          }}
          className="px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-full text-sm font-medium hover:shadow-lg transition-all duration-200"
          aria-label="Reset chat"
        >
          Reset
        </button>
      </div>

      {/* Chat Messages */}
      <div 
        ref={chatContainerRef}
        className="h-[70vh] md:h-[75vh] overflow-y-auto overscroll-contain scroll-smooth p-4 sm:p-6 bg-white"
        role="log"
        aria-live="polite"
      >
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[65ch] px-4 py-3 rounded-2xl ${
                  message.sender === 'user'
                    ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-br-none shadow-md hover:shadow-lg transition-all duration-200'
                    : `${message.errorCode ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'} text-slate-800 rounded-bl-none border shadow-md hover:shadow-lg transition-all duration-200 prose prose-slate prose-sm max-w-none`
                }`}
              >
                {message.sender === 'bot' ? (
                  <div className="space-y-2">
                    <MarkdownRenderer content={message.text} />
                    {message.errorCode && (
                      <div className="text-xs text-red-600 font-mono mt-2 pt-2 border-t border-red-200">
                        Error Code: {message.errorCode}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="leading-relaxed text-lg">{message.text}</p>
                )}
              </div>
            </div>
          ))}
          {isBotTyping && (
            <div className="flex justify-start">
              <div className="bg-white px-6 py-4 rounded-2xl rounded-bl-none border border-slate-200 shadow-md">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
          
          {/* Retry Button */}
          {retryState.canRetry && !isBotTyping && (
            <div className="flex justify-center">
              <button
                onClick={handleRetry}
                disabled={retryState.retrying}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-full text-sm font-medium transition-colors flex items-center space-x-2"
              >
                {retryState.retrying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Retrying...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Retry Last Message</span>
                  </>
                )}
              </button>
            </div>
          )}
          
          <div ref={messagesEndRef} />
          {showJumpToBottom && (
            <button
              onClick={() => {
                setIsPinned(true);
                scrollToBottom();
              }}
              className="fixed bottom-24 right-8 bg-slate-800 text-white px-4 py-2 rounded-full shadow-lg hover:bg-slate-700 transition-colors z-10"
            >
              Jump to latest
            </button>
          )}
        </div>
      </div>

      {/* Chat Input */}
      <div className="border-t border-slate-200 p-4 sm:p-6 bg-white">
        <div className="flex items-end space-x-3">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about SINU programs..." 
              style={{color: '#4B5563'}}
              className="w-full border-2 border-slate-200 rounded-2xl px-6 py-4 pr-12 focus:outline-none focus:border-sky-500 resize-none shadow-sm transition-all duration-200 bg-white hover:border-slate-300"
              rows={1}
              maxLength={1000}
              aria-label="Chat input"
              disabled={!serviceStatus.online || isBotTyping}
            />
            <div className="absolute bottom-2 right-3 text-xs text-gray-500">
              {inputValue.length}/1000
            </div>
          </div>
          <button
            onClick={() => handleSend()}
            className="p-4 bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-full hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!inputValue.trim() || !serviceStatus.online || isBotTyping}
            aria-label="Send message"
          >
            <svg
              className="w-6 h-6 transform rotate-90"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}