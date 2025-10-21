// pages/chat.js
import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import io from "socket.io-client";

// Keep your backend URL logic
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com";

// helper to pick avatar by gender (same idea as your current file)
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

  // Message shape: { id, self, kind:'text'|'file', html, time, status?:'sent'|'delivered'|'seen', reactions? }
  const [msgs, setMsgs] = useState([]);

  // ===== Refs =====
  const socketRef = useRef(null);
  const msgRef = useRef(null);
  const fileRef = useRef(null);
  const listRef = useRef(null);

  // ===== Utils =====
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
    text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const scrollToBottom = () => requestAnimationFrame(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  });

  // ===== Socket lifecycle =====
  useEffect(() => {
    // pull partner/session data prepared earlier (roomCode, name, gender, avatar)
    let partnerData = null;
    try {
      partnerData = JSON.parse(sessionStorage.getItem("partnerData") || "null");
    } catch {}

    if (!partnerData || !partnerData.roomCode) {
      // fallback so the page still works if someone lands directly
      partnerData = {
        roomCode: "DEMO-" + Math.random().toString(36).slice(2, 6),
        name: "Partner",
        gender: "unknown",
      };
      sessionStorage.setItem("partnerData", JSON.stringify(partnerData));
    }

    setPartnerName(partnerData.name || "Partner");
    const chosen = (partnerData.avatar && String(partnerData.avatar)) || getAvatarForGender(partnerData.gender);
    setPartnerAvatarSrc(chosen);

    // connect socket
    const socket = io(BACKEND_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    // same events you already used earlier (joinRoom + userInfo). :contentReference[oaicite:2]{index=2}
    socket.emit("userInfo", {
      name: partnerData.name,
      avatar: partnerData.avatar || chosen,
      gender: partnerData.gender,
    });
    socket.emit("joinRoom", { roomCode: partnerData.roomCode });

    // inbound text message (event name kept as 'message'). :contentReference[oaicite:3]{index=3}
    socket.on("message", (msg) => {
      const isSelf = socket.id === msg.senderId;
      setMsgs((p) => [
        ...p,
        {
          id: msg.id || genId(),
          self: isSelf,
          kind: "text",
          html: `${linkify(escapeHtml(msg.text))}`,
          time: timeNow(),
        },
      ]);
      scrollToBottom();
    });

    // inbound file (event name kept as 'fileMessage'). :contentReference[oaicite:4]{index=4}
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
      setMsgs((p) => [...p, { id: msg.id || genId(), self: isSelf, kind: "file", html: inner, time: timeNow() }]);
      scrollToBottom();
    });

    // typing indicator (partnerTyping) and sender typing emit (typing). :contentReference[oaicite:5]{index=5}
    socket.on("partnerTyping", () => {
      setTyping(true);
      clearTimeout(socketRef.current?._typingTimer);
      socketRef.current._typingTimer = setTimeout(() => setTyping(false), 1500);
    });

    // reactions (reaction). :contentReference[oaicite:6]{index=6}
    socket.on("reaction", ({ messageId, emoji }) => {
      setMsgs((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, reactions: { ...(m.reactions || {}), [emoji]: (m.reactions?.[emoji] || 0) + 1 } } : m
        )
      );
    });

    socket.on("partnerDisconnected", () => {
      alert("💔 Partner disconnected.");
      window.location.href = "/";
    });

    return () => {
      try { socket.disconnect(); } catch {}
    };
  }, []);

  // ===== Actions =====
  const sendText = () => {
    const val = (msgRef.current?.value || "").trim();
    if (!val) return;
    const id = genId();

    // optimistic bubble
    setMsgs((p) => [...p, { id, self: true, kind: "text", html: linkify(escapeHtml(val)), time: timeNow(), status: "sent" }]);
    scrollToBottom();

    const pd = JSON.parse(sessionStorage.getItem("partnerData") || "{}");
    socketRef.current.emit("message", {
      id,
      text: val,
      roomCode: pd.roomCode,
      senderId: socketRef.current.id,
    }); // same event name you used. :contentReference[oaicite:7]{index=7}

    msgRef.current.value = "";
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const id = genId();
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const pd = JSON.parse(sessionStorage.getItem("partnerData") || "{}");

      // optimistic preview
      let inner = "";
      if (f.type.startsWith("image/")) {
        inner = `<a href="${dataUrl}" target="_blank"><img src="${dataUrl}" /></a>`;
      } else if (f.type.startsWith("video/")) {
        inner = `<video controls><source src="${dataUrl}" type="${f.type}"></video>`;
      } else {
        inner = `<a class="file-link" download="${escapeHtml(f.name)}" href="${dataUrl}">${escapeHtml(f.name)}</a>`;
      }
      setMsgs((p) => [...p, { id, self: true, kind: "file", html: inner, time: timeNow(), status: "sent" }]);
      scrollToBottom();

      // send to partner (same event). :contentReference[oaicite:8]{index=8}
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
    e.target.value = "";
  };

  const onType = () => {
    const pd = JSON.parse(sessionStorage.getItem("partnerData") || "{}");
    socketRef.current.emit("typing", { roomCode: pd.roomCode }); // same event name. :contentReference[oaicite:9]{index=9}
  };

  const sendReaction = (mid, emoji) => {
    setMsgs((prev) =>
      prev.map((m) =>
        m.id !== mid ? m : { ...m, reactions: { ...(m.reactions || {}), [emoji]: (m.reactions?.[emoji] || 0) + 1 } }
      )
    );
    const pd = JSON.parse(sessionStorage.getItem("partnerData") || "{}");
    socketRef.current.emit("reaction", { roomCode: pd.roomCode, messageId: mid, emoji }); // same event. :contentReference[oaicite:10]{index=10}
  };

  // ===== UI =====
  useEffect(() => {
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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="app">
        {/* Header (WhatsApp-style, pink gradient) */}
        <header className="header">
          <div className="header-left">
            <button className="back-btn" onClick={() => (window.location.href = "/connect")} aria-label="Back">⟵</button>
            <img className="avatar" src={partnerAvatarSrc} alt="DP" />
            <div className="partner">
              <div className="name">{partnerName}</div>
              <div className="status">
                <span className="dot" /> {typing ? "typing…" : "online"}
              </div>
            </div>
          </div>

          <div className="header-right">
            <button className="icon-btn" title="Search" aria-label="Search">🔎</button>
            <button className="icon-btn" title="Menu" aria-label="Menu" onClick={() => setMenuOpen((s) => !s)}>⋮</button>
            <div className={`menu ${menuOpen ? "open" : ""}`}>
              <button
                className="menu-item"
                onClick={() => {
                  try { socketRef.current.emit("disconnectByUser"); socketRef.current.disconnect(); } catch {}
                  window.location.href = "/";
                }}
              >
                🔌 Disconnect
              </button>
              <div className="sep" />
              <button className="menu-item" onClick={() => alert("🚩 Report submitted. Thank you!")}>🚩 Report</button>
            </div>
          </div>
        </header>

        {/* Messages */}
        <main className="chat" ref={listRef}>
          <div className="day-sep"><span>Today</span></div>
          {msgs.map((m) => (
            <Message key={m.id} self={m.self} html={m.html} time={m.time} status={m.status} onReact={(e) => sendReaction(m.id, e)} />
          ))}
        </main>

        {/* Input Bar */}
        <footer className="inputbar">
          <input ref={fileRef} type="file" hidden onChange={handleFile} />
          <button className="tool" title="Attach" aria-label="Attach" onClick={() => fileRef.current?.click()}>📎</button>
          <button className="tool" title="Emoji" aria-label="Emoji">😊</button>
          <input
            ref={msgRef}
            className="msg-field"
            type="text"
            placeholder="Type a message…"
            onChange={onType}
            onKeyDown={(e) => e.key === "Enter" && sendText()}
          />
          <button className="send" title="Send" aria-label="Send" onClick={sendText}>➤</button>
        </footer>
      </div>

      <style jsx>{`
        :root{
          --bg:#0f1a25;
          --panel:#0b1420;
          --header-1:#ff5fa2;
          --header-2:#ff7ec7;
          --accent:#ff4fa0;
          --accent-2:#ffd7ec;
          --text:#1f2330;
          --muted:#7f8aa3;
          --bubble-me:#ffe6f4;
          --bubble-me-b:#ffb9dc;
          --bubble-you:#eef3f7;
          --bubble-you-b:#dfe7ef;
        }
        html,body{ background:#0b1220; }
        .app{ position:relative; display:flex; flex-direction:column; height:100svh; max-width:900px; margin:0 auto; background:var(--panel); }
        .app::before{
          content:""; position:fixed; inset:0; z-index:0; pointer-events:none; opacity:.06;
          background:
            radial-gradient(circle at 10% 24%, #ff6bb0 0 6px, transparent 7px),
            radial-gradient(circle at 30% 80%, #ff6bb0 0 6px, transparent 7px),
            radial-gradient(circle at 82% 30%, #ff6bb0 0 6px, transparent 7px);
          filter: blur(1px);
        }

        .header{ position:sticky; top:0; z-index:5; display:flex; align-items:center; justify-content:space-between; gap:.6rem; padding:.6rem .8rem;
          background:linear-gradient(90deg,var(--header-1),var(--header-2)); color:#fff; box-shadow:0 6px 24px rgba(0,0,0,.16); }
        .header-left{ display:flex; align-items:center; gap:.7rem; min-width:0; }
        .back-btn{ border:none; background:rgba(255,255,255,.18); border-radius:10px; padding:.35rem .5rem; cursor:pointer; color:#fff; }
        .avatar{ width:38px; height:38px; border-radius:50%; object-fit:cover; border:2px solid rgba(255,255,255,.55); background:#fff; }
        .partner .name{ font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .status{ display:flex; align-items:center; gap:.35rem; font-size:.78rem; opacity:.95; }
        .dot{ width:8px; height:8px; border-radius:50%; background:#a7ffb2; box-shadow:0 0 0 3px rgba(255,255,255,.35) inset; }
        .header-right{ position:relative; display:flex; align-items:center; gap:.35rem; }
        .icon-btn{ border:none; background:rgba(255,255,255,.18); border-radius:10px; padding:.45rem; cursor:pointer; color:#fff; }
        .menu{ position:absolute; right:0; top:120%; background:#0e1722; border:1px solid rgba(255,255,255,.06); border-radius:10px; padding:.35rem; min-width:160px; display:none; }
        .menu.open{ display:block; }
        .menu-item{ width:100%; text-align:left; background:transparent; border:none; color:#e9eef6; padding:.5rem .6rem; border-radius:8px; cursor:pointer; }
        .menu-item:hover{ background:rgba(255,255,255,.05); }
        .sep{ height:1px; background:rgba(255,255,255,.08); margin:.35rem 0; }

        .chat{ flex:1; overflow-y:auto; padding:18px; background:linear-gradient(180deg,#0f1a25 0,#0b1420 100%); }
        .day-sep{ text-align:center; color:#cbd2e1; font-size:.78rem; margin:8px 0 16px; }
        .day-sep span{ background:rgba(255,255,255,.06); padding:.25rem .6rem; border-radius:12px; }

        .row{ display:flex; margin:6px 0; }
        .row.me{ justify-content:flex-end; }
        .bubble{ max-width:74%; background:#fff; border:1px solid #eee; padding:.55rem .7rem .6rem; border-radius:14px; line-height:1.28; word-wrap:break-word; box-shadow:0 2px 10px rgba(0,0,0,.08); }
        .me .bubble{ background:var(--bubble-me); border-color:var(--bubble-me-b); border-top-right-radius:4px; }
        .you .bubble{ background:var(--bubble-you); border-color:var(--bubble-you-b); border-top-left-radius:4px; }
        .bubble :global(img){ max-width:220px; border-radius:10px; display:block; }
        .bubble :global(video){ max-width:220px; border-radius:10px; display:block; }
        .meta{ display:flex; align-items:center; gap:.35rem; margin-top:.28rem; font-size:.72rem; color:#7f8aa3; }
        .ticks{ font-size:.9rem; line-height:1; }
        .ticks.seen{ color:#4ea3ff; }

        .react{ display:flex; gap:.35rem; margin-top:.3rem; }
        .react button{ border:none; background:transparent; cursor:pointer; font-size:1rem; }
        .pill{ margin-top:.24rem; display:inline-flex; gap:.3rem; background:rgba(0,0,0,.06); color:#333; border-radius:12px; padding:.12rem .4rem; font-size:.78rem; }

        .inputbar{ display:flex; align-items:center; gap:.5rem; padding:.6rem .7rem; background:#0e1722; border-top:1px solid rgba(255,255,255,.06); }
        .tool{ border:none; background:transparent; cursor:pointer; display:grid; place-items:center; border-radius:50%; width:34px; height:34px; color:#e9eef6; }
        .msg-field{ flex:1; background:#121d2a; color:#e9eef6; border:1px solid rgba(255,255,255,.08); border-radius:22px; padding:.55rem .75rem; outline:none; }
        .msg-field::placeholder{ color:#93a0b8; }
        .send{ background:linear-gradient(135deg,var(--accent),#ff9fd0); color:#071320; border:none; border-radius:50%; width:40px; height:40px; display:grid; place-items:center; cursor:pointer; box-shadow:0 6px 18px rgba(255,79,160,.35); }

        @media (max-width:640px){
          .bubble{ max-width:82%; }
          .avatar{ width:34px; height:34px; }
        }
      `}</style>
    </>
  );
}

function Message({ self, html, time, status, onReact }) {
  const [picker, setPicker] = useState(false);
  useEffect(() => {
    const h = (e) => { if (!e.target.closest(".msg-wrap")) setPicker(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  const bar = ["❤️", "😂", "🔥", "👍", "😍", "🤗"];

  return (
    <div className={`row ${self ? "me" : "you"}`}>
      <div className="msg-wrap" style={{ position: "relative" }}>
        <div className="bubble" dangerouslySetInnerHTML={{ __html: html }} />
        <div className="meta">
          <span className="time">{time}</span>
          {self && <span className={`ticks ${status === "seen" ? "seen" : ""}`}>{status === "sent" ? "✓" : status === "seen" ? "✓✓" : "✓✓"}</span>}
        </div>

        {/* quick reactions (WhatsApp-style long-press vibe) */}
        <div className="react">
          <button onClick={() => setPicker((s) => !s)}>😊</button>
          {picker &&
            bar.map((e) => (
              <button key={e} onClick={() => { onReact(e); setPicker(false); }}>{e}</button>
            ))}
        </div>
      </div>
    </div>
  );
}
