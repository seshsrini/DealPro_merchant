import React, { useRef, useEffect, useState } from 'react';
import { Bold, Italic, List, Smile } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

const COMMON_EMOJIS = ['😊', '🎉', '🔥', '✨', '💯', '👍', '❤️', '🎁', '💰', '⭐', '🛍️', '🎈', '🏆', '💎', '🌟', '🎊'];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter text...',
  maxLength = 400,
  className = ''
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [charCount, setCharCount] = useState(0);

  // Initialize editor content
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
        // Revert to previous value if exceeds max length
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
      <div className="flex items-center gap-2 p-2 bg-white/5 rounded-xl border border-white/10">
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95"
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4 text-slate-400" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95"
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4 text-slate-400" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95"
          title="Bullet List"
        >
          <List className="w-4 h-4 text-slate-400" />
        </button>

        {/* Emoji Picker Toggle */}
        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95"
            title="Insert Emoji"
          >
            <Smile className="w-4 h-4 text-slate-400" />
          </button>

          {/* Emoji Picker Dropdown */}
          {showEmojiPicker && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowEmojiPicker(false)}
              ></div>

              {/* Emoji Grid */}
              <div className="absolute top-12 right-0 z-50 w-64 p-3 bg-slate-900 rounded-xl border border-white/20 shadow-2xl">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Quick Emojis</p>
                <div className="grid grid-cols-8 gap-1">
                  {COMMON_EMOJIS.map((emoji, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors text-xl"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-white/10">
                  <p className="text-[8px] text-slate-500 text-center">
                    Or type emojis directly using your keyboard
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Character Counter */}
        <span className={`text-[9px] font-bold ${charCount > maxLength ? 'text-rose-400' : 'text-slate-500'}`}>
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
        className="input-premium pt-4 resize-none leading-relaxed min-h-[16rem] max-h-[16rem] overflow-y-auto focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400/50"
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
