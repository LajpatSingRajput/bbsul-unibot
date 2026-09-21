"use client";
import { useState, useEffect, useRef } from "react";
import {
  Send,
  Plus,
  Sparkles,
  Copy,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  CalendarDays,
  Wifi,
  Library,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { sourceLabels, type Source } from "@/lib/types";
import { Badge } from "./ui";
export const topics = [
  ["Admissions", "What are the BBSUL admission requirements?", BookOpen],
  ["Examinations", "What is my BBSUL exam schedule?", CalendarDays],
  ["Fee information", "What is the BBSUL semester fee?", BookOpen],
  ["Library", "What are the library hours?", Library],
  ["LMS & IT support", "How do I access the BBSUL student portal?", Wifi],
  [
    "Scholarships",
    "What scholarships are currently announced nationally?",
    ShieldCheck,
  ],
] as const;
export default function Chat({
  conversationId,
  onConversation,
  notify,
  faculty = false,
  initialQuestion,
}: any) {
  const [messages, setMessages] = useState<any[]>([]),
    [question, setQuestion] = useState(initialQuestion || ""),
    [busy, setBusy] = useState(false),
    [cid, setCid] = useState<string | undefined>(conversationId),
    [ratings, setRatings] = useState<Record<string, string>>({});
  const end = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState({
    displayName: "UniBot Assistant",
    welcomeMessage: "How can I help you today?",
  });
  useEffect(() => {
    api("chat-settings")
      .then(setSettings)
      .catch(() => {});
  }, []);
  useEffect(() => {
    setCid(conversationId);
    setMessages([]);
    if (conversationId)
      api(`conversations/${conversationId}`)
        .then((r) => setMessages(r.messages))
        .catch((e) => notify(e.message));
  }, [conversationId]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);
  async function send(text = question) {
    if (busy || text.trim().length < 2) return;
    setQuestion("");
    setBusy(true);
    const pending = {
      id: "pending",
      sender: "user",
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages((m) => [...m, pending]);
    try {
      const r = await api("chat", "POST", {
        question: text,
        conversationId: cid,
      });
      setCid(r.conversationId);
      setMessages((m) => [
        ...m.filter((x) => x.id !== "pending"),
        r.userMessage,
        r.assistant,
      ]);
      onConversation?.(r.conversationId);
    } catch (e: any) {
      setMessages((m) => m.filter((x) => x.id !== "pending"));
      setQuestion(text);
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function feedback(messageId: string, rating: string) {
    try {
      await api("feedback", "POST", { conversationId: cid, messageId, rating });
      setRatings((r) => ({ ...r, [messageId]: rating }));
      notify("Feedback saved. Thank you.");
    } catch (e: any) {
      notify(e.message);
    }
  }
  return (
    <section className="chat-panel">
      <div className="chat-toolbar">
        <div className="inline">
          <div className="bot-mark small">
            <Sparkles size={19} />
          </div>
          <div>
            <strong>{settings.displayName}</strong>
            <div className="muted tiny">University knowledge comes first</div>
          </div>
        </div>
        <button
          className="btn secondary small-btn"
          disabled={busy}
          onClick={() => {
            setCid(undefined);
            setMessages([]);
            onConversation?.(undefined);
          }}
        >
          <Plus size={16} /> New chat
        </button>
      </div>
      <div className="chat-scroll" aria-live="polite">
        {!messages.length ? (
          <div className="chat-welcome">
            <div className="bot-mark">
              <Sparkles size={32} />
            </div>
            <span className="eyebrow">YOUR CAMPUS, CONNECTED</span>
            <h2>{settings.welcomeMessage}</h2>
            <p>
              Ask about{" "}
              {faculty
                ? "academic procedures, department resources"
                : "admissions, exams, campus life"}
              ,<br className="desktop" /> or anything you need to navigate
              university.
            </p>
            <div className="suggestion-grid">
              {(faculty
                ? [
                    "Find faculty-related university resources",
                    "What is my department timetable?",
                    "How can I verify an answer?",
                    "What can UniBot help me with?",
                  ]
                : [
                    "What can UniBot help me with?",
                    "What are the BBSUL admission requirements?",
                    "How do I find my previous conversations?",
                    "How can I verify an answer?",
                  ]
              ).map((s) => (
                <button key={s} onClick={() => send(s)}>
                  {s}
                  <ArrowUpRight size={17} />
                </button>
              ))}
            </div>
            <div className="inline trust">
              <ShieldCheck size={15} /> Answers show where their information
              comes from.
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div className={`message ${m.sender}`} key={m.id}>
              {m.sender === "assistant" && (
                <div className="bot-mark mini">
                  <Sparkles size={17} />
                </div>
              )}
              <div className="message-body">
                <div className="bubble">{m.text}</div>
                <div className="message-meta">
                  {m.sender === "assistant" && (
                    <Badge
                      tone={
                        m.sourceType === "WEB"
                          ? "blue"
                          : m.sourceType === "GEMINI"
                            ? "purple"
                            : m.sourceType
                              ? "green"
                              : "gray"
                      }
                    >
                      {m.sourceType
                        ? sourceLabels[m.sourceType as Source]
                        : m.resolution === "blocked"
                          ? "Request declined"
                          : "No verified answer"}
                    </Badge>
                  )}
                  <time>
                    {new Date(m.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                {m.sourceReferences?.length > 0 && (
                  <div className="sources">
                    {m.sourceReferences.map((r: any, i: number) =>
                      r.url ? (
                        <a
                          key={i}
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          [{i + 1}] {r.title} ↗
                        </a>
                      ) : (
                        <span key={i}>
                          <BookOpen size={13} />
                          {r.title}
                        </span>
                      ),
                    )}
                  </div>
                )}
                {m.searchEntryPoint && (
                  <iframe
                    title="Google Search suggestions"
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    referrerPolicy="no-referrer"
                    srcDoc={m.searchEntryPoint}
                    className="search-suggestions"
                  />
                )}
                {m.sender === "assistant" && (
                  <div className="message-actions">
                    <button
                      aria-label="Copy response"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(m.text)
                          .then(() => notify("Answer copied."))
                          .catch(() =>
                            notify("Copy is unavailable in this browser."),
                          )
                      }
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      aria-label="Helpful"
                      aria-pressed={ratings[m.id] === "helpful"}
                      onClick={() => feedback(m.id, "helpful")}
                    >
                      <ThumbsUp size={14} />
                    </button>
                    <button
                      aria-label="Not helpful"
                      aria-pressed={ratings[m.id] === "not-helpful"}
                      onClick={() => feedback(m.id, "not-helpful")}
                    >
                      <ThumbsDown size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {busy && (
          <div className="typing" role="status">
            <Sparkles size={16} /> UniBot is checking sources<span>•••</span>
          </div>
        )}
        <div ref={end} />
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          aria-label="Your message"
          placeholder="Ask UniBot a question…"
          maxLength={2000}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          className="send"
          aria-label="Send message"
          disabled={busy || question.trim().length < 2}
        >
          <Send size={19} />
        </button>
      </form>
      <div className="chat-footnote">
        Verify important university information with the relevant department.
      </div>
    </section>
  );
}
