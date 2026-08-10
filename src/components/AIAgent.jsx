// ─── AIAgent.jsx ─────────────────────────────────────────────────
// Drop-in AI agent panel for PackageEditor.
// Usage: import { AIAgentPanel } from "./AIAgent";
//        <AIAgentPanel pkg={selected} onUpdate={update} />
// "update" is the same callback: (field, value) => void

import { useState, useRef, useEffect, useCallback, useMemo } from "react";

// ── Theme tokens (mirrors main app) ──────────────────────────────
const T = {
    gold: "#C8A45A", goldLight: "#E8C97A", dark: "#1a1209",
    editorBg: "#0f1923", editorPanel: "#141e2b", editorBorder: "#1e2d3d",
    editorText: "#c9d8e8", editorMuted: "#5a7a94", editorAccent: "#C8A45A",
    editorInput: "#0a1520", navy: "#1a3a5c",
    teal: "#1D9E75", tealBg: "rgba(29,158,117,0.08)", tealBorder: "rgba(29,158,117,0.25)",
    red: "#c0392b",
};

// ── Suggestions rapides ───────────────────────────────────────────
const QUICK_CHIPS = [
    { label: "+ Hôtel", prompt: "Ajoute un hôtel 5 étoiles nommé Bosphorus Palace avec des tarifs Triple: 10500, Double: 10800, Single: 14000, Enfant: 5200" },
    { label: "+ Date départ", prompt: "Ajoute une nouvelle date de départ du 20/07 au 27/07" },
    { label: "Changer prix", prompt: "Change le prix de base à " },
    { label: "Changer titre", prompt: "Change la destination principale en " },
    { label: "+ Inclus", prompt: "Ajoute un élément inclus : " },
    { label: "Dupliquer pkg", prompt: "Génère un nouveau package similaire pour Dubai avec des tarifs équivalents" },
];

function MessageBubble({ msg }) {
    const isUser = msg.role === "user";
    const isSystem = msg.role === "system";

    const style = {
        maxWidth: "88%",
        padding: "9px 12px",
        borderRadius: 8,
        fontSize: 12,
        lineHeight: 1.5,
        alignSelf: isUser ? "flex-end" : "flex-start",
        background: isUser
            ? "rgba(200,164,90,0.12)"
            : isSystem
                ? T.tealBg
                : T.editorPanel,
        border: `1px solid ${isUser
            ? "rgba(200,164,90,0.3)"
            : isSystem
                ? T.tealBorder
                : T.editorBorder}`,
        color: isUser ? T.goldLight : isSystem ? T.teal : T.editorText,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
    };

    return <div style={style}>{msg.content}</div>;
}

