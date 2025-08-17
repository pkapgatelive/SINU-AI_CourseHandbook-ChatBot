'use client';

import { motion } from 'framer-motion';

interface ChatLauncherProps {
  onClick: () => void;
  onFocus: () => void;
}

export default function ChatLauncher({ onClick, onFocus }: ChatLauncherProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed top-6 left-1/2 transform -translate-x-1/2 z-10"
    >
      <div
        className="relative group cursor-text"
        onClick={onClick}
      >
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur opacity-30 group-hover:opacity-50 transition duration-200" />
        <button
          className="relative px-6 py-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-3 min-w-[320px] text-left"
          onFocus={onFocus}
        >
          <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className="text-slate-600 text-sm">Ask about SINU programs...</span>
          <div className="ml-auto flex items-center space-x-2 text-xs text-slate-400">
            <kbd className="px-2 py-1 bg-slate-100 rounded-md">⌘</kbd>
            <kbd className="px-2 py-1 bg-slate-100 rounded-md">K</kbd>
          </div>
        </button>
      </div>
    </motion.div>
  );
}