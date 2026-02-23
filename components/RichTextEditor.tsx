import React, { useRef, useEffect, useState } from 'react';
import { Bold, Italic, List, Smile } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  theme?: 'light' | 'dark';
}

const COMMON_EMOJIS = ['😊', '🎉', '🔥', '✨', '💯', '👍', '❤️', '🎁', '💰', '⭐', '🛍️', '🎈', '🏆', '💎', '🌟', '🎊'];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter text...',
  maxLength = 400,
  className = '',
  theme = 'dark'
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const isDark = theme === 'dark';

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
      updateCharCount(value);
    }
  }, [value]);

  const updateCharCount = (html: string) => {
    const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
    setCharCount(text.length);
  };

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');

      if (text.length <= maxLength) {
        onChange(html);
        updateCharCount(html);
      } else {
        editorRef.current.innerHTML = value;
      }
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const insertEmoji = (emoji: string) => {
    document.execCommand('insertText', false, emoji);
    editorRef.current?.focus();
    setShowEmojiPicker(false);
    handleInput();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Toolbar */}
      <div className={`flex items-center gap-2 p-2 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className={`p-2 rounded-lg transition-colors active:scale-[0.98] ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200'}`}
          title="Bold (Ctrl+B)"
        >
          <Bold className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className={`p-2 rounded-lg transition-colors active:scale-[0.98] ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200'}`}
          title="Italic (Ctrl+I)"
        >
          <Italic className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className={`p-2 rounded-lg transition-colors active:scale-[0.98] ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200'}`}
          title="Bullet List"
        >
          <List className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
        </button>

        {/* Emoji Picker Toggle */}
        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`p-2 rounded-lg transition-colors active:scale-[0.98] ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200'}`}
            title="Insert Emoji"
          >
            <Smile className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
          </button>

          {showEmojiPicker && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowEmojiPicker(false)}
              ></div>

              <div className={`absolute top-12 right-0 z-50 w-64 p-3 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-lg'}`}>
                <p className={`text-[10px] font-medium mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Quick Emojis</p>
                <div className="grid grid-cols-8 gap-1">
                  {COMMON_EMOJIS.map((emoji, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-xl ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className={`mt-2 pt-2 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  <p className={`text-[8px] text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Or type emojis directly using your keyboard
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Character Counter */}
        <span className={`text-[9px] font-medium ${charCount > maxLength ? 'text-red-400' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {charCount}/{maxLength}
        </span>
      </div>

      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className={`w-full px-4 py-3 rounded-lg text-sm font-normal outline-none transition-all min-h-[16rem] max-h-[16rem] overflow-y-auto focus:ring-2 focus:ring-blue-500/20 ${
          isDark
            ? 'bg-slate-800 text-white placeholder-slate-500 border border-slate-700 focus:border-slate-500'
            : 'bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 focus:border-slate-400'
        }`}
        style={{
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word'
        }}
      />

      <style>{`
        [contentEditable=true]:empty:before {
          content: attr(data-placeholder);
          color: rgb(148 163 184 / 0.4);
          pointer-events: none;
        }
        [contentEditable] ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        [contentEditable] li {
          margin: 0.25rem 0;
        }
        [contentEditable] strong {
          font-weight: 700;
        }
        [contentEditable] em {
          font-style: italic;
        }
      `}</style>
    </div>
  );
};
