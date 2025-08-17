'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';

const throttle = (func: Function, limit: number) => {
  let inThrottle: boolean;
  return function (...args: any[]) {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};
import { getSessionId, resetSession } from '@/lib/session';
import { useToast } from '@/components/ToastProvider';
import MarkdownRenderer from '@/components/MarkdownRenderer';

interface ChatBoxProps {
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export default function ChatBox({ inputRef }: ChatBoxProps) {
  const [messages, setMessages] = useState<{id: number, text: string, sender: 'user' | 'bot'}[]>([
    { id: 1, text: "Hello! I'm SINU's AI assistant. How can I help you today? You can ask me about diploma programs, entry requirements, or any other questions about SINU.", sender: 'bot' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [isBotTyping, setIsBotTyping] = useState(false);

  const { addToast } = useToast();
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const chatContainerRef = useRef<null | HTMLDivElement>(null);
  const localTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = inputRef || localTextareaRef;
  const messageIdCounter = useRef<number>(2);

  useEffect(() => {
    const sessionId = getSessionId();
    setSessionId(sessionId);
  }, []);

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
    mutationFn: async (messageData: { sessionId: string; message: string; metadata?: any }) => {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData),
      });

      if (!response.ok) {
        let errorDetails = 'Failed to send message. Please try again.';
        try {
          const contentType = response.headers.get('Content-Type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorDetails = errorData.error || errorData.message || errorDetails;
          } else {
            errorDetails = await response.text();
            if (!errorDetails) {
              errorDetails = response.statusText || `HTTP ${response.status}`;
            }
          }
        } catch (e) {
          try {
            errorDetails = await response.text();
          } catch (textError) {
            errorDetails = response.statusText || `HTTP ${response.status}`;
          }
        }
        
        if (response.status === 429) {
          throw new Error(errorDetails || 'Rate limit exceeded. Please try again later.');
        } else {
          throw new Error(errorDetails);
        }
      }

      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        const text = await response.text();
        return { message: text };
      }
    },
    onSuccess: async (data) => {
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
    },
    onError: (error: Error) => {
      console.error('Error sending message:', error);
      addToast(error.message || "Sorry, I encountered an error. Please try again.", 'error');
      setIsBotTyping(false);
    },
  });

  const handleSend = async () => {
    const trimmedInput = inputValue.trim();
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



    const newUserMessage = {
      id: messageIdCounter.current++,
      text: trimmedInput,
      sender: 'user' as const
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    setInputValue('');
    setIsBotTyping(true);

    const metadata = {
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
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
  };

  return (
    <div className="flex flex-col h-full">

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
            <p className="text-sm text-slate-500">Online • Ready to help</p>
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
                          : 'bg-white text-slate-800 rounded-bl-none border border-slate-200 shadow-md hover:shadow-lg transition-all duration-200 prose prose-slate prose-sm max-w-none'
                      }`}
                    >
                      {message.sender === 'bot' ? (
                        <div className="space-y-2">
                          <MarkdownRenderer content={message.text} />
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

              placeholder="Ask me anything about SINU programs..." style={{color: '#4B5563'}}
              className="w-full border-2 border-slate-200 rounded-2xl px-6 py-4 pr-12 focus:outline-none focus:border-sky-500 resize-none shadow-sm transition-all duration-200 bg-white hover:border-slate-300"
              rows={1}
              maxLength={1000}
              aria-label="Chat input"
            />
            <div className="absolute bottom-2 right-3 text-xs text-gray-500">
              {inputValue.length}/1000
            </div>
          </div>
          <button
            onClick={handleSend}
            className="p-4 bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-full hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!inputValue.trim()}
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