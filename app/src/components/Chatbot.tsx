// @ts-nocheck
'use client';

import { useState } from 'react';
import { Bot, X, Send, Minimize2, Maximize2 } from 'lucide-react';

export default function Chatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: any) => setInput(e.target.value);
  
  const handleFormSubmit = async (e: any) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const userMessage = { id: Date.now().toString(), role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await response.json();
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: data.text }]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Hubo un error de conexión con Groq.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-xl transition-all duration-300 z-50 flex items-center justify-center"
      >
        <Bot size={28} />
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 bg-white border border-gray-200 shadow-2xl rounded-lg flex flex-col z-50 transition-all duration-300 ${
        isExpanded ? 'w-[800px] h-[80vh]' : 'w-[400px] h-[600px]'
      }`}
    >
      <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Bot size={24} />
          <h3 className="font-semibold text-lg">Asistente Focus (Llama 3)</h3>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsExpanded(!isExpanded)} className="hover:bg-blue-700 p-1 rounded">
            {isExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          <button onClick={() => setIsOpen(false)} className="hover:bg-blue-700 p-1 rounded">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-10">
            <Bot size={48} className="mx-auto mb-4 text-gray-400" />
            <p>¡Hola! Soy el asistente analítico de Focus.</p>
            <p className="text-sm mt-2">Pregúntame cómo se estructuran los clientes, la facturación o las organizaciones.</p>
          </div>
        )}
        
        {messages.map((m: any) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
              }`}
            >
              <span className="whitespace-pre-wrap text-sm">{m.content}</span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 text-gray-800 rounded-lg rounded-bl-none p-3 shadow-sm text-sm">
              Pensando...
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleFormSubmit} className="p-4 border-t border-gray-200 bg-white rounded-b-lg flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ej: ¿Qué es el Golden Record?"
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white p-2 rounded-md transition-colors"
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
