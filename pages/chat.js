// pages/chat.js
import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import io from "socket.io-client";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const IMAGE_RESIZE_THRESHOLD = 700 * 1024; // 700KB - images above this will be resized client-side

// Helpers
const timeNow = () => {
  const d = new Date();
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m} ${d.getHours() >= 12 ? "PM" : "AM"}`;
};
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const escapeHtml = (s = "") =>
  s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
const linkify = (text = "") =>
  text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
const stripHtml = (s = "") => s.replace(/<[^>]*>/g, "");

// Resize image client-side to avoid massive base64 payloads
function resizeImageFile(file, maxWidth = 1200, quality = 0.78) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return resolve(null);
    const reader = new FileReader();
    reader.onerror = (e) => reject(e);
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxWidth / img.naturalWidth);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.naturalWidth * ratio);
        canvas.height = Math.round(img.naturalHeight * ratio);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // export as jpeg or original type if png (but jpeg compresses more)
        const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
        const dataUrl = canvas.toDataURL(mime, quality);
        resolve(dataUrl);
      };
      img.onerror = (e) => reject(e);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function ChatPage() {
  // UI & state
  const [msgs, setMsgs] = useState([]); // {id, self, kind, html, time, status}
  const [partnerName, setPartnerName] = useState("Romantic Stranger");
  const [partnerAvatarSrc, setPartnerAvatarSrc] = useState("/partner-avatar.png");
  const [roomCode, setRoomCode] = useState(null);
  const [typing, setTyping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  // Theme
  const [bgColor, setBgColor] = useState("#ffe6f0"); // romantic pink default
  const [textColor, setTextColor] = useState("#000"); // auto-adjusted

  // Input
  const [draft, setDraft] = useState("");

  // Modal
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  // refs
  const socketRef = useRef(null);
  const msgRef = useRef(null);
  const fileRef = useRef(null);
  const listRef = useRef(null);
  const messageRefs = useRef({});

  // compute contrast (simple luminance)
  const computeTextColor = (hex) => {
    if (!hex) return "#000";
    const c = hex.replace("#", "");
    if (c.length !== 6) return "#000";
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 150 ? "#000" : "#fff";
  };

  // init socket
  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ["websocket"], autoConnect: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      // join text queue
      socket.emit("lookingForPartner", { type: "text" });
    });

    socket.on("partnerFound", ({ roomCode: rc, partner }) => {
      if (!rc) return;
      setRoomCode(rc);
      setPartnerName(partner?.name || "Romantic Stranger");
      setPartnerAvatarSrc(partner?.avatar || "/partner-avatar.png");
      // optional joinRoom
      try {
        socket.emit("joinRoom", { roomCode: rc });
      } catch {}
      // system message
      pushSystemMsg(`You are connected with ${escapeHtml(partner?.name || "Romantic Stranger")}.`);
    });

    socket.on("message", (msg) => {
      if (!msg || !msg.id) return;
      setMsgs((prev) => {
        // dedupe by id - avoids double display for optimistic messages
        if (prev.some((x) => x.id === msg.id)) return prev;
        return [
          ...prev,
          {
            id: msg.id,
            self: socket.id === msg.senderId,
            kind: "text",
            html: linkify(escapeHtml(msg.text || "")),
            time: timeNow(),
          },
        ];
      });
      scrollToBottom();
    });

    socket.on("fileMessage", (msg) => {
      if (!msg || !msg.id) return;
      setMsgs((prev) => {
        if (prev.some((x) => x.id === msg.id)) return prev;
        const t = (msg.fileType || "").toLowerCase();
        let inner = "";
        if (t.startsWith("image/")) inner = `<a href="${msg.fileData}" target="_blank" rel="noopener"><img src="${msg.fileData}" class="chat-img"/></a>`;
        else if (t.startsWith("video/")) inner = `<video controls class="chat-vid"><source src="${msg.fileData}" type="${msg.fileType}"></video>`;
        else inner = `<a href="${msg.fileData}" download="${escapeHtml(msg.fileName || "file")}">${escapeHtml(msg.fileName || "file")}</a>`;
        return [...prev, { id: msg.id, self: socket.id === msg.senderId, kind: "file", html: inner, time: timeNow() }];
      });
      scrollToBottom();
    });

    socket.on("partnerTyping", () => {
      setTyping(true);
      clearTimeout(socketRef.current?._typingTimer);
      socketRef.current._typing_timer = setTimeout(() => setTyping(false), 1400);
    });

    // important: DO NOT auto-disconnect user when a file arrives. Show modal and let user confirm.
    socket.on("partnerDisconnected", () => {
      // push system message and show modal
      pushSystemMsg("Your partner has been disconnected.");
      setShowDisconnectModal(true);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connect error:", err?.message || err);
      pushSystemMsg("⚠️ Connection problem. Trying reconnect...");
    });

    socket.on("disconnect", (reason) => {
      pushSystemMsg(`Disconnected: ${String(reason)}`);
    });

    return () => {
      try {
        socket.off();
        socket.disconnect();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // helpers to update msgs
  const pushSystemMsg = (text) => {
    setMsgs((p) => [
      ...p,
      { id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, self: false, kind: "system", html: escapeHtml(text), time: timeNow() },
    ]);
    scrollToBottom();
  };

  const scrollToBottom = () =>
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });

  // send text
  const sendText = () => {
    if (!roomCode || !socketRef.current) return;
    const text = (draft || "").trim();
    if (!text) return;
    const id = genId();

    // optimistic append
    setMsgs((p) => [...p, { id, self: true, kind: "text", html: linkify(escapeHtml(text)), time: timeNow(), status: "sent" }]);
    scrollToBottom();

    // emit with try/catch
    try {
      socketRef.current.emit("message", { id, text, roomCode, senderId: socketRef.current.id });
    } catch (e) {
      // mark failed locally
      setMsgs((prev) => prev.map((m) => (m.id === id ? { ...m, status: "failed" } : m)));
      console.error("emit message error:", e);
      pushSystemMsg("⚠️ Failed to send message.");
    }

    setDraft("");
    if (msgRef.current) msgRef.current.focus();
  };

  // send file with resize for large images
  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !socketRef.current || !roomCode) return;

    // image resize to avoid large payloads
    let fileData = null;
    try {
      if (f.type.startsWith("image/") && f.size > IMAGE_RESIZE_THRESHOLD) {
        const resized = await resizeImageFile(f, 1200, 0.78).catch(() => null);
        if (resized) {
          // convert dataURL size check
          const approxBytes = Math.round((resized.length * 3) / 4); // rough estimate
          if (approxBytes > MAX_FILE_BYTES) {
            alert("⚠️ File still too large after compression. Try a smaller image or crop it.");
            return;
          }
          fileData = resized;
        }
      }
      if (!fileData) {
        // fallback: read original file but ensure it's within limit
        if (f.size > MAX_FILE_BYTES) {
          alert("⚠️ File too large — max 15 MB allowed.");
          return;
        }
        // read as dataURL
        fileData = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsDataURL(f);
        });
      }
    } catch (err) {
      console.error("file processing error", err);
      alert("⚠️ Error processing file.");
      return;
    }

    const id = genId();
    // optimistic UI
    const mime = f.type.toLowerCase();
    let inner = "";
    if (mime.startsWith("image/")) inner = `<a href="${fileData}" target="_blank" rel="noopener"><img src="${fileData}" class="chat-img"/></a>`;
    else if (mime.startsWith("video/")) inner = `<video controls class="chat-vid"><source src="${fileData}" type="${f.type}"></video>`;
    else inner = `<a href="${fileData}" download="${escapeHtml(f.name)}">${escapeHtml(f.name)}</a>`;

    setMsgs((p) => [...p, { id, self: true, kind: "file", html: inner, time: timeNow(), status: "sent" }]);
    scrollToBottom();

    // emit safely
    try {
      socketRef.current.emit("fileMessage", {
        id,
        fileName: f.name,
        fileType: f.type,
        fileData,
        roomCode,
        senderId: socketRef.current.id,
      });
    } catch (err) {
      console.error("file emit error", err);
      setMsgs((prev) => prev.map((m) => (m.id === id ? { ...m, status: "failed" } : m)));
      pushSystemMsg("⚠️ Failed to send file.");
    }
  };

  // typing
  const onType = (val) => {
    setDraft(val);
    if (!socketRef.current || !roomCode) return;
    try {
      socketRef.current.emit("typing", { roomCode });
    } catch {}
  };

  // emoji insert
  const insertEmoji = (emoji) => {
    const cur = msgRef.current;
    if (!cur) return;
    const start = cur.selectionStart ?? cur.value.length;
    const end = cur.selectionEnd ?? cur.value.length;
    const before = cur.value.slice(0, start);
    const after = cur.value.slice(end);
    const newVal = before + emoji + after;
    setDraft(newVal);
    requestAnimationFrame(() => {
      cur.focus();
      const pos = start + emoji.length;
      cur.setSelectionRange(pos, pos);
    });
    setEmojiOpen(false);
  };

  // handler when user confirms partner disconnect modal
  const confirmDisconnect = () => {
    try {
      socketRef.current?.disconnect();
    } catch {}
    setShowDisconnectModal(false);
    window.location.href = "/connect";
  };

  // color picker handler
  const onColorChange = (hex) => {
    setBgColor(hex);
    setTextColor(computeTextColor(hex));
  };
  const computeTextColor = (hex) => {
    return computeTextColorLocal(hex);
  };

  // small local wrapper (avoid name clash)
  function computeTextColorLocal(hex) {
    if (!hex) return "#000";
    const c = hex.replace("#", "");
    if (c.length !== 6) return "#000";
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 150 ? "#000" : "#fff";
  }

  // UI state for send button active
  const sendActive = draft.trim().length > 0 && !!roomCode;

  return (
    <>
      <Head>
        <title>Milan — Romantic Chat</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="app" style={{ background: bgColor, color: textColor }}>
        <header className="header">
          <div className="header-left">
            <button className="back-btn" onClick={() => (window.location.href = "/connect")}>⟵</button>
            <img className="avatar" src={partnerAvatarSrc} alt="dp" />
            <div className="partner">
              <div className="name">{partnerName}</div>
              <div className="status">{typing ? "typing…" : roomCode ? "online" : "searching…"}</div>
            </div>
          </div>

          <div className="header-right">
            {/* hidden native color input — label acts as picker icon next to 3-dot */}
            <input id="theme-picker" type="color" style={{ display: "none" }} onChange={(e) => onColorChange(e.target.value)} />
            <label htmlFor="theme-picker" className="picker-btn" title="Change chat background">🎨</label>

            <button className="icon-btn" onClick={() => setMenuOpen((s) => !s)}>⋮</button>
            {menuOpen && (
              <div className="menu">
                <button
                  onClick={() => {
                    try {
                      socketRef.current?.emit("disconnectByUser");
                    } catch {}
                    confirmDisconnect();
                  }}
                >
                  🔌 Disconnect
                </button>
                <div className="sep" />
                <button onClick={() => alert("🚩 Report submitted. Thank you!")}>🚩 Report</button>
              </div>
            )}
          </div>
        </header>

        <main className="chat" ref={listRef}>
          <div className="day-sep"><span>Today</span></div>

          {msgs.map((m) => (
            <div
              key={m.id}
              className={`row ${m.self ? "me" : m.kind === "system" ? "system-row" : "you"}`}
              ref={(el) => (messageRefs.current[m.id] = el)}
            >
              <div className="msg-wrap">
                <div
                  className={`bubble ${m.kind === "system" ? "system-bubble" : ""}`}
                  style={{
                    background: m.kind === "system" ? "transparent" : m.self ? "rgba(255, 182, 193, 0.9)" : "rgba(255,255,255,0.9)",
                    color: m.kind === "system" ? textColor : m.self ? "#000" : "#000",
                  }}
                  dangerouslySetInnerHTML={{ __html: m.html }}
                />
                <div className="meta">
                  <span className="time">{m.time}</span>
                </div>
              </div>
            </div>
          ))}
        </main>

        <footer className="inputbar">
          <input ref={fileRef} type="file" hidden onChange={handleFile} />
          <button className="tool attach" title="Attach" onClick={() => fileRef.current?.click()}>📎</button>

          <div className="emoji-wrap">
            <button className="tool emoji-btn" onClick={() => setEmojiOpen((s) => !s)}>😊</button>
            {emojiOpen && (
              <div className="emoji-pop">
                {["😊", "❤️", "😂", "😍", "😘", "👍", "🔥", "😎", "🤗", "🥰"].map((e) => (
                  <button key={e} className="emoji-item" onClick={() => insertEmoji(e)}>{e}</button>
                ))}
              </div>
            )}
          </div>

          <input
            ref={msgRef}
            className="msg-field"
            type="text"
            placeholder={roomCode ? "Type a message…" : "Finding a partner…"}
            value={draft}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendText(); }}
            disabled={!roomCode}
            style={{ color: textColor }}
          />

          <button
            className={`send ${sendActive ? "active" : "inactive"}`}
            onClick={sendText}
            aria-label="Send"
            title="Send"
          >
            ➤
          </button>
        </footer>
      </div>

      {/* disconnect modal (sweet pink) */}
      {showDisconnectModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>💔 Your partner has been disconnected</h3>
            <p>Click OK to return to search.</p>
            <button className="modal-ok" onClick={confirmDisconnect}>OK</button>
          </div>
        </div>
      )}

      <style jsx>{`
        :root{
          --header-1: #ff66a3;
          --header-2: #ff85b8;
          --accent1: #ff4fa0;
          --accent2: #ff9fd0;
        }
        .app { height:100vh; display:flex; flex-direction:column; transition: background 0.25s, color 0.25s; }
        .header { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background: linear-gradient(90deg,var(--header-1),var(--header-2)); color:#fff; }
        .header-left { display:flex; align-items:center; gap:12px; }
        .back-btn { background: rgba(255,255,255,0.18); border:none; color:#071320; padding:8px 10px; border-radius:10px; cursor:pointer; font-weight:700; }
        .avatar { width:42px; height:42px; border-radius:50%; object-fit:cover; border:2px solid rgba(255,255,255,0.6); background:#fff; }
        .partner .name { font-weight:800; color:white; }
        .status { font-size:0.88rem; color:rgba(255,224,239,0.9); }
        .header-right { display:flex; align-items:center; gap:8px; position:relative; }
        .picker-btn { background:none; border:none; font-size:1.2rem; cursor:pointer; margin-right:6px; }
        .icon-btn { background: rgba(255,255,255,0.12); border:none; padding:8px; border-radius:10px; cursor:pointer; font-size:1.05rem; }
        .menu { position:absolute; right:6px; top:44px; background:#fff; color:#000; padding:8px; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,0.12); }
        .menu button { background:none; border:none; padding:8px 12px; cursor:pointer; width:100%; text-align:left; }

        .chat { flex:1; overflow:auto; padding:18px; background: transparent; }
        .day-sep { text-align:center; margin-bottom:10px; }
        .row { margin-bottom:10px; display:flex; }
        .row.me { justify-content:flex-end; }
        .row.system-row { justify-content:center; }
        .msg-wrap { max-width:78%; }
        .bubble { padding:10px 14px; border-radius:14px; box-shadow:0 6px 18px rgba(0,0,0,0.08); font-size:1rem; }
        .system-bubble { background: transparent; font-weight:600; opacity:0.95; }
        .meta { margin-top:6px; font-size:0.75rem; color:rgba(0,0,0,0.45); }

        /* Input area */
        .inputbar { display:flex; gap:8px; align-items:center; padding:12px; border-top: 1px solid rgba(0,0,0,0.06); background: rgba(255,255,255,0.02); }
        .tool { width:46px; height:46px; border-radius:10px; display:grid; place-items:center; cursor:pointer; border:none; background: rgba(255,255,255,0.03); font-size:1.18rem; }
        .attach { font-size:1.2rem; }
        .emoji-wrap { position:relative; }
        .emoji-pop { position:absolute; bottom:56px; left:0; background: rgba(255,255,255,0.96); border-radius:10px; padding:8px; display:grid; grid-template-columns:repeat(5,1fr); gap:6px; box-shadow:0 10px 30px rgba(0,0,0,0.12); }
        .emoji-item { border:none; background:transparent; font-size:1.3rem; cursor:pointer; padding:6px; border-radius:8px; }
        .msg-field { flex:1; padding:12px 14px; border-radius:22px; border:none; outline:none; font-size:1rem; background: rgba(255,255,255,0.85); }
        .send { width:48px; height:48px; border-radius:50%; border:none; display:grid; place-items:center; font-size:1.05rem; cursor:pointer; box-shadow:0 8px 24px rgba(0,0,0,0.12); }
        .send.inactive { background:#111; color:#fff; opacity:0.6; cursor:not-allowed; }
        .send.active { background: linear-gradient(135deg,var(--accent1),var(--accent2)); color:#fff; opacity:1; }

        /* images & videos */
        .chat-img { max-width:260px; border-radius:10px; display:block; }
        .chat-vid { max-width:260px; border-radius:10px; display:block; }

        /* modal */
        .modal-backdrop { position:fixed; inset:0; background: rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; z-index:50; }
        .modal { background:#ffe6f0; padding:22px; border-radius:14px; text-align:center; box-shadow:0 18px 50px rgba(0,0,0,0.25); color:#000; max-width:360px; }
        .modal h3 { margin-bottom:8px; }
        .modal-ok { margin-top:12px; padding:10px 18px; border-radius:8px; border:none; background: linear-gradient(135deg,var(--accent1),var(--accent2)); color:white; cursor:pointer; }

        @media (max-width:640px) {
          .bubble { max-width:86%; }
          .chat-img, .chat-vid { max-width:200px; }
          .picker-btn { font-size:1rem; }
          .tool { width:40px; height:40px; }
          .send { width:44px; height:44px; }
        }
      `}</style>
    </>
  );
}
