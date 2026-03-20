'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './page.module.css';

interface Message {
  role: 'user' | 'model';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

const SUGGESTIONS = [
  'Explique-moi un concept complexe',
  'Aide-moi à rédiger un email',
  'Génère des idées créatives',
  'Corrige mon code',
];

const STORAGE_KEY = 'ai-chat-history';

function loadHistory(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveHistory(history: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export default function ChatPage() {
  const [history, setHistory] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const newConversation = () => {
    setActiveId(null);
    setMessages([]);
    setInput('');
  };

  const openConversation = (conv: Conversation) => {
    setActiveId(conv.id);
    setMessages(conv.messages);
    setInput('');
  };

  const deleteConversation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = history.filter(c => c.id !== id);
    setHistory(updated);
    saveHistory(updated);
    if (activeId === id) newConversation();
  };

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      // Pass current messages + past conversations for context
      const pastHistory = history.filter(c => c.id !== activeId);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, allHistory: pastHistory }),
      });
      const data = await res.json();
      const finalMessages: Message[] = [...newMessages, { role: 'model', content: data.reply }];
      setMessages(finalMessages);

      // Save to history
      const title = msg.slice(0, 40) + (msg.length > 40 ? '…' : '');
      let updatedHistory: Conversation[];

      if (activeId) {
        updatedHistory = history.map(c =>
          c.id === activeId ? { ...c, messages: finalMessages } : c
        );
      } else {
        const newConv: Conversation = {
          id: Date.now().toString(),
          title,
          messages: finalMessages,
          createdAt: Date.now(),
        };
        setActiveId(newConv.id);
        updatedHistory = [newConv, ...history];
      }

      setHistory(updatedHistory);
      saveHistory(updatedHistory);
    } catch {
      setMessages([...newMessages, { role: 'model', content: '⚠️ Une erreur est survenue.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.logoGem}>◆</div>
          <span>AI Chat</span>
        </div>

        <button className={styles.newChat} onClick={newConversation}>
          + Nouvelle conversation
        </button>

        {history.length > 0 && (
          <>
            <div className={styles.divider} />
            <div className={styles.sidebarLabel}>Historique</div>
            <div className={styles.historyList}>
              {history.map(conv => (
                <div
                  key={conv.id}
                  className={`${styles.historyItem} ${activeId === conv.id ? styles.historyItemActive : ''}`}
                  onClick={() => openConversation(conv)}
                >
                  <span className={styles.historyIcon}>💬</span>
                  <span className={styles.historyTitle}>{conv.title}</span>
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => deleteConversation(e, conv.id)}
                    aria-label="Supprimer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <div className={styles.sidebarFooter}>
          <strong>Llama 3.3 70B</strong><br />
          Propulsé par Groq
        </div>
      </div>

      <div className={styles.chatArea}>
        <div className={styles.messages}>
          {messages.length === 0 && (
            <div className={styles.empty}>
              <div className={styles.emptyGem}>◆</div>
              <h2>Comment puis-je vous aider ?</h2>
              <p>Posez une question, rédigez du contenu, ou explorez des idées ensemble.</p>
              <div className={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} className={styles.suggestion} onClick={() => sendMessage(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`${styles.bubble} ${styles[msg.role]}`}>
              <span className={styles.avatar}>
                {msg.role === 'user' ? 'U' : '◆'}
              </span>
              <div className={styles.text}>{msg.content}</div>
            </div>
          ))}
          {loading && (
            <div className={`${styles.bubble} ${styles.model}`}>
              <span className={styles.avatar}>◆</span>
              <div className={styles.typing}>
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className={styles.inputBar}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            rows={1}
            placeholder="Écrivez un message… (Entrée pour envoyer)"
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
          />
          <button
            className={styles.sendBtn}
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            aria-label="Envoyer"
          >
            ↑
          </button>
        </div>
      </div>
    </main>
  );
}