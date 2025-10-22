// pages/chat.js
// FIXED: Removed false disconnect alerts and auto-disconnect issues
// - Better socket connection handling
// - No premature disconnect alerts
// - Stable connection maintenance

import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import io from "socket.io-client";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const TARGET_IMAGE_SIZE = 800;
const IMAGE_QUALITY = 0.7;

const getAvatarForGender = (g) => {
  const key = String(g || "").toLowerCase();
  if (key === "male") return "/partner-avatar-male.png";
  if (key === "female") return "/partner-avatar-female.png";
  return "/partner-avatar.png";
};

// Compress image helper
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > TARGET_IMAGE_SIZE || height > TARGET_IMAGE_SIZE) {
          if (width > height) {
            height = (height / width) * TARGET_IMAGE_SIZE;
            width = TARGET_IMAGE_SIZE;
          } else {
            width = (width / height) * TARGET_IMAGE_SIZE;
            height = TARGET_IMAGE_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const reader2 = new FileReader();
              reader2.onload = () => resolve(reader2.result);
              reader2.onerror = reject;
              reader2.readAsDataURL(blob);
            } else {
              reject(new Error("Compression failed"));
            }
          },
          "image/jpeg",
          IMAGE_QUALITY
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function ChatPage() {
  // ===== State =====
  const [partnerName, setPartnerName] = useState("Partner");
  const [partnerAvatarSrc, setPartnerAvatarSrc] = useState("/partner-avatar.png");
  const [typing, setTyping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [msgs, setMsgs] = useState([]);
  const [roomCode, setRoomCode] = useState(null);

  // Search UI
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchIds, setMatchIds] = useState([]);
  const [matchIndex, setMatchIndex] = useState(0);

  // Emoji picker
  const [emojiOpen, setEmojiOpen] = useState(false);
  const EMOJIS = ["😊", "❤️", "😂", "👍", "🔥", "😍", "🤗", "😘", "😎", "🥰"];

  // Disconnect alert
  const [showDisconnectAlert, setShowDisconnectAlert] = useState(false);

  // File uploading state
  const [isUploading, setIsUploading] = useState(false);

  // Connection state
  const [isConnected, setIsConnected] = useState(false);

  // ===== Refs =====
  const socketRef = useRef(null);
  const msgRef = useRef(null);
  const fileRef = useRef(null);
  const listRef = useRef(null);
  const messageRefs = useRef({});
  const processedMsgIds = useRef(new Set());
  const partnerFoundRef = useRef(false); // Track if partner was actually found
  const isCleaningUp = useRef(false);

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

    const socket = io(BACKEND_URL, { 
      transports: ["websocket", "polling"], 
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      setIsConnected(true);
      
      socket.emit("userInfo", {
        name: localName || "You",
        avatar: null,
        gender: "unknown",
      });

      socket.emit("lookingForPartner", { type: "text" });
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connect error:", err?.message || err);
      // Don't show alert on initial connection errors
      if (partnerFoundRef.current) {
        const sysId = `sys-err-${Date.now()}`;
        if (!processedMsgIds.current.has(sysId)) {
          processedMsgIds.current.add(sysId);
          setMsgs((p) => [
            ...p,
            { id: sysId, self: false, kind: "system", html: "⚠️ Connection issue. Reconnecting...", time: timeNow() },
          ]);
        }
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      setIsConnected(false);
      
      // Only show disconnect message if we had a partner
      if (partnerFoundRef.current && !isCleaningUp.current) {
        // Don't show for normal disconnects (transport close, io client disconnect)
        if (reason !== "io client disconnect" && reason !== "transport close") {
          const sysId = `sys-dis-${Date.now()}`;
          if (!processedMsgIds.current.has(sysId)) {
            processedMsgIds.current.add(sysId);
            setMsgs((p) => [
              ...p,
              { id: sysId, self: false, kind: "system", html: `Connection lost (${String(reason)}).`, time: timeNow() },
            ]);
          }
        }
      }
    });

    socket.on("partnerFound", ({ roomCode: rc, partner }) => {
      if (!rc) return;
      
      console.log("Partner found:", partner);
      partnerFoundRef.current = true;
      
      setRoomCode(rc);
      const pName = partner?.name || "Romantic Stranger";
      const pAvatar = partner?.avatar || getAvatarForGender(partner?.gender);

      setPartnerName(pName);
      setPartnerAvatarSrc(pAvatar);

      try {
        socket.emit("joinRoom", { roomCode: rc });
      } catch (e) {}

      const sysId = `sys-found-${Date.now()}`;
      if (!processedMsgIds.current.has(sysId)) {
        processedMsgIds.current.add(sysId);
        setMsgs((p) => [
          ...p,
          { id: sysId, self: false, kind: "system", html: `You are connected with ${escapeHtml(pName)}.`, time: timeNow() },
        ]);
      }
      scrollToBottom();
    });

    // Incoming text message
    socket.on("message", (msg) => {
      if (!msg || !msg.id) return;
      
      if (processedMsgIds.current.has(msg.id)) return;
      processedMsgIds.current.add(msg.id);

      setMsgs((prev) => {
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

    // Incoming file message
    socket.on("fileMessage", (msg) => {
      if (!msg || !msg.id) return;
      
      if (processedMsgIds.current.has(msg.id)) return;
      processedMsgIds.current.add(msg.id);

      setMsgs((prev) => {
        if (prev.some((x) => x.id === msg.id)) return prev;
        
        const isSelf = socket.id === msg.senderId;
        const t = (msg.fileType || "").toLowerCase();
        let inner = "";
        
        if (t.startsWith("image/")) {
          inner = `<a href="${msg.fileData}" target="_blank" rel="noopener"><img src="${msg.fileData}" alt="image" /></a>`;
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

    socket.on("partnerTyping", () => {
      setTyping(true);
      clearTimeout(socketRef.current?._typingTimer);
      socketRef.current._typingTimer = setTimeout(() => setTyping(false), 1500);
    });

    socket.on("reaction", () => {});

    // Partner disconnected - ONLY show alert if partner was actually connected
    socket.on("partnerDisconnected", () => {
      console.log("Partner disconnected event received");
      
      // Only show alert if we had a partner and we're not cleaning up
      if (partnerFoundRef.current && !isCleaningUp.current) {
        setShowDisconnectAlert(true);
      }
    });

    return () => {
      isCleaningUp.current = true;
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

    processedMsgIds.current.add(id);

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
      setMsgs((prev) => prev.map((m) => (m.id === id ? { ...m, status: "failed" } : m)));
      console.error("emit message failed", e);
    }

    msgRef.current.value = "";
    setTyping(false);
  };

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f || !socketRef.current || !roomCode || isUploading) {
      e.target.value = "";
      return;
    }

    if (f.size > MAX_FILE_BYTES) {
      alert("⚠️ File too big – max 15 MB allowed.");
      e.target.value = "";
      return;
    }

    setIsUploading(true);
    const id = genId();
    processedMsgIds.current.add(id);

    try {
      let dataUrl;
      
      if (f.type.startsWith("image/")) {
        console.log(`Original image size: ${(f.size / 1024 / 1024).toFixed(2)} MB`);
        dataUrl = await compressImage(f);
        console.log(`Compressed image size: ${(dataUrl.length / 1024 / 1024).toFixed(2)} MB`);
      } else {
        dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });
      }

      const sizeInMB = dataUrl.length / 1024 / 1024;
      if (sizeInMB > 10) {
        alert("⚠️ Image is still too large after compression. Try a smaller image.");
        setIsUploading(false);
        e.target.value = "";
        return;
      }

      let inner = "";
      if (f.type.startsWith("image/")) {
        inner = `<a href="${dataUrl}" target="_blank" rel="noopener"><img src="${dataUrl}" alt="image" /></a>`;
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
        roomCode,
        senderId: socketRef.current.id,
      });

      console.log("File sent successfully");
    } catch (err) {
      console.error("File processing failed:", err);
      setMsgs((prev) => prev.map((m) => (m.id === id ? { ...m, status: "failed" } : m)));
      alert("⚠️ Failed to send file. Please try again.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const onType = () => {
    if (!socketRef.current || !roomCode) return;
    try {
      socketRef.current.emit("typing", { roomCode });
    } catch {}
  };

  // Handle disconnect alert OK button
  const handleDisconnectOk = () => {
    setShowDisconnectAlert(false);
    isCleaningUp.current = true;
    try {
      socketRef.current?.emit("disconnectByUser");
      socketRef.current?.disconnect();
    } catch {}
    window.location.href = "https://milanlove.in/connect";
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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>

      <div className="app">
        {/* Disconnect Alert Overlay */}
        {showDisconnectAlert && (
          <div className="alert-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="alert-box" onClick={(e) => e.stopPropagation()}>
              <div className="alert-icon">💔</div>
              <h2 className="alert-title">Partner Disconnected</h2>
              <p className="alert-message">
                Your partner has left the chat. Don't worry, there are many hearts waiting to connect with you! 💕
              </p>
              <button className="alert-btn" onClick={handleDisconnectOk}>
                OK
              </button>
            </div>
          </div>
        )}

        {/* Uploading Overlay */}
        {isUploading && (
          <div className="upload-overlay">
            <div className="upload-spinner"></div>
            <p className="upload-text">Sending image...</p>
          </div>
        )}

        {/* Header */}
        <header className="header">
          <div className="header-left">
            <button className="back-btn" onClick={() => (window.location.href = "https://milanlove.in/connect")} aria-label="Back">
              ⟵
            </button>
            <img className="avatar" src={partnerAvatarSrc} alt="DP" />
            <div className="partner">
              <div className="name">{partnerName}</div>
              <div className="status">
                <span className={`dot ${isConnected && roomCode ? 'online' : ''}`} /> 
                {typing ? "typing…" : roomCode ? "online" : "searching…"}
              </div>
            </div>
          </div>

          <div className="header-right">
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

            <button className="icon-btn" title="Menu" aria-label="Menu" onClick={() => setMenuOpen((s) => !s)}>
              ⋮
            </button>
            <div className={`menu ${menuOpen ? "open" : ""}`}>
              <button
                className="menu-item"
                onClick={() => {
                  isCleaningUp.current = true;
                  try {
                    socketRef.current.emit("disconnectByUser");
                    socketRef.current.disconnect();
                  } catch {}
                  window.location.href = "https://milanlove.in/connect";
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
              <div className="msg-wrap">
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
          <input ref={fileRef} type="file" hidden onChange={handleFile} accept="image/*,video/*,.pdf,.doc,.docx" />
          <button 
            className="tool" 
            title="Attach" 
            aria-label="Attach" 
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
          >
            📎
          </button>

          <div className="emoji-wrap">
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
            disabled={!roomCode || isUploading}
            onChange={onType}
            onKeyDown={(e) => e.key === "Enter" && sendText()}
          />
          <button 
            className="send" 
            title="Send" 
            aria-label="Send" 
            onClick={sendText} 
            disabled={!roomCode || isUploading}
          >
            ➤
          </button>
        </footer>
      </div>

      <style jsx>{`
        :root {
          --bg-pink-1: #2b0b1e;
          --bg-pink-2: #120317;
          --accent: #ff4fa0;
          --text: #f7f8fb;
          --muted: #d6cbe0;
          --bubble-me-start: #ff6b9d;
          --bubble-me-end: #ff1493;
          --bubble-you-start: #1f2a3a;
          --bubble-you-end: #0f1724;
        }

        * {
          -webkit-tap-highlight-color: transparent;
        }

        html, body {
          height: 100%;
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial;
          background: radial-gradient(1200px 600px at 10% 10%, rgba(255,79,160,0.06), transparent 6%),
                      radial-gradient(900px 400px at 90% 90%, rgba(139,92,246,0.03), transparent 8%),
                      linear-gradient(180deg, var(--bg-pink-1), var(--bg-pink-2));
          -webkit-font-smoothing: antialiased;
          overscroll-behavior: none;
        }

        .app {
          position: relative;
          display: flex;
          flex-direction: column;
          height: 100vh;
          height: 100dvh;
          max-width: 980px;
          margin: 0 auto;
          background: linear-gradient(180deg, rgba(3,2,6,0.6), rgba(5,3,8,0.95));
          color: var(--text);
          box-shadow: 0 18px 60px rgba(11,6,18,0.7);
          overflow: hidden;
        }

        /* Disconnect Alert */
        .alert-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.92);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          animation: fadeIn 0.3s ease;
          padding: 20px;
          -webkit-backdrop-filter: blur(10px);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .alert-box {
          background: linear-gradient(145deg, rgba(255,79,160,0.2), rgba(139,92,246,0.15));
          border: 2px solid rgba(255,79,160,0.4);
          border-radius: 24px;
          padding: 2.5rem 2rem;
          max-width: 420px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(255,79,160,0.3), 
                      0 0 100px rgba(255,20,147,0.2);
          animation: slideUp 0.4s ease;
          position: relative;
          overflow: hidden;
        }

        @keyframes slideUp {
          from {
            transform: translateY(50px) scale(0.95);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        .alert-icon {
          font-size: 4.5rem;
          margin-bottom: 1rem;
          animation: heartBeat 1.5s ease infinite;
          filter: drop-shadow(0 0 20px rgba(255,79,160,0.5));
        }

        @keyframes heartBeat {
          0%, 100% { transform: scale(1); }
          10%, 30% { transform: scale(0.9); }
          20%, 40% { transform: scale(1.15); }
        }

        .alert-title {
          color: #ff6b9d;
          font-size: 1.8rem;
          font-weight: 800;
          margin: 0 0 1rem;
          text-shadow: 0 2px 15px rgba(255,107,157,0.4);
          line-height: 1.3;
        }

        .alert-message {
          color: #f7f8fb;
          font-size: 1.05rem;
          line-height: 1.6;
          margin: 0 0 2rem;
          opacity: 0.95;
        }

        .alert-btn {
          background: linear-gradient(135deg, #ff4fa0, #ff1493);
          color: #ffffff;
          border: none;
          border-radius: 50px;
          padding: 16px 60px;
          font-size: 1.15rem;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 10px 30px rgba(255,79,160,0.5),
                      0 0 50px rgba(255,20,147,0.3);
          transition: all 0.3s ease;
          letter-spacing: 0.5px;
          min-width: 140px;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }

        .alert-btn:active {
          transform: scale(0.97);
          box-shadow: 0 5px 20px rgba(255,79,160,0.4);
        }

        /* Upload Overlay */
        .upload-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 9998;
        }

        .upload-spinner {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(255,79,160,0.2);
          border-top: 4px solid #ff4fa0;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .upload-text {
          color: #fff;
          margin-top: 1rem;
          font-size: 1rem;
        }

        /* Header */
        .header {
          position: sticky;
          top: 0;
          z-index: 30;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          gap: 0.6rem;
          background: linear-gradient(180deg, rgba(255,79,160,0.12), rgba(139,92,246,0.08));
          color: var(--text);
          border-bottom: 1px solid rgba(255,255,255,0.03);
          backdrop-filter: blur(6px);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 0.8rem;
        }
        
        .back-btn {
          border: none;
          background: rgba(255,255,255,0.04);
          border-radius: 12px;
          padding: 8px 10px;
          cursor: pointer;
          color: var(--text);
          font-weight: 700;
          box-shadow: 0 6px 18px rgba(139,92,246,0.06);
        }
        
        .avatar {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid rgba(255,255,255,0.06);
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
        }
        
        .partner .name {
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #ffffff;
          font-size: 1rem;
        }
        
        .status {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.86rem;
          opacity: 0.95;
          color: var(--muted);
        }
        
        .dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #666;
          box-shadow: 0 0 10px rgba(102,102,102,0.14);
          transition: background 0.3s ease, box-shadow 0.3s ease;
        }

        .dot.online {
          background: #a7ffb2;
          box-shadow: 0 0 10px rgba(167,255,178,0.14);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        
        .icon-btn {
          border: none;
          background: rgba(255,255,255,0.03);
          border-radius: 10px;
          padding: 8px;
          cursor: pointer;
          color: var(--text);
          font-size: 1.05rem;
        }

        .search-area {
          display: flex;
          align-items: center;
        }

        .search-input {
          width: 200px;
          background: rgba(255,255,255,0.02);
          color: var(--text);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 0.95rem;
        }

        /* Menu */
        .menu {
          position: absolute;
          right: 10px;
          top: 48px;
          background: rgba(0,0,0,0.45);
          border-radius: 10px;
          padding: 6px;
          min-width: 200px;
          display: none;
          box-shadow: 0 8px 26px rgba(2,6,23,0.6);
          border: 1px solid rgba(255,255,255,0.04);
          backdrop-filter: blur(6px);
        }
        .menu.open { display: block; }
        .menu-item {
          width: 100%;
          text-align: left;
          background: linear-gradient(90deg, rgba(255,79,160,0.06), rgba(139,92,246,0.04));
          border: none;
          color: #fff;
          padding: 12px 14px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.95rem;
          margin: 4px 0;
        }
        .menu-item:hover {
          background: linear-gradient(90deg, rgba(255,79,160,0.12), rgba(139,92,246,0.08));
        }
        .sep { height: 1px; background: rgba(255,255,255,0.03); margin: 6px 0; }

        /* Chat area */
        .chat {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 24px 16px;
          background-image:
            radial-gradient(600px 300px at 10% 10%, rgba(255,79,160,0.03), transparent 6%),
            radial-gradient(500px 250px at 90% 90%, rgba(139,92,246,0.02), transparent 8%);
          -webkit-overflow-scrolling: touch;
        }

        .day-sep { 
          text-align: center; 
          color: var(--muted); 
          font-size: 0.86rem; 
          margin: 8px 0 16px; 
        }
        .day-sep span { 
          background: rgba(255,255,255,0.03); 
          padding: 4px 10px; 
          border-radius: 12px; 
        }

        .row { display: flex; margin: 10px 0; }
        .row.me { justify-content: flex-end; }
        .row.system-row { justify-content: center; }

        .msg-wrap { max-width: 85%; position: relative; }

        .bubble {
          display: inline-block;
          max-width: 100%;
          border-radius: 14px;
          padding: 0.8rem 0.95rem;
          line-height: 1.35;
          word-wrap: break-word;
          box-shadow: 0 10px 40px rgba(2,6,23,0.6);
          border: 1px solid rgba(255,255,255,0.02);
        }

        /* YOU bubble */
        .you .bubble {
          background: linear-gradient(135deg, var(--bubble-you-start), var(--bubble-you-end));
          color: #ffffff !important;
          border: 1px solid rgba(255,255,255,0.03);
          box-shadow: 0 8px 28px rgba(20,40,80,0.12);
          border-top-left-radius: 6px;
        }

        /* ME bubble */
        .me .bubble {
          background: linear-gradient(135deg, var(--bubble-me-start), var(--bubble-me-end));
          color: #ffffff !important;
          border: 1px solid rgba(255,255,255,0.15);
          box-shadow: 0 12px 40px rgba(255,20,147,0.25), 0 0 20px rgba(255,105,180,0.15);
          border-top-right-radius: 6px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.15);
        }

        .bubble a {
          color: inherit;
          text-decoration: underline;
          font-weight: 600;
        }

        .bubble img, .bubble video {
          max-width: 100%;
          width: auto;
          max-height: 400px;
          border-radius: 12px;
          display: block;
          margin: 4px 0;
        }

        .system-bubble {
          background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
          color: #ffeef8 !important;
          padding: 0.45rem 0.6rem;
          border-radius: 12px;
          font-weight: 600;
          box-shadow: 0 6px 18px rgba(255,255,255,0.02) inset;
          font-size: 0.9rem;
        }

        .meta {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          margin-top: 0.28rem;
          font-size: 0.78rem;
          color: var(--muted);
        }
        .time { font-size: 0.78rem; color: var(--muted); }
        .ticks { font-size: 0.95rem; line-height: 1; }
        .ticks.seen { color: var(--accent); text-shadow: 0 0 6px rgba(255,79,160,0.16); }

        /* Input bar */
        .inputbar {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 12px 14px;
          background: rgba(255,255,255,0.01);
          border-top: 1px solid rgba(255,255,255,0.02);
          backdrop-filter: blur(6px);
        }
        .tool {
          border: none;
          background: rgba(255,255,255,0.02);
          cursor: pointer;
          display: grid;
          place-items: center;
          border-radius: 10px;
          width: 48px;
          height: 48px;
          color: var(--text);
          font-size: 1.18rem;
          flex-shrink: 0;
        }
        .tool:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .emoji-wrap {
          position: relative;
        }

        .msg-field {
          flex: 1;
          background: rgba(255,255,255,0.08);
          color: #ffffff !important;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 28px;
          padding: 12px 16px;
          outline: none;
          font-size: 1rem;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
        }
        .msg-field::placeholder { color: #d4b8d4; opacity: 0.8; }
        .msg-field:disabled {
          opacity: 0.6;
        }

        .send {
          background: linear-gradient(135deg, rgba(255,79,160,1), rgba(139,92,246,0.95));
          color: #ffffff;
          border: none;
          border-radius: 50%;
          width: 52px;
          height: 52px;
          display: grid;
          place-items: center;
          cursor: pointer;
          box-shadow: 0 16px 36px rgba(255,79,160,0.18);
          font-size: 1.12rem;
          transition: transform 120ms ease, box-shadow 120ms ease;
          font-weight: bold;
          flex-shrink: 0;
        }
        .send:active { 
          transform: translateY(1px) scale(0.98); 
          box-shadow: 0 8px 18px rgba(255,79,160,0.16); 
        }
        .send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .emoji-pop {
          position: absolute;
          bottom: 66px;
          left: 0;
          background: rgba(30,20,40,0.95);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 0.5rem;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 0.35rem;
          box-shadow: 0 10px 30px rgba(2,6,23,0.6);
          backdrop-filter: blur(10px);
        }
        .emoji-item {
          border: none;
          background: transparent;
          font-size: 1.4rem;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 8px;
          transition: all 150ms ease;
        }
        .emoji-item:active { 
          background: rgba(255,79,160,0.2); 
          transform: scale(1.1); 
        }

        @media (max-width: 640px) {
          .app {
            margin: 0;
            border-radius: 0;
            max-width: 100%;
          }
          
          .bubble { 
            max-width: 90%; 
            padding: 0.7rem 0.85rem; 
            font-size: 0.95rem;
          }
          
          .bubble img, .bubble video { 
            max-width: 100%;
            max-height: 300px;
          }
          
          .msg-wrap {
            max-width: 85%;
          }
          
          .avatar { width: 40px; height: 40px; }
          .search-input { width: 120px; font-size: 0.9rem; }
          .tool { width: 44px; height: 44px; font-size: 1.1rem; }
          .send { width: 48px; height: 48px; }
          .msg-field { font-size: 16px; padding: 11px 14px; }
          
          .alert-box { 
            padding: 2rem 1.5rem;
            max-width: 340px;
          }
          .alert-title { font-size: 1.5rem; }
          .alert-message { font-size: 0.95rem; }
          .alert-icon { font-size: 3.5rem; }
          .alert-btn {
            padding: 14px 50px;
            font-size: 1.05rem;
          }
          
          .header {
            padding: 10px 12px;
          }
          
          .chat {
            padding: 16px 12px;
          }
          
          .partner .name {
            font-size: 0.95rem;
          }
          
          .status {
            font-size: 0.8rem;
          }
        }
      `}</style>
    </>
  );
}
