// pages/chat.js
import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import io from "socket.io-client";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com";

// Notes:
// - UI layout/style mirrors chat.html (romantic header/menu/welcome/footer).
// - Logic comes from your React version: sockets, typing, reactions, file share.
// - CSS expected at: /styles/chat.css
// - Avatar at: /partner-avatar.png

export default function ChatPage() {
  // ---- State ----
  const [theme, setTheme] = useState(
    typeof window !== "undefined"
      ? localStorage.getItem("milan-theme") || "theme-romantic"
      : "theme-romantic"
  );
  const [partnerName, setPartnerName] = useState("Partner");
  const [typing, setTyping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [welcome, setWelcome] = useState(true);

  // ---- Refs ----
  const socketRef = useRef(null);
  const msgRef = useRef(null);
  const fileRef = useRef(null);
  const listRef = useRef(null);

  // Message: {id, self, html, type:'text'|'file', reactions?:{emoji:count}}
  const [msgs, setMsgs] = useState([]);

  // ---- Helpers ----
  const timeNow = () => {
    const d = new Date();
    const h = d.getHours() % 12 || 12;
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${h}:${m} ${d.getHours() >= 12 ? "PM" : "AM"}`;
  };

  const genId = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const escapeHtml = (s = "") =>
    s.replace(/[&<>"']/g, (m) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });

  const linkify = (text = "") =>
    text.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );

  const addReaction = (mid, emoji) => {
    setMsgs((prev) =>
      prev.map((m) =>
        m.id !== mid
          ? m
          : { ...m, reactions: { ...(m.reactions || {}), [emoji]: (m.reactions?.[emoji] || 0) + 1 } }
      )
    );
  };

  const scrollToBottom = () =>
    setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, 0);

  // ---- Theme on <body> ----
  useEffect(() => {
    document.body.classList.remove("theme-light", "theme-dark", "theme-romantic");
    document.body.classList.add(theme);
    if (typeof window !== "undefined") localStorage.setItem("milan-theme", theme);
  }, [theme]);

  // ---- Socket lifecycle ----
  useEffect(() => {
    // pull partner/session data prepared by connect page
    let partnerData = null;
    try {
      partnerData = JSON.parse(sessionStorage.getItem("partnerData") || "null");
    } catch {}
    if (!partnerData || !partnerData.roomCode) {
      // fallback for direct visit
      partnerData = {
        roomCode: "DEMO-" + Math.random().toString(36).slice(2, 6),
        name: "Partner",
      };
      sessionStorage.setItem("partnerData", JSON.stringify(partnerData));
    }
    setPartnerName(partnerData.name || "Partner");

    const socket = io(BACKEND_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.emit("userInfo", { name: partnerData.name, avatar: partnerData.avatar });
    socket.emit("joinRoom", { roomCode: partnerData.roomCode });

    // incoming text
    socket.on("message", (msg) => {
      const isSelf = socket.id === msg.senderId;
      setMsgs((p) => [
        ...p,
        {
          id: msg.id || genId(),
          self: isSelf,
          html: `<strong>${isSelf ? "You" : partnerData.name}:</strong> ${linkify(
            escapeHtml(msg.text)
          )}<div class="meta">${timeNow()}</div>`,
          type: "text",
        },
      ]);
      scrollToBottom();
    });

    // incoming file
    socket.on("fileMessage", (msg) => {
      const isSelf = socket.id === msg.senderId;
      let inner = `<strong>${isSelf ? "You" : partnerData.name}:</strong><br/>`;
      const t = (msg.fileType || "").toLowerCase();
      if (t.startsWith("image/")) {
        inner += `<a href="${msg.fileData}" target="_blank"><img src="${msg.fileData}" /></a>`;
      } else if (t.startsWith("video/")) {
        inner += `<video controls style="max-width:220px;border-radius:10px">
                    <source src="${msg.fileData}" type="${msg.fileType}">
                  </video>`;
      } else {
        inner += `<a class="file-link" download="${escapeHtml(msg.fileName || "file")}"
                   href="${msg.fileData}">${escapeHtml(msg.fileName || "file")}</a>`;
      }
      inner += `<div class="meta">${timeNow()}</div>`;
      setMsgs((p) => [...p, { id: msg.id || genId(), self: isSelf, html: inner, type: "file" }]);
      scrollToBottom();
    });

    // typing indicator
    socket.on("partnerTyping", () => {
      setTyping(true);
      clearTimeout(socketRef.current?._typingTimer);
      socketRef.current._typingTimer = setTimeout(() => setTyping(false), 1500);
    });

    // reaction sync
    socket.on("reaction", ({ messageId, emoji }) => addReaction(messageId, emoji));

    // partner left
    socket.on("partnerDisconnected", () => {
      alert("💔 Partner disconnected.");
      window.location.href = "/";
    });

    // hide welcome overlay after a bit
    const w = setTimeout(() => setWelcome(false), 3000);

    return () => {
      clearTimeout(w);
      try {
        socket.disconnect();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Actions ----
  const sendText = () => {
    const val = (msgRef.current?.value || "").trim();
    if (!val) return;

    const id = genId();
    // optimistic bubble
    setMsgs((p) => [
      ...p,
      {
        id,
        self: true,
        html: `<strong>You:</strong> ${linkify(escapeHtml(val))}<div class="meta">${timeNow()}</div>`,
        type: "text",
      },
    ]);
    scrollToBottom();

    const pd = JSON.parse(sessionStorage.getItem("partnerData") || "{}");
    socketRef.current.emit("message", {
      id,
      text: val,
      roomCode: pd.roomCode,
      senderId: socketRef.current.id,
    });

    msgRef.current.value = "";
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const reader = new FileReader();
    const id = genId();

    reader.onload = () => {
      const dataUrl = reader.result;
      const pd = JSON.parse(sessionStorage.getItem("partnerData") || "{}");

      // optimistic preview
      let inner = `<strong>You:</strong><br/>`;
      if (f.type.startsWith("image/")) {
        inner += `<a href="${dataUrl}" target="_blank"><img src="${dataUrl}" /></a>`;
      } else if (f.type.startsWith("video/")) {
        inner += `<video controls style="max-width:220px;border-radius:10px">
                    <source src="${dataUrl}" type="${f.type}">
                  </video>`;
      } else {
        inner += `<a class="file-link" download="${escapeHtml(f.name)}"
                   href="${dataUrl}">${escapeHtml(f.name)}</a>`;
      }
      inner += `<div class="meta">${timeNow()}</div>`;
      setMsgs((p) => [...p, { id, self: true, html: inner, type: "file" }]);
      scrollToBottom();

      // send to partner
      socketRef.current.emit("fileMessage", {
        id,
        fileName: f.name,
        fileType: f.type,
        fileData: dataUrl,
        roomCode: pd.roomCode,
        senderId: socketRef.current.id,
      });
    };

    reader.readAsDataURL(f);
    e.target.value = ""; // reset input
  };

  const onType = () => {
    const pd = JSON.parse(sessionStorage.getItem("partnerData") || "{}");
    socketRef.current.emit("typing", { roomCode: pd.roomCode });
  };

  const sendReaction = (mid, emoji) => {
    addReaction(mid, emoji);
    const pd = JSON.parse(sessionStorage.getItem("partnerData") || "{}");
    socketRef.current.emit("reaction", { roomCode: pd.roomCode, messageId: mid, emoji });
  };

  // ---- UI ----
  useEffect(() => {
    // close menu on outside click
    const handler = (e) => {
      if (!e.target.closest(".header-right")) setMenuOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <>
      <Head>
        <title>Milan – Romantic Chat</title>
        <link rel="stylesheet" href="/styles/chat.css" />
      </Head>

      <div className="chat-container">
        {/* Header */}
        <header className="chat-header">
          <div className="header-left">
            <img id="partnerAvatar" src="/partner-avatar.png" alt="DP" />
            <div className="partner-info">
              <span id="partnerName">{partnerName}</span>
              <span
                id="typingHeader"
                className={`typing-indicator-header ${typing ? "" : "hidden"}`}
              >
                typing…
              </span>
            </div>
          </div>

          <div className="header-right">
            <button
              id="menuBtn"
              className="icon-btn"
              aria-label="More"
              onClick={() => setMenuOpen((s) => !s)}
            >
              ⋮
            </button>
            <div id="menuDropdown" className={`menu ${menuOpen ? "" : "hidden"}`}>
              <button
                id="reportBtn"
                className="menu-item"
                onClick={() => alert("🚩 Report submitted. Thank you!")}
              >
                🚩 Report
              </button>
              <button
                id="disconnectBtn"
                className="menu-item"
                onClick={() => {
                  try {
                    socketRef.current.emit("disconnectByUser");
                    socketRef.current.disconnect();
                  } catch {}
                  window.location.href = "/";
                }}
              >
                🔌 Disconnect
              </button>
              <div className="menu-sep"></div>
              <div className="menu-group">
                <div className="menu-title">Theme</div>
                <button className="menu-item theme-btn" onClick={() => setTheme("theme-light")}>
                  Light
                </button>
                <button className="menu-item theme-btn" onClick={() => setTheme("theme-dark")}>
                  Dark
                </button>
                <button className="menu-item theme-btn" onClick={() => setTheme("theme-romantic")}>
                  Romantic
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Welcome */}
        <div id="welcomeMessage" className={`welcome-message ${welcome ? "" : "hidden"}`}>
          You’re connected to a Romantic Stranger 💌
        </div>

        {/* Messages */}
        <main id="messages" className="chat-messages" ref={listRef}>
          {msgs.map((m) => (
            <MsgBubble key={m.id} m={m} onReact={sendReaction} />
          ))}
        </main>

        {/* Input */}
        <footer className="chat-input">
          <input id="fileInput" type="file" hidden ref={fileRef} onChange={handleFile} />
          <button id="fileBtn" className="icon-btn" title="Attach" onClick={() => fileRef.current?.click()}>
            📎
          </button>
          <input
            id="msgInput"
            className="msg-field"
            type="text"
            placeholder="Type a message…"
            ref={msgRef}
            onChange={onType}
            onKeyDown={(e) => e.key === "Enter" && sendText()}
          />
          <button id="sendBtn" className="send-btn" title="Send" onClick={sendText}>
            ➤
          </button>
        </footer>
      </div>
    </>
  );
}

/** Message bubble with quick reactions */
function MsgBubble({ m, onReact }) {
  const [open, setOpen] = useState(false);
  const bar = ["❤️", "😂", "🔥", "👍", "😍", "🤗"];

  // close picker on outside click
  useEffect(() => {
    const h = (e) => {
      if (!e.target.closest(`[data-mid="${m.id}"]`)) setOpen(false);
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [m.id]);

  return (
    <div className={`message ${m.self ? "me" : "you"}`} data-mid={m.id}>
      <div className="bubble" dangerouslySetInnerHTML={{ __html: m.html }} />
      <button className="react-launch" onClick={() => setOpen((s) => !s)}>😊</button>

      {open && (
        <div className="reaction-bar">
          {bar.map((e) => (
            <button key={e} onClick={() => onReact(m.id, e)}>
              {e}
            </button>
          ))}
        </div>
      )}

      {m.reactions && Object.keys(m.reactions).length > 0 && (
        <div className="reaction-pill">
          {Object.entries(m.reactions).map(([e, c]) => (
            <span key={e}>
              {e} {c > 1 ? c : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
