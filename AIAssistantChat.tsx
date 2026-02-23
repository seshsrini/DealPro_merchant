/**
 * AI Assistant Chat Component
 * Floating chat bubble with conversational AI
 */

import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Sparkles, TrendingUp, DollarSign, Clock } from 'lucide-react';
import { aiAssistantService, AssistantResponse } from './services/aiAssistantService';
import { AppView, User } from './types';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  response?: AssistantResponse;
}

interface AIAssistantChatProps {
  user: User;
  theme: 'light' | 'dark';
  setView?: (view: AppView) => void;
}

export const AIAssistantChat: React.FC<AIAssistantChatProps> = ({ user, theme, setView }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: Date.now().toString(),
        text: 'Hi! I\'m your AI assistant. Ask me anything about your business!',
        isUser: false,
        timestamp: new Date(),
        response: {
          message: 'Hi! I\'m your AI assistant. Ask me anything about your business!',
          suggestions: [
            'When should I launch my next deal?',
            'What discount should I offer?',
            'How can I improve sales?',
            'Show me my performance',
          ],
        },
      }]);
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await aiAssistantService.sendQuery(user.id, inputValue);

      if (response) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: response.message,
          isUser: false,
          timestamp: new Date(),
          response,
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error('No response from assistant');
      }
    } catch (error) {
      console.error('[AIAssistantChat] Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    setTimeout(() => sendMessage(), 100);
  };

  const handleActionClick = (route: string) => {
    if (setView) {
      // Map routes to views
      if (route === '/merchant/campaigns') setView('merchant_deals');
      else if (route === '/merchant/catalogue') setView('merchant_catalogue');
      else if (route === '/merchant/analytics') setView('merchant_analytics');
      else if (route === '/merchant/ai-insights') setView('merchant_ai_insights');
    }
    setIsOpen(false);
  };

  const quickActions = [
    { icon: Clock, label: 'Best Time', query: 'When should I launch my next deal?' },
    { icon: DollarSign, label: 'Pricing', query: 'What discount should I offer?' },
    { icon: TrendingUp, label: 'Improve', query: 'How can I improve sales?' },
  ];

  return (
    <>
      {/* Floating Chat Bubble */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-lg transition-all active:scale-[0.98] z-50 ${
            isDark ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <MessageCircle className="w-6 h-6 text-white" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-[500px] rounded-xl flex flex-col z-50 border ${
            isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-lg'
          }`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between p-4 border-b rounded-t-xl ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-900 border-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-white" />
              <h3 className="font-semibold text-white text-sm">AI Assistant</h3>
              <div className="w-2 h-2 bg-green-400 rounded-full" />
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Quick Actions */}
          {messages.length === 0 && (
            <div className={`p-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <p className={`text-sm mb-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Quick actions:
              </p>
              <div className="grid grid-cols-3 gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleSuggestionClick(action.query)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all active:scale-[0.98] ${
                      isDark
                        ? 'bg-slate-800 border border-slate-700 text-slate-300'
                        : 'bg-slate-50 border border-slate-200 text-slate-700'
                    }`}
                  >
                    <action.icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl p-3 ${
                    msg.isUser
                      ? 'bg-blue-600 text-white'
                      : isDark
                      ? 'bg-slate-800 text-slate-100 border border-slate-700'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>

                  {/* Suggestions */}
                  {!msg.isUser && msg.response?.suggestions && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs opacity-70 mb-2">You might also ask:</p>
                      {msg.response.suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className={`block w-full text-left text-xs px-3 py-2 rounded-lg transition-all active:scale-[0.98] ${
                            isDark
                              ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                              : 'bg-white hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Action Button */}
                  {!msg.isUser && msg.response?.actionButton && (
                    <button
                      onClick={() => handleActionClick(msg.response!.actionButton!.route)}
                      className="mt-3 w-full h-10 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 transition-all active:scale-[0.98]"
                    >
                      {msg.response.actionButton.text}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Loading */}
            {isLoading && (
              <div className="flex justify-start">
                <div
                  className={`rounded-xl p-3 ${
                    isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100'
                  }`}
                >
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className={`p-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask me anything..."
                disabled={isLoading}
                className={`flex-1 h-10 px-4 rounded-lg text-sm outline-none transition-all ${
                  isDark
                    ? 'bg-slate-800 text-white placeholder-slate-500 border border-slate-700 focus:border-slate-500'
                    : 'bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 focus:border-slate-400'
                }`}
              />
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-[0.98] ${
                  inputValue.trim() && !isLoading
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : isDark
                    ? 'bg-slate-800 text-slate-600 border border-slate-700'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
