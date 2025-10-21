// pages/chat.js
import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import io from "socket.io-client";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const IMAGE_RESIZE_THRESHOLD = 700 * 1024; // 700KB

// ===== Helpers =====
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

// ===== Image Resize =====
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
  // ===== State =====
  const [msgs, setMsgs] = useState([]);
  const [partnerName, setPartnerName] = useState("Romantic Stranger");
  const [partnerAvatarSrc, setPartnerAvatarSrc] = useState("/partner-avatar.png");
  const [roomCode, setRoomCode] = useState(null);
  const [typing, setTyping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [bgColor, setBgColor] = useState("#ffe6f0");
  const [textColor, setTextColor] = useState("#000");
  const [draft, setDraft] = useState("");
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  const socketRef = useRef(null);
  const msgRef = useRef(null);
  const fileRef = useRef(null);
  const listRef = useRef(null);

  // ===== Contrast =====
  const computeTextColorLocal = (hex) => {
    if (!hex) return "#000";
    const c = hex.replace("#", "");
    if (c.length !== 6) return "#000";
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 150 ? "#000" : "#fff";
  };

  // ===== Socket Setup =====
  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ["websocket"], autoConnect: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("lookingForPartner", { type: "text" });
    });

    socket.on("partnerFound", ({ roomCode: rc, partner }) => {
      setRoomCode(rc);
      setPartnerName(partner?.name || "Romantic Stranger");
      setPartnerAvatarSrc(partner?.avatar || "/partner-avatar.png");
    });

    socket.on("message", (msg) => {
      if (!msg || !msg.id) return;
      setMsgs((prev) => {
        if (prev.some((x) => x.id === msg.id)) return prev;
        return [
          ...prev,
          {
            id: msg.id,
            self: socket.id === msg.senderId,
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
        if (t.startsWith("image/"))
          inner = `<a href="${msg.fileData}" target="_blank"><img src="${msg.fileData}" class="chat-img"/></a>`;
        else if (t.startsWith("video/"))
          inner = `<video controls class="chat-vid"><source src="${msg.fileData}" type="${msg.fileType}"></video>`;
        else
          inner = `<a href="${msg.fileData}" download="${msg.fileName}">${msg.fileName}</a>`;
        return [...prev, { id: msg.id, self: socket.id === msg.senderId, html: inner, time: timeNow() }];
      });
      scrollToBottom();
    });

    socket.on("partnerTyping", () => {
      setTyping(true);
      clearTimeout(socketRef.current?._typingTimer);
      socketRef.current._typingTimer = setTimeout(() => setTyping(false), 1400);
    });

    socket.on("partnerDisconnected", () => {
      setShowDisconnectModal(true);
    });

    return () => {
      socket.off();
      socket.disconnect();
    };
  }, []);

  // ===== Scroll =====
  const scrollToBottom = () =>
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });

  // ===== Send Message =====
  const sendText = () => {
    const text = draft.trim();
    if (!text || !roomCode) return;
    const id = genId();
    setMsgs((p) => [...p, { id, self: true, html: linkify(escapeHtml(text)), time: timeNow() }]);
    socketRef.current.emit("message", { id, text, roomCode, senderId: socketRef.current.id });
    setDraft("");
    scrollToBottom();
  };

  // ===== Send File =====
  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !roomCode) return;

    let fileData = null;
    try {
      if (f.type.startsWith("image/") && f.size > IMAGE_RESIZE_THRESHOLD) {
        fileData = await resizeImageFile(f);
      } else {
        if (f.size > MAX_FILE_BYTES) {
          alert("⚠️ File too large — max 15 MB allowed.");
          return;
        }
        fileData = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsDataURL(f);
        });
      }
    } catch (err) {
      alert("⚠️ Error processing file.");
      return;
    }

    const id = genId();
    const mime = f.type.toLowerCase();
    let html = "";
    if (mime.startsWith("image/"))
      html = `<a href="${fileData}" target="_blank"><img src="${fileData}" class="chat-img"/></a>`;
    else if (mime.startsWith("video/"))
      html = `<video controls class="chat-vid"><source src="${fileData}" type="${f.type}"></video>`;
    else html = `<a href="${fileData}" download="${f.name}">${f.name}</a>`;
    setMsgs((p) => [...p, { id, self: true, html, time: timeNow() }]);
    socketRef.current.emit("fileMessage", {
      id,
      fileName: f.name,
      fileType: f.type,
      fileData,
      roomCode,
      senderId: socketRef.current.id,
    });
  };

  // ===== Typing =====
  const onType = (val) => {
    setDraft(val);
    if (roomCode) socketRef.current.emit("typing", { roomCode });
  };

  // ===== Color Picker =====
  const onColorChange = (hex) => {
    setBgColor(hex);
    setTextColor(computeTextColorLocal(hex));
  };

  // ===== Disconnect =====
  const confirmDisconnect = () => {
    socketRef.current?.disconnect();
    setShowDisconnectModal(false);
    window.location.href = "/connect";
  };

  const sendActive = draft.trim().length > 0;

  // ===== UI =====
  return (
    <>
      <Head>
        <title>Milan — Romantic Chat</title>
      </Head>

      <div className="chat-container" style={{ background: bgColor, color: textColor }}>
        {/* Header */}
        <header className="chat-header">
          <div className="left">
            <button onClick={() => (window.location.href = "/connect")}>⟵</button>
            <img src={partnerAvatarSrc} alt="avatar" className="avatar" />
            <div>
              <div className="name">{partnerName}</div>
              <div className="status">{typing ? "typing…" : "online"}</div>
            </div>
          </div>
          <div className="right">
            <input id="theme-picker" type="color" hidden onChange={(e) => onColorChange(e.target.value)} />
            <label htmlFor="theme-picker" className="icon">🎨</label>
            <button className="icon" onClick={() => setMenuOpen(!menuOpen)}>⋮</button>
            {menuOpen && (
              <div className="menu">
                <button onClick={confirmDisconnect}>Disconnect</button>
              </div>
            )}
          </div>
        </header>

        {/* Chat Body */}
        <main className="chat-body" ref={listRef}>
          {msgs.map((m) => (
            <div key={m.id} className={`msg ${m.self ? "self" : "partner"}`}>
              <div
                className="bubble"
                style={{
                  background: m.self ? "#ffb3d9" : "#fff",
                  color: "#000",
                }}
                dangerouslySetInnerHTML={{ __html: m.html }}
              />
              <div className="time">{m.time}</div>
            </div>
          ))}
        </main>

        {/* Footer */}
        <footer className="chat-input">
          <input type="file" ref={fileRef} hidden onChange={handleFile} />
          <button onClick={() => fileRef.current.click()}>📎</button>
          <input
            ref={msgRef}
            placeholder="Type a message..."
            value={draft}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendText()}
            style={{ color: textColor }}
          />
          <button className={`send ${sendActive ? "active" : "inactive"}`} onClick={sendText}>
            ➤
          </button>
        </footer>
      </div>

      {/* Sweet Modal */}
      {showDisconnectModal && (
        <div className="disconnect-modal">
          <div className="modal-content">
            <h2>💔 Your partner has been disconnected</h2>
            <button onClick={confirmDisconnect}>OK</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .chat-container {
          height: 100vh;
          display: flex;
          flex-direction: column;
          transition: all 0.3s ease;
        }
        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          background: linear-gradient(90deg, #ff66a3, #ff85b8);
          color: white;
        }
        .left {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
        }
        .name {
          font-weight: 600;
        }
        .status {
          font-size: 0.85rem;
          color: #ffe0ef;
        }
        .right {
          position: relative;
        }
        .icon {
          background: none;
          border: none;
          font-size: 1.2rem;
          cursor: pointer;
          color: white;
        }
        .menu {
          position: absolute;
          right: 0;
          top: 30px;
          background: #fff;
          color: #000;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }
        .menu button {
          border: none;
          background: none;
          padding: 6px 12px;
          width: 100%;
          text-align: left;
        }
        .chat-body {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
        }
        .msg {
          margin: 6px 0;
        }
        .msg.self {
          text-align: right;
        }
        .bubble {
          display: inline-block;
          padding: 10px 14px;
          border-radius: 14px;
          max-width: 70%;
        }
        .time {
          font-size: 0.7rem;
          margin-top: 4px;
          opacity: 0.6;
        }
        .chat-input {
          display: flex;
          align-items: center;
          padding: 8px;
          border-top: 1px solid rgba(0,0,0,0.1);
          background: rgba(255,255,255,0.8);
        }
        .chat-input input {
          flex: 1;
          border: none;
          outline: none;
          border-radius: 20px;
          padding: 10px 14px;
          font-size: 1rem;
        }
        .send {
          border: none;
          border-radius: 50%;
          margin-left: 6px;
          width: 40px;
          height: 40px;
          font-size: 1.2rem;
          color: white;
        }
        .send.active {
          background: linear-gradient(135deg, #ff4fa0, #ff9fd0);
        }
        .send.inactive {
          background: gray;
          opacity: 0.6;
        }
        .disconnect-modal {
          position: fixed;
          inset: 0;
          background: rgba(255,182,193,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .modal-content {
          background: #ffe6f0;
          border-radius: 14px;
          padding: 20px;
          text-align: center;
        }
        .modal-content button {
          background: linear-gradient(135deg, #ff4fa0, #ff9fd0);
          border: none;
          color: white;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
        }
      `}</style>
    </>
  );
}
