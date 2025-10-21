// pages/chat.js
import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import io from "socket.io-client";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

const getAvatarForGender = (g) => {
  const key = String(g || "").toLowerCase();
  if (key === "male") return "/partner-avatar-male.png";
  if (key === "female") return "/partner-avatar-female.png";
  return "/partner-avatar.png";
};

export default function ChatPage() {
  // ===== State =====
  const [partnerName, setPartnerName] = useState("Partner");
  const [partnerAvatarSrc, setPartnerAvatarSrc] = useState("/partner-avatar.png");
  const [typing, setTyping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [msgs, setMsgs] = useState([]); // {id,self,kind:'text'|'file'|'system',html,time,status?}
  const [roomCode, setRoomCode] = useState(null);

  // Search UI
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchIds, setMatchIds] = useState([]); // ids that match
  const [matchIndex, setMatchIndex] = useState(0);

  // Emoji picker
  const [emojiOpen, setEmojiOpen] = useState(false);
  const EMOJIS = ["😊", "❤️", "😂", "👍", "🔥", "😍", "🤗", "😘", "😎", "🥰"];

  // ===== Refs =====
  const socketRef = useRef(null);
  const msgRef = useRef(null);
  const fileRef = useRef(null);
  const listRef = useRef(null);
  const messageRefs = useRef({}); // id -> DOM

  // ===== Utils =====
  const timeNow = () => {
    const d = new Date();
    const h = d.getHours() % 12 || 12;
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${h}:${m} ${d.getHours() >= 12 ? "PM" : "AM"}`;
  };
  const genId = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const escapeHtml = (s = "") =>
    s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const linkify = (text = "") =>
    text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const stripHtml = (s = "") => s.replace(/<[^>]*>/g, "");
  const scrollToBottom = () =>
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });

  // ===== Socket lifecycle =====
  useEffect(() => {
    let localName = "";
    try {
      localName = localStorage.getItem("milan_name") || "";
    } catch {}

    setPartnerAvatarSrc(getAvatarForGender("unknown"));

    const socket = io(BACKEND_URL, { transports: ["websocket"], autoConnect: true });
    socketRef.current = socket;

    socket.on("connect_error", (err) => {
      console.error("Socket connect error:", err?.message || err);
      // gentle UI system message
      setMsgs((p) => [
        ...p,
        { id: `sys-${Date.now()}`, self: false, kind: "system", html: "⚠️ Connection issue. Trying to reconnect...", time: timeNow() },
      ]);
    });

    socket.on("disconnect", (reason) => {
      // if server intentionally disconnected, show system message
      setMsgs((p) => [
        ...p,
        { id: `sys-${Date.now()}`, self: false, kind: "system", html: `Disconnected (${String(reason)}).`, time: timeNow() },
      ]);
    });

    // identify self (optional)
    socket.emit("userInfo", {
      name: localName || "You",
      avatar: null,
      gender: "unknown",
    });

    // join text queue
    socket.emit("lookingForPartner", { type: "text" });

    // partner found
    socket.on("partnerFound", ({ roomCode: rc, partner }) => {
      if (!rc) return;
      setRoomCode(rc);
      const pName = partner?.name || "Romantic Stranger";
      const pAvatar = partner?.avatar || getAvatarForGender(partner?.gender);

      setPartnerName(pName);
      setPartnerAvatarSrc(pAvatar);

      // join room on server (some servers require explicit join)
      try {
        socket.emit("joinRoom", { roomCode: rc });
      } catch (e) {}

      // small system message
      setMsgs((p) => [
        ...p,
        { id: `sys-${Date.now()}`, self: false, kind: "system", html: `You are connected with ${escapeHtml(pName)}.`, time: timeNow() },
      ]);
      scrollToBottom();
    });

    // incoming text message
    socket.on("message", (msg) => {
      if (!msg || !msg.id) return;
      setMsgs((prev) => {
        // dedupe by id: if message exists (optimistic self or previous), ignore
        if (prev.some((x) => x.id === msg.id)) return prev;
        const isSelf = socket.id === msg.senderId;
        return [
          ...prev,
          {
            id: msg.id,
            self: isSelf,
            kind: "text",
            html: `${linkify(escapeHtml(msg.text || ""))}`,
            time: timeNow(),
          },
        ];
      });
      scrollToBottom();
    });

    // incoming file message
    socket.on("fileMessage", (msg) => {
      if (!msg || !msg.id) return;
      setMsgs((prev) => {
        if (prev.some((x) => x.id === msg.id)) return prev;
        const isSelf = socket.id === msg.senderId;
        const t = (msg.fileType || "").toLowerCase();
        let inner = "";
        if (t.startsWith("image/")) {
          inner = `<a href="${msg.fileData}" target="_blank" rel="noopener"><img src="${msg.fileData}" /></a>`;
        } else if (t.startsWith("video/")) {
          inner = `<video controls><source src="${msg.fileData}" type="${msg.fileType}"></video>`;
        } else {
          inner = `<a class="file-link" download="${escapeHtml(msg.fileName || "file")}" href="${msg.fileData}">${escapeHtml(msg.fileName || "file")}</a>`;
        }
        return [
          ...prev,
          { id: msg.id, self: isSelf, kind: "file", html: inner, time: timeNow() },
        ];
      });
      scrollToBottom();
    });

    // partner typing
    socket.on("partnerTyping", () => {
      setTyping(true);
      clearTimeout(socketRef.current?._typingTimer);
      socketRef.current._typingTimer = setTimeout(() => setTyping(false), 1500);
    });

    // reaction not used now
    socket.on("reaction", () => {});

    // partner disconnected — show message then auto disconnect/redirect
    socket.on("partnerDisconnected", () => {
      // push a system message in chat
      const sysId = `sys-dis-${Date.now()}`;
      setMsgs((p) => [
        ...p,
        { id: sysId, self: false, kind: "system", html: "Your partner has been disconnected.", time: timeNow() },
      ]);
      scrollToBottom();

      // give user a moment to see message then disconnect and go to connect
      setTimeout(() => {
        try {
          socket.disconnect();
        } catch {}
        window.location.href = "/connect";
      }, 1200);
    });

    return () => {
      try {
        socket.off("connect_error");
        socket.off("disconnect");
        socket.off("partnerFound");
        socket.off("message");
        socket.off("fileMessage");
        socket.off("partnerTyping");
        socket.off("partnerDisconnected");
        socket.disconnect();
      } catch {}
    };
  }, []);

  // ===== Actions =====
  const sendText = () => {
    const val = (msgRef.current?.value || "").trim();
    if (!val || !socketRef.current || !roomCode) return;
    const id = genId();

    // optimistic UI (status: sent)
    setMsgs((p) => [
      ...p,
      { id, self: true, kind: "text", html: linkify(escapeHtml(val)), time: timeNow(), status: "sent" },
    ]);
    scrollToBottom();

    try {
      socketRef.current.emit("message", {
        id,
        text: val,
        roomCode,
        senderId: socketRef.current.id,
      });
    } catch (e) {
      // mark failed
      setMsgs((prev) => prev.map((m) => (m.id === id ? { ...m, status: "failed" } : m)));
      console.error("emit message failed", e);
    }

    msgRef.current.value = "";
    setTyping(false);
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f || !socketRef.current || !roomCode) {
      e.target.value = "";
      return;
    }

    if (f.size > MAX_FILE_BYTES) {
      alert("⚠️ File too big — max 15 MB allowed.");
      e.target.value = "";
      return;
    }

    const id = genId();
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      let inner = "";
      if (f.type.startsWith("image/")) {
        inner = `<a href="${dataUrl}" target="_blank" rel="noopener"><img src="${dataUrl}" /></a>`;
      } else if (f.type.startsWith("video/")) {
        inner = `<video controls><source src="${dataUrl}" type="${f.type}"></video>`;
      } else {
        inner = `<a class="file-link" download="${escapeHtml(f.name)}" href="${dataUrl}">${escapeHtml(f.name)}</a>`;
      }

      // optimistic UI entry for file
      setMsgs((p) => [
        ...p,
        { id, self: true, kind: "file", html: inner, time: timeNow(), status: "sent" },
      ]);
      scrollToBottom();

      try {
        socketRef.current.emit("fileMessage", {
          id,
          fileName: f.name,
          fileType: f.type,
          fileData: dataUrl,
          roomCode,
          senderId: socketRef.current.id,
        });
      } catch (err) {
        // if emit fails, mark as failed and inform user
        setMsgs((prev) => prev.map((m) => (m.id === id ? { ...m, status: "failed" } : m)));
        console.error("file emit failed", err);
        alert("⚠️ Failed to send file. Please try again.");
      }
    };
    reader.onerror = (err) => {
      console.error("file read error", err);
      alert("⚠️ Error reading file.");
    };
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  const onType = () => {
    if (!socketRef.current || !roomCode) return;
    try {
      socketRef.current.emit("typing", { roomCode });
    } catch {}
  };

  // ===== Search helpers =====
  const runSearch = (q) => {
    if (!q) {
      setMatchIds([]);
      setMatchIndex(0);
      return;
    }
    const ids = msgs
      .filter((m) => m.kind === "text" && stripHtml(m.html).toLowerCase().includes(q.toLowerCase()))
      .map((m) => m.id);
    setMatchIds(ids);
    setMatchIndex(0);
    if (ids.length) {
      const el = messageRefs.current[ids[0]];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };
  const jumpNext = () => {
    if (!matchIds.length) return;
    const next = (matchIndex + 1) % matchIds.length;
    setMatchIndex(next);
    const el = messageRefs.current[matchIds[next]];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // ===== Emoji Picker =====
  const insertEmoji = (emoji) => {
    if (!msgRef.current) return;
    const el = msgRef.current;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    el.value = before + emoji + after;
    const caret = start + emoji.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
    setEmojiOpen(false);
  };

  // ===== UI: outside click handlers =====
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest(".header-right")) setMenuOpen(false);
      if (!e.target.closest(".emoji-wrap")) setEmojiOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <>
      <Head>
        <title>Milan – Romantic Chat</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="app">
        {/* Header */}
        <header className="header">
          <div className="header-left">
            <button className="back-btn" onClick={() => (window.location.href = "/connect")} aria-label="Back">
              ⟵
            </button>
            <img className="avatar" src={partnerAvatarSrc} alt="DP" />
            <div className="partner">
              <div className="name">{partnerName}</div>
              <div className="status">
                <span className="dot" /> {typing ? "typing…" : roomCode ? "online" : "searching…"}
              </div>
            </div>
          </div>

          <div className="header-right">
            {/* SEARCH */}
            <div className="search-area">
              {searchOpen && (
                <input
                  className="search-input"
                  placeholder="Search messages…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (!matchIds.length) runSearch(searchQuery);
                      else jumpNext();
                    }
                  }}
                />
              )}
            </div>
            <button
              className="icon-btn"
              title="Search"
              aria-label="Search"
              onClick={() => {
                const v = !searchOpen;
                setSearchOpen(v);
                if (!v) {
                  setSearchQuery("");
                  setMatchIds([]);
                } else {
                  setTimeout(() => {
                    const el = document.querySelector(".search-input");
                    el && el.focus();
                  }, 50);
                }
              }}
            >
              🔎
            </button>

            {/* MENU */}
            <button className="icon-btn" title="Menu" aria-label="Menu" onClick={() => setMenuOpen((s) => !s)}>
              ⋮
            </button>
            <div className={`menu ${menuOpen ? "open" : ""}`}>
              <button
                className="menu-item"
                onClick={() => {
                  try {
                    socketRef.current.emit("disconnectByUser");
                    socketRef.current.disconnect();
                  } catch {}
                  window.location.href = "/connect";
                }}
              >
                🔌 Disconnect
              </button>
              <div className="sep" />
              <button className="menu-item" onClick={() => alert("🚩 Report submitted. Thank you!")}>
                🚩 Report
              </button>
            </div>
          </div>
        </header>

        {/* Messages */}
        <main className="chat" ref={listRef}>
          <div className="day-sep">
            <span>Today</span>
          </div>
          {msgs.map((m) => (
            <div
              key={m.id}
              className={`row ${m.self ? "me" : m.kind === "system" ? "system-row" : "you"}`}
              ref={(el) => (messageRefs.current[m.id] = el)}
            >
              <div className="msg-wrap" style={{ position: "relative" }}>
                <div className={`bubble ${m.kind === "system" ? "system-bubble" : ""}`} dangerouslySetInnerHTML={{ __html: m.html }} />
                <div className="meta">
                  <span className="time">{m.time}</span>
                  {m.self && m.kind !== "system" && (
                    <span className={`ticks ${m.status === "seen" ? "seen" : ""}`}>
                      {m.status === "sent" ? "✓" : m.status === "seen" ? "✓✓" : "✓✓"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </main>

        {/* Input Bar */}
        <footer className="inputbar">
          <input ref={fileRef} type="file" hidden onChange={handleFile} />
          <button className="tool" title="Attach" aria-label="Attach" onClick={() => fileRef.current?.click()}>
            📎
          </button>

          {/* Emoji Picker */}
          <div className="emoji-wrap" style={{ position: "relative" }}>
            <button className="tool" title="Emoji" aria-label="Emoji" onClick={() => setEmojiOpen((s) => !s)}>
              😊
            </button>
            {emojiOpen && (
              <div className="emoji-pop">
                {EMOJIS.map((e) => (
                  <button key={e} className="emoji-item" onClick={() => insertEmoji(e)}>
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            ref={msgRef}
            className="msg-field"
            type="text"
            placeholder={roomCode ? "Type a message…" : "Finding a partner…"}
            disabled={!roomCode}
            onChange={onType}
            onKeyDown={(e) => e.key === "Enter" && sendText()}
          />
          <button className="send" title="Send" aria-label="Send" onClick={sendText} disabled={!roomCode}>
            ➤
          </button>
        </footer>
      </div>

      <style jsx>{`
        :root {
          --bg: #0b101b;
          --panel: #0f1720;
          --header-1: #ff66a3;
          --header-2: #ff85b8;
          --accent: #ff4fa0;
          --accent-2: #ffe0f0;
          --text: #f6f7fb;
          --muted: #a8b0c0;
          --bubble-me: #ffd6e8;
          --bubble-me-b: #ff9cc4;
          --bubble-you: #f8f9ff;
          --bubble-you-b: #e1e8ff;
          --system-bg: rgba(255,255,255,0.04);
        }
        html,
        body {
          background: var(--bg);
        }
        .app {
          position: relative;
          display: flex;
          flex-direction: column;
          height: 100svh;
          max-width: 980px;
          margin: 0 auto;
          background: linear-gradient(180deg, var(--panel), #0b1220);
          color: var(--text);
        }

        .header {
          position: sticky;
          top: 0;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.6rem;
          padding: 0.8rem 1rem;
          background: linear-gradient(90deg, var(--header-1), var(--header-2));
          color: #071320;
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          min-width: 0;
        }
        .back-btn {
          border: none;
          background: rgba(255, 255, 255, 0.18);
          border-radius: 12px;
          padding: 0.45rem 0.6rem;
          cursor: pointer;
          color: #071320;
          font-weight: 700;
        }
        .avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid rgba(255, 255, 255, 0.7);
          background: #fff;
        }
        .partner .name {
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #fff;
        }
        .status {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.86rem;
          opacity: 0.95;
          color: var(--accent-2);
        }
        .dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #a7ffb2;
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.22) inset;
        }
        .header-right {
          position: relative;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .icon-btn {
          border: none;
          background: rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          padding: 0.55rem;
          cursor: pointer;
          color: #071320;
          font-size: 1.05rem;
        }

        .search-area {
          position: relative;
        }
        .search-input {
          width: 260px;
          background: rgba(255,255,255,0.04);
          color: var(--text);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 0.6rem 0.7rem;
          margin-right: 0.35rem;
          font-size: 0.95rem;
        }

        .menu {
          position: absolute;
          right: 0;
          top: 120%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 0.35rem;
          min-width: 180px;
          display: none;
        }
        .menu.open {
          display: block;
        }
        .menu-item {
          width: 100%;
          text-align: left;
          background: transparent;
          border: none;
          color: var(--text);
          padding: 0.6rem 0.8rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.95rem;
        }
        .menu-item:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        .sep {
          height: 1px;
          background: rgba(255, 255, 255, 0.04);
          margin: 0.35rem 0;
        }

        .chat {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: linear-gradient(180deg, rgba(7,19,32,0.45) 0%, rgba(7,12,20,0.75) 100%);
        }
        .day-sep {
          text-align: center;
          color: var(--muted);
          font-size: 0.86rem;
          margin: 8px 0 16px;
        }
        .day-sep span {
          background: var(--system-bg);
          padding: 0.25rem 0.6rem;
          border-radius: 12px;
        }

        .row {
          display: flex;
          margin: 8px 0;
        }
        .row.me {
          justify-content: flex-end;
        }
        .row.system-row {
          justify-content: center;
        }

        .bubble {
          max-width: 74%;
          background: #fff;
          border: 1px solid rgba(255,255,255,0.02);
          padding: 0.6rem 0.85rem;
          border-radius: 14px;
          line-height: 1.28;
          word-wrap: break-word;
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
          color: #071320;
        }
        .system-bubble {
          background: var(--system-bg);
          color: var(--accent-2);
          border-radius: 12px;
          padding: 0.45rem 0.6rem;
          font-weight: 600;
        }
        .me .bubble {
          background: var(--bubble-me);
          border-color: var(--bubble-me-b);
          border-top-right-radius: 4px;
        }
        .you .bubble {
          background: var(--bubble-you);
          border-color: var(--bubble-you-b);
          border-top-left-radius: 4px;
        }
        .bubble :global(img) {
          max-width: 260px;
          border-radius: 12px;
          display: block;
        }
        .bubble :global(video) {
          max-width: 260px;
          border-radius: 12px;
          display: block;
        }
        .meta {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          margin-top: 0.28rem;
          font-size: 0.78rem;
          color: var(--muted);
        }
        .ticks {
          font-size: 0.95rem;
          line-height: 1;
        }
        .ticks.seen {
          color: var(--accent);
        }

        .inputbar {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.9rem 1rem;
          background: rgba(255,255,255,0.015);
          border-top: 1px solid rgba(255, 255, 255, 0.03);
        }
        .tool {
          border: none;
          background: rgba(255,255,255,0.03);
          cursor: pointer;
          display: grid;
          place-items: center;
          border-radius: 10px;
          width: 46px;
          height: 46px;
          color: var(--text);
          font-size: 1.18rem;
        }
        .msg-field {
          flex: 1;
          background: rgba(255,255,255,0.02);
          color: var(--text);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 28px;
          padding: 0.75rem 1rem;
          outline: none;
          font-size: 0.98rem;
        }
        .msg-field::placeholder {
          color: var(--muted);
        }
        .send {
          background: linear-gradient(135deg, var(--accent), #ff9fd0);
          color: #071320;
          border: none;
          border-radius: 50%;
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(255, 79, 160, 0.2);
          font-size: 1.05rem;
        }

        .emoji-pop {
          position: absolute;
          bottom: 56px;
          left: 0;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 0.5rem;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 0.35rem;
        }
        .emoji-item {
          border: none;
          background: transparent;
          font-size: 1.4rem;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 8px;
        }
        .emoji-item:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        @media (max-width: 640px) {
          .bubble {
            max-width: 82%;
          }
          .avatar {
            width: 36px;
            height: 36px;
          }
          .search-input {
            width: 160px;
          }
          .tool {
            width: 40px;
            height: 40px;
            font-size: 1rem;
          }
          .send {
            width: 44px;
            height: 44px;
          }
        }
      `}</style>
    </>
  );
}
