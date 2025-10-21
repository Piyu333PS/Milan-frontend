// pages/chat.js
import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import io from "socket.io-client";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com";

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

  const [msgs, setMsgs] = useState([]); // {id,self,kind:'text'|'file',html,time,status?}
  const [roomCode, setRoomCode] = useState(null); // ✅ true room code from server

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
    // Optional: user info you may have saved elsewhere
    let localName = "";
    try {
      localName = localStorage.getItem("milan_name") || "";
    } catch {}

    // avatar/gender defaults (can be updated when partnerFound fires)
    setPartnerAvatarSrc(getAvatarForGender("unknown"));

    const socket = io(BACKEND_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    // let server know who we are (best-effort)
    socket.emit("userInfo", {
      name: localName || "You",
      avatar: null,
      gender: "unknown",
    });

    // ✅ Correct matchmaking for TEXT chat
    socket.emit("lookingForPartner", { type: "text" });

    // 🔔 partner found -> use server-provided roomCode (NO DEMO / random)
    socket.on("partnerFound", ({ roomCode: rc, partner }) => {
      if (!rc) return;
      setRoomCode(rc);
      const pName = partner?.name || "Romantic Stranger";
      const pAvatar = partner?.avatar || getAvatarForGender(partner?.gender);

      setPartnerName(pName);
      setPartnerAvatarSrc(pAvatar);

      // join the real room from server
      socket.emit("joinRoom", { roomCode: rc });

      // store for continuity across pages (not source of truth)
      try {
        sessionStorage.setItem(
          "partnerData",
          JSON.stringify({
            roomCode: rc,
            name: pName,
            avatar: pAvatar,
            gender: partner?.gender || "unknown",
          })
        );
      } catch {}
    });

    // Incoming text message
    socket.on("message", (msg) => {
      const isSelf = socket.id === msg.senderId;
      setMsgs((p) => [
        ...p,
        {
          id: msg.id || genId(),
          self: isSelf,
          kind: "text",
          html: `${linkify(escapeHtml(msg.text || ""))}`,
          time: timeNow(),
        },
      ]);
      scrollToBottom();
    });

    // Incoming file
    socket.on("fileMessage", (msg) => {
      const isSelf = socket.id === msg.senderId;
      const t = (msg.fileType || "").toLowerCase();
      let inner = "";
      if (t.startsWith("image/")) {
        inner = `<a href="${msg.fileData}" target="_blank"><img src="${msg.fileData}" /></a>`;
      } else if (t.startsWith("video/")) {
        inner = `<video controls><source src="${msg.fileData}" type="${msg.fileType}"></video>`;
      } else {
        inner = `<a class="file-link" download="${escapeHtml(msg.fileName || "file")}" href="${msg.fileData}">
                   ${escapeHtml(msg.fileName || "file")}
                 </a>`;
      }
      setMsgs((p) => [
        ...p,
        { id: msg.id || genId(), self: isSelf, kind: "file", html: inner, time: timeNow() },
      ]);
      scrollToBottom();
    });

    // Typing indicator from partner
    socket.on("partnerTyping", () => {
      setTyping(true);
      clearTimeout(socketRef.current?._typingTimer);
      socketRef.current._typingTimer = setTimeout(() => setTyping(false), 1500);
    });

    // keep listeners for future (no UI bar now)
    socket.on("reaction", () => {});

    socket.on("partnerDisconnected", () => {
      alert("💔 Partner disconnected.");
      window.location.href = "/connect";
    });

    return () => {
      try {
        socket.disconnect();
      } catch {}
    };
  }, []);

  // ===== Actions =====
  const sendText = () => {
    const val = (msgRef.current?.value || "").trim();
    if (!val || !socketRef.current || !roomCode) return;
    const id = genId();

    // optimistic UI
    setMsgs((p) => [
      ...p,
      { id, self: true, kind: "text", html: linkify(escapeHtml(val)), time: timeNow(), status: "sent" },
    ]);
    scrollToBottom();

    socketRef.current.emit("message", {
      id,
      text: val,
      roomCode, // ✅ real room
      senderId: socketRef.current.id,
    });

    msgRef.current.value = "";
    setTyping(false);
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f || !socketRef.current || !roomCode) return;

    const id = genId();
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;

      let inner = "";
      if (f.type.startsWith("image/")) {
        inner = `<a href="${dataUrl}" target="_blank"><img src="${dataUrl}" /></a>`;
      } else if (f.type.startsWith("video/")) {
        inner = `<video controls><source src="${dataUrl}" type="${f.type}"></video>`;
      } else {
        inner = `<a class="file-link" download="${escapeHtml(f.name)}" href="${dataUrl}">${escapeHtml(f.name)}</a>`;
      }
      setMsgs((p) => [
        ...p,
        { id, self: true, kind: "file", html: inner, time: timeNow(), status: "sent" },
      ]);
      scrollToBottom();

      socketRef.current.emit("fileMessage", {
        id,
        fileName: f.name,
        fileType: f.type,
        fileData: dataUrl,
        roomCode, // ✅ real room
        senderId: socketRef.current.id,
      });
    };
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  const onType = () => {
    if (!socketRef.current || !roomCode) return;
    socketRef.current.emit("typing", { roomCode }); // ✅ use current room
  };

  // ===== Search =====
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
            <div key={m.id} className={`row ${m.self ? "me" : "you"}`} ref={(el) => (messageRefs.current[m.id] = el)}>
              <div className="msg-wrap" style={{ position: "relative" }}>
                <div className="bubble" dangerouslySetInnerHTML={{ __html: m.html }} />
                <div className="meta">
                  <span className="time">{m.time}</span>
                  {m.self && (
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
          --bg: #0f1a25;
          --panel: #0b1420;
          --header-1: #ff5fa2;
          --header-2: #ff7ec7;
          --accent: #ff4fa0;
          --accent-2: #ffd7ec;
          --text: #1f2330;
          --muted: #7f8aa3;
          --bubble-me: #ffe6f4;
          --bubble-me-b: #ffb9dc;
          --bubble-you: #eef3f7;
          --bubble-you-b: #dfe7ef;
        }
        html,
        body {
          background: #0b1220;
        }
        .app {
          position: relative;
          display: flex;
          flex-direction: column;
          height: 100svh;
          max-width: 900px;
          margin: 0 auto;
          background: var(--panel);
        }

        .header {
          position: sticky;
          top: 0;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.6rem;
          padding: 0.6rem 0.8rem;
          background: linear-gradient(90deg, var(--header-1), var(--header-2));
          color: #fff;
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.16);
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
          border-radius: 10px;
          padding: 0.35rem 0.5rem;
          cursor: pointer;
          color: #fff;
        }
        .avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid rgba(255, 255, 255, 0.55);
          background: #fff;
        }
        .partner .name {
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .status {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.78rem;
          opacity: 0.95;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #a7ffb2;
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35) inset;
        }
        .header-right {
          position: relative;
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }
        .icon-btn {
          border: none;
          background: rgba(255, 255, 255, 0.18);
          border-radius: 10px;
          padding: 0.45rem;
          cursor: pointer;
          color: #fff;
        }

        .search-area {
          position: relative;
        }
        .search-input {
          width: 220px;
          background: #0e1722;
          color: #e9eef6;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          padding: 0.4rem 0.6rem;
          margin-right: 0.35rem;
        }

        .menu {
          position: absolute;
          right: 0;
          top: 120%;
          background: #0e1722;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 0.35rem;
          min-width: 160px;
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
          color: #e9eef6;
          padding: 0.5rem 0.6rem;
          border-radius: 8px;
          cursor: pointer;
        }
        .menu-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .sep {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 0.35rem 0;
        }

        .chat {
          flex: 1;
          overflow-y: auto;
          padding: 18px;
          background: linear-gradient(180deg, #0f1a25 0, #0b1420 100%);
        }
        .day-sep {
          text-align: center;
          color: #cbd2e1;
          font-size: 0.78rem;
          margin: 8px 0 16px;
        }
        .day-sep span {
          background: rgba(255, 255, 255, 0.06);
          padding: 0.25rem 0.6rem;
          border-radius: 12px;
        }

        .row {
          display: flex;
          margin: 6px 0;
        }
        .row.me {
          justify-content: flex-end;
        }
        .bubble {
          max-width: 74%;
          background: #fff;
          border: 1px solid #eee;
          padding: 0.55rem 0.7rem 0.6rem;
          border-radius: 14px;
          line-height: 1.28;
          word-wrap: break-word;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
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
          max-width: 220px;
          border-radius: 10px;
          display: block;
        }
        .bubble :global(video) {
          max-width: 220px;
          border-radius: 10px;
          display: block;
        }
        .meta {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          margin-top: 0.28rem;
          font-size: 0.72rem;
          color: #7f8aa3;
        }
        .ticks {
          font-size: 0.9rem;
          line-height: 1;
        }
        .ticks.seen {
          color: #4ea3ff;
        }

        .inputbar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 0.7rem;
          background: #0e1722;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        .tool {
          border: none;
          background: transparent;
          cursor: pointer;
          display: grid;
          place-items: center;
          border-radius: 50%;
          width: 34px;
          height: 34px;
          color: #e9eef6;
        }
        .msg-field {
          flex: 1;
          background: #121d2a;
          color: #e9eef6;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 22px;
          padding: 0.55rem 0.75rem;
          outline: none;
        }
        .msg-field::placeholder {
          color: #93a0b8;
        }
        .send {
          background: linear-gradient(135deg, var(--accent), #ff9fd0);
          color: #071320;
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          cursor: pointer;
          box-shadow: 0 6px 18px rgba(255, 79, 160, 0.35);
        }

        .emoji-pop {
          position: absolute;
          bottom: 46px;
          left: 0;
          background: #0e1722;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          padding: 0.35rem;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 0.25rem;
        }
        .emoji-item {
          border: none;
          background: transparent;
          font-size: 1.1rem;
          cursor: pointer;
          padding: 0.2rem;
          border-radius: 8px;
        }
        .emoji-item:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        @media (max-width: 640px) {
          .bubble {
            max-width: 82%;
          }
          .avatar {
            width: 34px;
            height: 34px;
          }
          .search-input {
            width: 160px;
          }
        }
      `}</style>
    </>
  );
}
