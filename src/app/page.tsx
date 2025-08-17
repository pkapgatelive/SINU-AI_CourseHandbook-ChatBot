"use client";

import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { getSessionId, resetSession } from '@/lib/session';
import { useToast } from '@/components/ToastProvider';
import MarkdownRenderer from '@/components/MarkdownRenderer';

export default function Home() {
  const [messages, setMessages] = useState<{id: number, text: string, sender: 'user' | 'bot'}[]>([
    { id: 1, text: "Hello! I'm SINU's AI assistant. How can I help you today? You can ask me about diploma programs, entry requirements, or any other questions about SINU.", sender: 'bot' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const { addToast } = useToast();
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const chatContainerRef = useRef<null | HTMLDivElement>(null);
  const textareaRef = useRef<null | HTMLTextAreaElement>(null);
  const messageIdCounter = useRef<number>(2);

  // Generate or retrieve session ID
  useEffect(() => {
    const sessionId = getSessionId();
    setSessionId(sessionId);
  }, []);

  // Auto-scroll to bottom when new messages are added
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  // Create mutation for sending messages
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

  const handleStartChat = () => {
    setShowChat(true);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {!showChat ? (
        // Landing Page
        <div className="py-12 px-4 sm:px-6">
          <div className="container">
            {/* Hero Section */}
            <div className="text-center mb-16">
              <div className="mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
              </div>
              <h1 className="text-5xl md:text-7xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-6">
                SINU AI Assistant
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
                Get instant answers about SINU diploma programs, entry requirements, and more. 
                Your intelligent guide to Solomon Islands National University.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <button
                  onClick={handleStartChat}
                  className="px-10 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-105"
                >
                  Start Chatting Now
                </button>
                <a
                  href="https://sinu.edu.sb"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-10 py-4 bg-white text-gray-700 font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out border-2 border-gray-200 hover:border-blue-300"
                >
                  Visit SINU Website
                </a>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
              <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border border-white/20">
                <div className="text-blue-600 mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-center mb-4 text-gray-800">Instant Responses</h3>
                <p className="text-gray-600 text-center leading-relaxed">
                  Get immediate answers about SINU programs, requirements, and academic information 24/7.
                </p>
              </div>

              <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border border-white/20">
                <div className="text-purple-600 mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-center mb-4 text-gray-800">Smart & Accurate</h3>
                <p className="text-gray-600 text-center leading-relaxed">
                  Powered by advanced AI to provide accurate, up-to-date information about SINU courses and programs.
                </p>
              </div>

              <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border border-white/20">
                <div className="text-indigo-600 mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-center mb-4 text-gray-800">Comprehensive Info</h3>
                <p className="text-gray-600 text-center leading-relaxed">
                  Access detailed information about all SINU diploma programs, from Agriculture to ICT and beyond.
                </p>
              </div>
            </div>

            {/* Sample Questions */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/20">
              <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">Popular Questions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <button
                    onClick={() => {
                      setInputValue("What diploma programs does SINU offer?");
                      handleStartChat();
                    }}
                    className="w-full text-left p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl hover:from-blue-100 hover:to-purple-100 transition-all duration-200 border border-blue-200"
                  >
                    <span className="text-blue-600 font-medium">What diploma programs does SINU offer?</span>
                  </button>
                  <button
                    onClick={() => {
                      setInputValue("What are the entry requirements for diploma programs?");
                      handleStartChat();
                    }}
                    className="w-full text-left p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl hover:from-purple-100 hover:to-indigo-100 transition-all duration-200 border border-purple-200"
                  >
                    <span className="text-purple-600 font-medium">What are the entry requirements?</span>
                  </button>
                </div>
                <div className="space-y-4">
                  <button
                    onClick={() => {
                      setInputValue("Tell me about the Diploma of ICT programs");
                      handleStartChat();
                    }}
                    className="w-full text-left p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl hover:from-indigo-100 hover:to-blue-100 transition-all duration-200 border border-indigo-200"
                  >
                    <span className="text-indigo-600 font-medium">Tell me about ICT programs</span>
                  </button>
                  <button
                    onClick={() => {
                      setInputValue("How long do diploma programs take to complete?");
                      handleStartChat();
                    }}
                    className="w-full text-left p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl hover:from-green-100 hover:to-blue-100 transition-all duration-200 border border-green-200"
                  >
                    <span className="text-green-600 font-medium">How long do programs take?</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Chat Interface
        <div className="h-screen flex flex-col">
          {/* Chat Header */}
          <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between max-w-4xl mx-auto">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowChat(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-gray-800">SINU AI Assistant</h1>
                    <p className="text-sm text-gray-500">Online • Ready to help</p>
                  </div>
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
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full text-sm font-medium hover:shadow-lg transition-all duration-200"
              >
                New Chat
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto bg-gradient-to-br from-blue-50/30 via-indigo-50/30 to-purple-50/30 p-4"
          >
            <div className="max-w-4xl mx-auto space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs md:max-w-md lg:max-w-2xl px-6 py-4 rounded-2xl shadow-lg ${
                      message.sender === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-br-none'
                        : 'bg-white/90 backdrop-blur-sm text-gray-800 rounded-bl-none border border-white/50'
                    }`}
                  >
                    {message.sender === 'bot' ? (
                      <MarkdownRenderer content={message.text} />
                    ) : (
                      <p className="leading-relaxed">{message.text}</p>
                    )}
                  </div>
                </div>
              ))}
              {isBotTyping && (
                <div className="flex justify-start">
                  <div className="bg-white/90 backdrop-blur-sm px-6 py-4 rounded-2xl rounded-bl-none border border-white/50 shadow-lg">
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

          {/* Chat Input */}
          <div className="bg-white/90 backdrop-blur-sm border-t border-gray-200 p-4 shadow-lg">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-end space-x-3">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything about SINU programs..."
                    className="w-full border-2 border-gray-200 rounded-2xl px-6 py-4 pr-12 focus:outline-none focus:border-blue-500 resize-none shadow-sm transition-all duration-200 bg-white/80 backdrop-blur-sm"
                    rows={1}
                    maxLength={1000}
                  />
                  <div className="absolute bottom-2 right-3 text-xs text-gray-400">
                    {inputValue.length}/1000
                  </div>
                </div>
                <button
                  onClick={handleSend}
                  disabled={inputValue.trim() === '' || sendMessageMutation.isPending}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl p-4 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
