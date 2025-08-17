'use client';

import { useState, useRef } from 'react';
import ChatLauncher from '@/components/ChatLauncher';
import ChatModal from '@/components/ChatModal';

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => {
    setIsModalOpen(false);
    if (inputRef.current) inputRef.current.blur();
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 relative">
      <ChatLauncher onClick={handleOpenModal} onFocus={handleOpenModal} />
      <ChatModal isOpen={isModalOpen} onClose={handleCloseModal} initialFocusRef={inputRef} />
      <div className="container mx-auto px-4 py-24 sm:py-32">
        <div className="text-center">
          <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 mb-6 tracking-tight">Welcome to SINU Course Information Portal</h1>
          <p className="text-xl text-slate-600 mb-8">Your AI-powered guide to Solomon Islands National University programs and courses</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border border-white/20">
              <div className="text-blue-600 mb-6"><svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
              <h3 className="text-xl font-bold text-center mb-4 text-gray-800">Instant Responses</h3>
              <p className="text-gray-600 text-center leading-relaxed">Get immediate answers about SINU programs, requirements, and academic information 24/7.</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border border-white/20">
              <div className="text-purple-600 mb-6"><svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg></div>
              <h3 className="text-xl font-bold text-center mb-4 text-gray-800">Smart & Accurate</h3>
              <p className="text-gray-600 text-center leading-relaxed">Powered by advanced AI to provide accurate, up-to-date information about SINU courses and programs.</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border border-white/20">
              <div className="text-indigo-600 mb-6"><svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg></div>
              <h3 className="text-xl font-bold text-center mb-4 text-gray-800">Comprehensive Info</h3>
              <p className="text-gray-600 text-center leading-relaxed">Access detailed information about all SINU diploma programs, from Agriculture to ICT and beyond.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}