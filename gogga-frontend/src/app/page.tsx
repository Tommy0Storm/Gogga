'use client';

import { useState, useEffect, useRef } from 'react';
import AudioRecorder from '@/components/AudioRecorder';
import { Send, Bot, User, Zap, Brain } from 'lucide-react';
import axios from 'axios';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  meta?: {
    cost_zar?: number;
    model?: string;
    layer?: string;
    latency_seconds?: number;
  };
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    // Optimistic UI Update
    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // API Call to FastAPI Backend
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat`, {
        message: text,
        user_id: "demo_user_123" // In production, this comes from Auth context
      });

      const data = response.data;

      const botMsg: Message = {
        role: 'assistant',
        content: data.response,
        meta: {
          cost_zar: data.meta.cost_zar,
          model: data.meta.model_used,
          layer: data.meta.layer,
          latency_seconds: data.meta.latency_seconds
        }
      };

      setMessages(prev => [...prev, botMsg]);

    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Eish! Something went wrong. Please try again.",
        meta: undefined
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAudio = (audioBlob: Blob) => {
    // Placeholder: Upload blob to backend for transcription
    console.log("Audio recorded:", audioBlob.size, "bytes");
    alert("Audio Captured! Transcription coming soon.");
  };

  return (
    <div className="flex flex-col h-screen bg-primary-50">
      {/* Header - Monochrome with Grey gradients */}
      <header className="bg-primary-800 text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🦗</span>
          <h1 className="text-xl font-bold tracking-tight">GOGGA</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-primary-700 px-2 py-1 rounded">South Africa</span>
          <span className="text-xs bg-primary-600 px-2 py-1 rounded">Beta v1.0</span>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-primary-400 mt-20">
            <div className="text-6xl mb-4">🦗</div>
            <p className="text-lg font-bold text-primary-600">Sawubona! How can I help you today?</p>
            <p className="text-sm mt-2">I can help with legal questions, code, translations, or just a chat.</p>
            <div className="flex justify-center gap-4 mt-6">
              <div className="flex items-center gap-1 text-xs text-primary-500">
                <Zap size={14} />
                <span>Speed Layer</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-primary-500">
                <Brain size={14} />
                <span>Complex Layer</span>
              </div>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div 
            key={i} 
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} chat-bubble`}
          >
            <div className={`flex gap-2 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`p-2 rounded-full h-fit ${m.role === 'user' ? 'bg-primary-800' : 'bg-primary-300'}`}>
                {m.role === 'user' ? (
                  <User size={16} className="text-white" />
                ) : (
                  <Bot size={16} className="text-primary-700" />
                )}
              </div>

              <div className={`p-3 rounded-2xl shadow-sm text-sm ${
                m.role === 'user'
                  ? 'bg-primary-800 text-white rounded-tr-none'
                  : 'bg-white text-primary-800 rounded-tl-none border border-primary-200'
              }`}>
                <div className="whitespace-pre-wrap">{m.content}</div>
                
                {/* Metadata Display */}
                {m.meta && (
                  <div className="mt-2 pt-2 border-t border-primary-200 text-[10px] opacity-70 flex gap-3 flex-wrap">
                    {m.meta.layer && (
                      <span className="flex items-center gap-1">
                        {m.meta.layer === 'speed' ? <Zap size={10} /> : <Brain size={10} />}
                        {m.meta.layer}
                      </span>
                    )}
                    {m.meta.latency_seconds && (
                      <span>{m.meta.latency_seconds}s</span>
                    )}
                    {m.meta.cost_zar && (
                      <span>R{m.meta.cost_zar.toFixed(4)}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start chat-bubble">
            <div className="bg-primary-200 p-3 rounded-lg rounded-tl-none text-xs text-primary-500 animate-pulse">
              Gogga is thinking...
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-primary-200">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <AudioRecorder onAudioReady={handleAudio} />

          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              className="input-field"
              placeholder="Type your message..."
              disabled={isLoading}
            />
          </div>

          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="p-3 bg-primary-800 text-white rounded-full hover:bg-primary-700 disabled:bg-primary-300 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
