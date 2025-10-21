// pages/chat.js
import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import io from "socket.io-client";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com";

export default function ChatPage() {
  const [theme, setTheme] = useState(
    typeof window !== "undefined"
      ? localStorage.getItem("milan-theme") || "theme-romantic"
      : "theme-romantic"
  );
  const [partnerName, setPartnerName] = useState("Partner");
  const [typing, setTyping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [welcome, setWelcome] = useState(true);

  const socketRef = useRef(null);
  const msgRef = useRef(null);
  const fileRef = useRef(null);
  const listRef = useRef(null);

  // immutable message shape: {id, self, html, type:'text'|'file'}
  const [msgs, setMsgs] = useState([]);

  // --- helpers
  const timeNow = () => {
    const d = new Date();
    const h = d.getHours() % 12 || 12;
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${h}:${m} ${d.getHours() >= 12 ? "PM" : "AM"}`;
  };
  const genId = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const linkify = (text) =>
    text.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );

  // add/update reaction counter on a message
  const addReaction = (mid, emoji) => {
    setMsgs((prev) =>
      prev.map((m) => {
        if (m.id !== mid) return m;
        const counts = { ...(m.reactions || {}) };
        counts[emoji] = (counts[emoji] || 0) + 1;
        return { ...m, reactions: counts };
      })
    );
  };

  useEffect(() => {
    document.body.classList.remove("theme-light", "theme-dark", "theme-romantic");
    document.body.classList.add(theme);
    if (typeof window !== "undefined") localStorage.setItem("milan-theme", theme);
  }, [theme]);

  useEffect(() => {
    // read partner/session (whatever you already store)
    let partnerData = null;
    try {
      partnerData = JSON.parse(sessionStorage.getItem("partnerData") || "null");
    } catch {}
    if (!partnerData || !partnerData.roomCode) {
      // fallback: allow chat page to still load for testing
      partnerData = { roomCode: "DEMO-" + Math.random().toString(36).slice(2, 6), name: "Partner" };
      sessionStorage.setItem("partnerData", JSON.stringify(partnerData));
    }
    setPartnerName(partnerData.name || "Partner");

    const socket = io(BACKEND_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.emit("userInfo", { name: partnerData.name, avatar: partnerData.avatar });
    socket.emit("joinRoom", { roomCode: partnerData.roomCode });

    // incoming text
    socket.on("message", (msg) => {
      setMsgs((p) => [
        ...p,
        {
          id: msg.id || genId(),
          self: socket.id === msg.senderId,
          html: `<strong>${socket.id === msg.senderId ? "You" : partnerData.name}:</strong> ${linkify(
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
      if ((msg.fileType || "").startsWith("image/")) {
        inner += `<a href="${msg.fileData}" target="_blank"><img src="${msg.fileData}" /></a>`;
      } else if ((msg.fileType || "").startsWith("video/")) {
        inner += `<video controls style="max-width:220px;border-radius:10px">
                  <source src="${msg.fileData}" type="${msg.fileType}">
                </video>`;
      } else {
        inner += `<a class="file-link" download="${escapeHtml(
          msg.fileName || "file"
        )}" href="${msg.fileData}">${escapeHtml(msg.fileName || "file")}</a>`;
      }
      inner += `<div class="meta">${timeNow()}</div>`;
      setMsgs((p) => [
        ...p,
        { id: msg.id || genId(), self: isSelf, html: inner, type: "file" },
      ]);
      scrollToBottom();
    });

    // typing
    socket.on("partnerTyping", () => {
      setTyping(true);
      clearTimeout(socketRef.current?._t);
      socketRef.current._t = setTimeout(() => setTyping(false), 1500);
    });

    // reaction sync
    socket.on("reaction", ({ messageId, emoji }) => {
      addReaction(messageId, emoji);
    });

    socket.on("partnerDisconnected", () => {
      alert("💔 Partner disconnected.");
      window.location.href = "/";
    });

    // welcome overlay off
    setTimeout(() => setWelcome(false), 3000);

    return () => {
      try { socket.disconnect(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendText = () => {
    const val = (msgRef.current?.value || "").trim();
    if (!val) return;
    const id = genId();

    // optimistic
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

    // emit
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
        inner += `<a class="file-link" download="${escapeHtml(
          f.name
        )}" href="${dataUrl}">${escapeHtml(f.name)}</a>`;
      }
      inner += `<div class="meta">${timeNow()}</div>`;
      setMsgs((p) => [...p, { id, self: true, html: inner, type: "file" }]);
      scrollToBottom();

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
    e.target.value = ""; // reset
  };

  const onType = () => {
    const pd = JSON.parse(sessionStorage.getItem("partnerData") || "{}");
    socketRef.current.emit("typing", { roomCode: pd.roomCode });
  };

  const sendReaction = (mid, emoji) => {
    addReaction(mid, emoji);
    const pd = JSON.parse(sessionStorage.getItem("partnerData") || "{}");
    socketRef.current.emit("reaction", {
      roomCode: pd.roomCode,
      messageId: mid,
      emoji,
    });
  };

  const scrollToBottom = () =>
    setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, 0);

  // --- UI
  return (
    <>
      <Head>
        <title>Milan – Chat</title>
        <link rel="stylesheet" href="/styles/chat.css" />
      </Head>

      <div className="chat-container">
        <header className="chat-header">
          <div className="header-left">
            <img src="/partner-avatar.png" alt="DP" />
            <div className="partner-info">
              <span>{partnerName}</span>
              <span
                className={`typing-indicator-header ${typing ? "" : "hidden"}`}
              >
                typing…
              </span>
            </div>
          </div>

          <div className="header-right">
            <button
              className="icon-btn"
              aria-label="More"
              onClick={() => setMenuOpen((s) => !s)}
            >
              ⋮
            </button>
            <div className={`menu ${menuOpen ? "" : "hidden"}`}>
              <button
                className="menu-item"
                onClick={() => alert("🚩 Reported. Thank you!")}
              >
                🚩 Report
              </button>
              <button
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
                <button
                  className="menu-item"
                  onClick={() => setTheme("theme-light")}
                >
                  Light
                </button>
                <button
                  className="menu-item"
                  onClick={() => setTheme("theme-dark")}
                >
                  Dark
                </button>
                <button
                  className="menu-item"
                  onClick={() => setTheme("theme-romantic")}
                >
                  Romantic
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className={`welcome-message ${welcome ? "" : "hidden"}`}>
          You’re connected to a Romantic Stranger 💌
        </div>

        <main id="messages" className="chat-messages" ref={listRef}>
          {msgs.map((m) => (
            <MsgBubble key={m.id} m={m} onReact={sendReaction} />
          ))}
        </main>

        <footer className="chat-input">
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={handleFile}
          />
          <button className="icon-btn" onClick={() => fileRef.current.click()}>
            📎
          </button>
          <input
            ref={msgRef}
            className="msg-field"
            type="text"
            placeholder="Type a message…"
            onChange={onType}
            onKeyDown={(e) => e.key === "Enter" && sendText()}
          />
          <button className="send-btn" onClick={sendText}>
            ➤
          </button>
        </footer>
      </div>
    </>
  );
}

/** Message component with WhatsApp-style reactions **/
function MsgBubble({ m, onReact }) {
  const [open, setOpen] = useState(false);
  const bar = ["❤️", "😂", "🔥", "👍", "😍", "🤗"];

  // close on outside click
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
      <button className="react-launch" onClick={() => setOpen((s) => !s)}>
        😊
      </button>
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

// util
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (m) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
      m
    ];
  });
}