function TypingIndicator() {
    return (
        <div style={{
            alignSelf: "flex-start", background: T.editorPanel,
            border: `1px solid ${T.editorBorder}`, borderRadius: 8,
            padding: "10px 14px", display: "flex", gap: 5, alignItems: "center",
        }}>
            {[0, 1, 2].map(i => (
                <div key={i} style={{
                    width: 6, height: 6, borderRadius: "50%", background: T.editorMuted,
                    animation: `bounce 1.2s ${i * 0.2}s infinite ease-in-out`,
                }} />
            ))}
            <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }`}</style>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────
export function AIAgentPanel({ pkg, onUpdate }) {
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content: `Bonjour ! Je gère votre package ${pkg?.destination ?? ""}${pkg?.destinationAccent ?? ""}.\n\nDites-moi ce que vous souhaitez modifier — prix, hôtels, dates, itinéraire, textes, options… Je m'en occupe instantanément.`,
        },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const endRef = useRef(null);
    const inputRef = useRef(null);

    // Keep greeting in sync with package name changes
    useEffect(() => {
        setMessages(prev => {
            if (prev.length === 1 && prev[0].role === "assistant") {
                return [{
                    role: "assistant",
                    content: `Bonjour ! Je gère votre package ${pkg?.destination ?? ""}${pkg?.destinationAccent ?? ""}.\n\nDites-moi ce que vous souhaitez modifier — prix, hôtels, dates, itinéraire, textes, options… Je m'en occupe instantanément.`,
                }];
            }
            return prev;
        });
    }, [pkg?.id]); // reset greeting when package switches

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    const tools = useMemo(() => ({
        updateField: ({ field, value }) => {
            console.log('tools', field, value);
            onUpdate(field, value);
        },
    }), [onUpdate]);

   const send = useCallback(async (text) => {
  const userText = (text ?? input).trim();

  if (!userText || loading) return;

  setInput("");
  setError(null);

  const userMsg = {
    role: "user",
    content: userText,
  };

  setMessages(prev => [...prev, userMsg]);
  setLoading(true);

  const history = [...messages, userMsg]
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({
      role: m.role,
      content: m.content,
    }));

  try {
    const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("Assistant IA non configuré (clé API manquante).");

    const res = await fetch(
      "https://api.deepseek.com/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          stream: false,
          max_tokens: 800,

          messages: [
            {
              role: "system",
              content: `
Tu es un assistant de modification de package.

Quand un utilisateur demande une modification,
tu dois répondre UNIQUEMENT avec du JSON.

Format :

{
  "tools": [
    {
      "name": "updateField",
      "args": {
        "field": "title",
        "value": "Nouvelle valeur"
      }
    }
  ],
  "message": "Résumé humain"
}
              `,
            },

            ...history,
          ],
        }),
      }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));

      throw new Error(
        errData?.error?.message ?? `HTTP ${res.status}`
      );
    }

    const data = await res.json();

    const rawText =
      data.choices?.[0]?.message?.content?.trim() || "";

    const clean = rawText
      .replace(/^```json/i, "")
      .replace(/```$/i, "")
      .trim();

    let parsed;

    try {
      parsed = JSON.parse(clean);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: rawText,
        },
      ]);

      return;
    }

    // Execute tools
    if (Array.isArray(parsed.tools)) {
      for (const tool of parsed.tools) {
        const fn = tools[tool.name];

        if (fn) {
          fn(tool.args);
        }
      }
    }

    setMessages(prev => [
      ...prev,
      {
        role: "assistant",
        content:
          parsed.message ||
          "Les modifications ont été appliquées.",
      },
    ]);
  } catch (err) {
    setError(`Erreur : ${err.message}`);

    setMessages(prev => [
      ...prev,
      {
        role: "assistant",
        content:
          `Erreur : ${err.message}`,
      },
    ]);
  } finally {
    setLoading(false);

    inputRef.current?.focus();
  }
}, [input, loading, messages, tools]);

    const handleKey = (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    };

    return (
        <div style={{
            width: 300,
            background: T.editorBg,
            borderLeft: `1px solid ${T.editorBorder}`,
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            fontFamily: "'Nunito Sans','Segoe UI',sans-serif",
        }}>
            {/* Header */}
            <div style={{
                padding: "12px 16px",
                background: T.editorPanel,
                borderBottom: `1px solid ${T.editorBorder}`,
                display: "flex",
                alignItems: "center",
                gap: 10,
                position: "sticky",
                top: 0,
                zIndex: 10,
            }}>
                <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: T.gold,
                    boxShadow: `0 0 6px ${T.gold}88`,
                }} />
                <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: 2,
                    textTransform: "uppercase", color: T.editorAccent,
                }}>Agent IA</span>
                <span style={{
                    marginLeft: "auto", fontSize: 9, color: T.editorMuted,
                    letterSpacing: 1, textTransform: "uppercase",
                }}>
                    {pkg?.destination}{pkg?.destinationAccent}
                </span>
            </div>

            {/* Messages */}
            <div style={{
                flex: 1,
                overflowY: "auto",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
            }}>
                {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
                {loading && <TypingIndicator />}
                {error && (
                    <div style={{ fontSize: 10, color: T.red, textAlign: "center", padding: "4px 8px" }}>
                        {error}
                    </div>
                )}
                <div ref={endRef} />
            </div>

            {/* Quick chips */}
            <div style={{
                display: "flex", flexWrap: "wrap", gap: 5,
                padding: "6px 14px 2px",
            }}>
                {QUICK_CHIPS.map(chip => (
                    <button
                        key={chip.label}
                        onClick={() => {
                            if (chip.prompt.endsWith(" ")) {
                                setInput(chip.prompt);
                                inputRef.current?.focus();
                            } else {
                                send(chip.prompt);
                            }
                        }}
                        style={{
                            background: "transparent",
                            border: `1px solid ${T.editorBorder}`,
                            borderRadius: 20,
                            color: T.editorMuted,
                            fontSize: 10,
                            padding: "3px 9px",
                            cursor: "pointer",
                            transition: "all 0.15s",
                            lineHeight: 1.6,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.color = T.gold; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = T.editorBorder; e.currentTarget.style.color = T.editorMuted; }}
                    >
                        {chip.label}
                    </button>
                ))}
            </div>

            {/* Input row */}
            <div style={{
                display: "flex",
                gap: 8,
                padding: "10px 14px",
                borderTop: `1px solid ${T.editorBorder}`,
                background: T.editorPanel,
            }}>
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Ex : Mets le prix à 8 990 DH et ajoute un jour libre à Istanbul…"
                    rows={2}
                    style={{
                        flex: 1,
                        background: T.editorInput,
                        border: `1px solid ${T.editorBorder}`,
                        borderRadius: 6,
                        color: T.editorText,
                        fontSize: 11,
                        padding: "7px 10px",
                        outline: "none",
                        resize: "none",
                        fontFamily: "inherit",
                        lineHeight: 1.5,
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = "rgba(200,164,90,0.4)"}
                    onBlur={e => e.currentTarget.style.borderColor = T.editorBorder}
                />
                <button
                    onClick={() => send()}
                    disabled={loading || !input.trim()}
                    style={{
                        background: loading || !input.trim() ? "rgba(200,164,90,0.3)" : T.gold,
                        border: "none",
                        borderRadius: 6,
                        color: T.dark,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "0 12px",
                        cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                        letterSpacing: 1,
                        whiteSpace: "nowrap",
                        transition: "background 0.2s",
                        alignSelf: "stretch",
                    }}
                >
                    {loading ? "…" : "Envoyer"}
                </button>
            </div>
        </div>
    );
}