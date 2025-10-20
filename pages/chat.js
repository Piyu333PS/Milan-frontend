"use client";
import { useEffect, useRef } from "react";
import io from "socket.io-client";

/**
 * Milan Threads — Design-First Chat (Scoped styles, NO global overrides)
 * - Heart Threads (center pulse path)
 * - Reaction Orbs (❤️ 🔥 ✨ 🌙)
 * - Reaction Trails (Delivered / Seen)
 * - Avatar Whisper Space (small interactions)
 *
 * Safe with AI Studio: No edits to _app.js or globals.css
 */

export default function ChatPage() {
  const socketRef = useRef(null);
  const lastPartnerMessageAt = useRef(0);

  useEffect(() => {
    const socket = io("https://milan-j9u9.onrender.com");
    socketRef.current = socket;

    // DOM refs
    const msgInput = document.getElementById("msgInput");
    const typingIndicator = document.getElementById("typingIndicator");
    const messagesContainer = document.getElementById("messages");
    const sendBtn = document.getElementById("sendBtn");
    const partnerNameEl = document.getElementById("partnerName");
    const partnerAvatarEl = document.getElementById("partnerAvatar");
    const welcomeMessageEl = document.getElementById("welcomeMessage");
    const disconnectBtn = document.getElementById("disconnectBtn");
    const fileBtn = document.getElementById("fileBtn");
    const fileInput = document.getElementById("fileInput");
    const reportBtn = document.getElementById("reportBtn");

    // Session data (same as your current file)
    let partnerData = null;
    try { partnerData = JSON.parse(sessionStorage.getItem("partnerData")); } catch { partnerData = null; }
    if (!partnerData || !sessionStorage.getItem("roomCode")) {
      alert("Partner info missing. Redirecting...");
      window.location.href = "/";
      return;
    }
    const roomCode = sessionStorage.getItem("roomCode");

    // Header set
    partnerNameEl.textContent = partnerData.name || "Partner";
    partnerAvatarEl.src = partnerData.avatar || "partner-avatar.png";

    // Join
    socket.emit("userInfo", { name: partnerData.name, avatar: partnerData.avatar });
    socket.emit("joinRoom", { roomCode });

    // Welcome banner
    welcomeMessageEl.classList.remove("isHidden");
    setTimeout(() => welcomeMessageEl.classList.add("isHidden"), 3000);

    // Helpers
    function formatTime() {
      const time = new Date();
      const h12 = time.getHours() % 12 || 12;
      const m = time.getMinutes().toString().padStart(2, "0");
      const ampm = time.getHours() >= 12 ? "PM" : "AM";
      return `${h12}:${m} ${ampm}`;
    }

    function makeMessageNode({ from, htmlContent, isSelf }) {
      const wrap = document.createElement("div");
      wrap.className = `msg ${isSelf ? "self" : "partner"} trail--pending`;

      // Node bubble
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.innerHTML = `
        <div class="bubble__meta">
          <strong class="bubble__from">${from}</strong>
          <span class="bubble__time">${formatTime()}</span>
        </div>
        <div class="bubble__text">${htmlContent}</div>
        <div class="bubble__status">
          <span class="statusDot"></span>
          <span class="statusText">Delivered</span>
        </div>
        <div class="reactions">
          <button class="orb orb--heart" title="Love">❤️</button>
          <button class="orb orb--fire"  title="Fire">🔥</button>
          <button class="orb orb--spark" title="Sparkle">✨</button>
          <button class="orb orb--moon"  title="Calm">🌙</button>
        </div>
      `;

      // Attach reaction handlers
      bubble.querySelectorAll(".orb").forEach((btn) => {
        btn.addEventListener("click", () => {
          // tiny orbit burst
          bubble.classList.add("bubble--reacted");
          bubble.setAttribute("data-react", btn.textContent);
          setTimeout(() => bubble.classList.remove("bubble--reacted"), 800);
        });
      });

      wrap.appendChild(bubble);
      messagesContainer.appendChild(wrap);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      // Reaction Trail: mark delivered instantly (animate glow trail)
      requestAnimationFrame(() => {
        wrap.classList.remove("trail--pending");
        wrap.classList.add("trail--delivered");
      });

      return wrap;
    }

    function sendText() {
      const text = msgInput.value.trim();
      if (!text) return;
      socket.emit("message", { text, roomCode, senderId: socket.id });
      // local render
      const node = makeMessageNode({
        from: "You",
        htmlContent: escapeHTML(text),
        isSelf: true,
      });
      node.dataset.localId = cryptoRandom();
      msgInput.value = "";
      // Avatar whisper (you)
      whisper("you");
    }

    function sendFile(file) {
      const reader = new FileReader();
      reader.onload = () => {
        socket.emit("fileMessage", {
          fileName: file.name,
          fileType: file.type,
          fileData: reader.result,
          roomCode,
        });
        const preview =
          file.type && file.type.startsWith("image/")
            ? `<a href="${reader.result}" target="_blank" class="file"><img src="${reader.result}" alt="${file.name}"/></a>`
            : `<a href="${reader.result}" download="${file.name}" class="file">${file.name}</a>`;

        const node = makeMessageNode({
          from: "You",
          htmlContent: `sent a file<br/>${preview}`,
          isSelf: true,
        });
        node.dataset.localId = cryptoRandom();
        whisper("you");
      };
      reader.readAsDataURL(file);
    }

    function whisper(who) {
      // subtle avatar animation
      const you = document.getElementById("youAvatar");
      const them = document.getElementById("themAvatar");
      if (who === "you") {
        you.classList.remove("avatar--pulse");
        void you.offsetWidth;
        you.classList.add("avatar--pulse");
      } else {
        them.classList.remove("avatar--pulse");
        void them.offsetWidth;
        them.classList.add("avatar--pulse");
      }
    }

    function markSeenForLastSelfMessage() {
      // local “seen” when partner sends next message
      const nodes = messagesContainer.querySelectorAll(".msg.self.trail--delivered");
      if (!nodes.length) return;
      const last = nodes[nodes.length - 1];
      if (!last.classList.contains("trail--seen")) {
        last.classList.add("trail--seen");
        const txt = last.querySelector(".statusText");
        if (txt) txt.textContent = "Seen";
      }
    }

    // Events
    sendBtn.addEventListener("click", sendText);
    msgInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendText(); });
    msgInput.addEventListener("input", () => socket.emit("typing", { roomCode }));

    fileBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const f = fileInput.files[0];
      if (f) sendFile(f);
      fileInput.value = "";
    });

    disconnectBtn.addEventListener("click", () => {
      socket.emit("disconnectByUser");
      socket.disconnect();
      window.location.href = "/";
    });

    reportBtn.addEventListener("click", () => {
      alert("🚩 Partner reported. Thank you for keeping Milan safe!");
      socket.emit("reportPartner", { roomCode });
    });

    // Socket listeners
    socket.on("message", (msg) => {
      if (!msg) return;
      const isSelf = msg.senderId === socket.id;
      const textHtml = escapeHTML(msg.text || "");
      makeMessageNode({
        from: isSelf ? "You" : partnerData.name,
        htmlContent: textHtml,
        isSelf,
      });

      if (!isSelf) {
        lastPartnerMessageAt.current = Date.now();
        whisper("them");
        // mark previous self as seen
        markSeenForLastSelfMessage();
      }
    });

    socket.on("fileMessage", (msg) => {
      const isSelf = msg.senderId === socket.id;
      const preview =
        msg.fileType && msg.fileType.startsWith("image/")
          ? `<a href="${msg.fileData}" target="_blank" class="file"><img src="${msg.fileData}" alt="${msg.fileName}"/></a>`
          : `<a href="${msg.fileData}" download="${msg.fileName}" class="file">${msg.fileName}</a>`;

      makeMessageNode({
        from: isSelf ? "You" : partnerData.name,
        htmlContent: `sent a file<br/>${preview}`,
        isSelf,
      });

      if (!isSelf) {
        lastPartnerMessageAt.current = Date.now();
        whisper("them");
        markSeenForLastSelfMessage();
      }
    });

    socket.on("partnerTyping", () => {
      typingIndicator.classList.remove("isHidden");
      clearTimeout(typingIndicator._t);
      typingIndicator._t = setTimeout(() => typingIndicator.classList.add("isHidden"), 1500);
    });

    socket.on("partnerDisconnected", () => {
      alert("💔 Partner disconnected.");
      window.location.href = "/";
    });

    return () => {
      try { socket.disconnect(); } catch {}
    };
  }, []);

  return (
    <>
      <div className="milanChat">
        {/* Header */}
        <div className="header">
          <div className="header__left">
            <img id="partnerAvatar" className="avatar" src="partner-avatar.png" alt="Partner"/>
            <div className="who">
              <span id="partnerName" className="who__name">Partner</span>
              <span id="typingIndicator" className="who__typing isHidden">typing…</span>
            </div>
          </div>
          <div className="header__right">
            <button id="reportBtn" className="btn btn--ghost">🚩 Report</button>
            <button id="disconnectBtn" className="btn btn--danger">Disconnect</button>
          </div>
        </div>

        {/* Avatar Whisper Space */}
        <div className="whisper">
          <div className="whisper__lane">
            <img id="themAvatar" className="miniAvatar" src="partner-avatar.png" alt="Them"/>
            <div className="lane__mid">
              {/* Heart Threads line */}
              <div className="pulseLine">
                <span className="beat beat--l" />
                <span className="beat beat--c" />
                <span className="beat beat--r" />
              </div>
            </div>
            <img id="youAvatar" className="miniAvatar" src="you-avatar.png" alt="You"
              onError={(e)=>{e.currentTarget.src="partner-avatar.png"}}/>
          </div>
        </div>

        {/* Welcome */}
        <div id="welcomeMessage" className="welcome isHidden">
          You are now connected to a Romantic Stranger 💌
        </div>

        {/* Messages Thread on Heart Line */}
        <div id="messages" className="thread" />

        {/* Composer */}
        <div className="composer">
          <input type="file" id="fileInput" style={{ display:"none" }} />
          <button id="fileBtn" className="icon" title="Attach">📎</button>
          <input id="msgInput" className="input" placeholder="Type a message…" />
          <button id="sendBtn" className="send" title="Send">➤</button>
        </div>
      </div>

      {/* SCOPED styles only */}
      <style jsx>{`
        .milanChat{
          width:100%;
          max-width:820px;
          height:100dvh;
          margin:0 auto;
          display:flex; flex-direction:column;
          background:rgba(255,255,255,.06);
          border:1px solid rgba(255,255,255,.12);
          border-radius:16px;
          backdrop-filter:blur(10px);
          overflow:hidden;
        }

        /* Header */
        .header{
          display:flex; align-items:center; justify-content:space-between;
          padding:10px 12px;
          background:linear-gradient(90deg,#ec4899,#fb7185);
          color:#fff;
        }
        .header__left{ display:flex; align-items:center; gap:8px; }
        .avatar{ width:42px; height:42px; border-radius:999px; object-fit:cover; }
        .who{ display:flex; flex-direction:column; line-height:1.1; }
        .who__name{ font-weight:700; font-size:14px; }
        .who__typing{ font-size:12px; opacity:.9; }
        .isHidden{ display:none; }

        .btn{
          border:none; border-radius:10px; padding:8px 10px; font-weight:700; cursor:pointer;
          background:#fff; color:#ec4899;
        }
        .btn--danger{ color:#fff; background:#1f2937; }
        .btn--ghost{ background:#fff; color:#ef4444; }

        /* Whisper space + Heart Threads pulse line */
        .whisper{ padding:8px 12px; background:rgba(0,0,0,.05); }
        .whisper__lane{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .miniAvatar{
          width:34px; height:34px; border-radius:999px; object-fit:cover; border:2px solid rgba(255,255,255,.6);
        }
        .avatar--pulse{ animation:pulse 600ms ease; }
        @keyframes pulse{ 0%{ transform:scale(1); } 50%{ transform:scale(1.12); } 100%{ transform:scale(1); } }

        .lane__mid{ flex:1; position:relative; height:38px; display:flex; align-items:center; }
        .pulseLine{
          position:relative; width:100%; height:2px; background:linear-gradient(90deg,#f9a8d4,#93c5fd);
          border-radius:999px; overflow:visible;
        }
        .beat{ position:absolute; top:-6px; width:10px; height:10px; border-radius:999px; background:#fff; opacity:.9; }
        .beat--l{ left:15%; animation:beat 1.3s infinite ease-in-out; }
        .beat--c{ left:50%; animation:beat 1.3s .2s infinite ease-in-out; }
        .beat--r{ left:82%; animation:beat 1.3s .4s infinite ease-in-out; }
        @keyframes beat{ 0%,100%{ transform:translateY(0) scale(1); } 50%{ transform:translateY(-6px) scale(1.1); } }

        /* Messages thread */
        .thread{
          position:relative; flex:1; overflow:auto; padding:12px;
          background:radial-gradient(1200px 300px at 50% 0%, rgba(236,72,153,.10), transparent),
                     linear-gradient(180deg, rgba(255,255,255,.02), rgba(0,0,0,.08));
        }
        .msg{
          position:relative;
          display:flex; margin:10px 0;
        }
        .msg.partner{ justify-content:flex-start; }
        .msg.self{ justify-content:flex-end; }
        .bubble{
          max-width:72%;
          position:relative;
          padding:10px 12px; border-radius:16px;
          background:#fff; color:#1f2937;
          box-shadow:0 4px 16px rgba(0,0,0,.12);
        }
        .msg.self .bubble{
          background:linear-gradient(90deg,#ec4899,#fb7185); color:#fff;
          border-bottom-right-radius:4px;
        }
        .msg.partner .bubble{
          background:rgba(255,255,255,.92); color:#1f2937;
          border-bottom-left-radius:4px;
        }
        .bubble__meta{ display:flex; align-items:center; justify-content:space-between; font-size:12px; opacity:.85; margin-bottom:4px; }
        .bubble__text{ line-height:1.45; word-break:break-word; }
        .file img{ max-width:180px; max-height:120px; border-radius:10px; display:block; }

        /* Reactions — Bubble Universe */
        .reactions{
          position:absolute; inset:auto auto 100% 50%;
          transform:translateX(-50%);
          display:flex; gap:6px; pointer-events:auto; padding:6px 8px;
          background:rgba(0,0,0,.06); border-radius:999px; backdrop-filter:blur(6px);
          opacity:0; transition:.2s; margin-bottom:8px;
        }
        .bubble:hover .reactions{ opacity:1; }
        .orb{
          border:none; background:transparent; cursor:pointer; font-size:16px; line-height:1;
          padding:4px 6px; border-radius:8px; transition:transform .15s;
        }
        .orb:active{ transform:scale(0.9); }
        .bubble--reacted::after{
          content:attr(data-react);
          position:absolute; right:-8px; bottom:-8px; font-size:16px;
          animation:reactPop .6s ease;
        }
        @keyframes reactPop{ 0%{ transform:scale(.3); opacity:.2 } 60%{ transform:scale(1.2); opacity:1 } 100%{ transform:scale(1); opacity:1 } }

        /* Reaction Trails — Delivered / Seen */
        .trail--pending .bubble{ box-shadow:0 0 0 0 rgba(236,72,153,0); }
        .trail--delivered .bubble{
          animation:deliveredGlow 800ms ease;
        }
        @keyframes deliveredGlow{
          0%{ box-shadow:0 0 0 0 rgba(236,72,153,0.0); }
          100%{ box-shadow:0 0 16px 2px rgba(236,72,153,.45); }
        }
        .trail--seen .bubble{
          background:linear-gradient(90deg,#f472b6,#fb7185,#f472b6);
          background-size:200% 100%;
          animation:seenAurora 1.2s ease forwards;
        }
        @keyframes seenAurora{
          0%{ background-position:0% 0%; }
          100%{ background-position:100% 0%; }
        }
        .bubble .bubble__status{
          display:flex; align-items:center; gap:6px; margin-top:6px; font-size:11px; opacity:.85;
        }
        .statusDot{
          width:8px; height:8px; border-radius:999px; background:#10b981; box-shadow:0 0 8px #10b981;
        }

        /* Composer */
        .composer{
          display:flex; align-items:center; gap:8px;
          padding:8px; border-top:1px solid rgba(255,255,255,.12);
          background:rgba(0,0,0,.04);
        }
        .icon{
          width:38px; height:38px; border-radius:999px; border:none; background:#fff; cursor:pointer;
        }
        .input{
          flex:1; padding:10px 12px; border-radius:999px; border:1px solid rgba(0,0,0,.15);
          outline:none;
        }
        .send{
          width:44px; height:44px; border-radius:999px; border:none; cursor:pointer;
          background:linear-gradient(90deg,#ec4899,#fb7185); color:#fff; font-weight:900;
        }

        /* Welcome banner */
        .welcome{
          text-align:center; padding:8px; color:#ec4899; font-weight:700;
          background:rgba(255,255,255,.6);
        }

        /* Responsive */
        @media (min-width:900px){
          .milanChat{ height:86dvh; margin-top:7dvh; }
        }
      `}</style>
    </>
  );
}

/* ---------- utils ---------- */
function escapeHTML(str) {
  return (str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function cryptoRandom() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1); crypto.getRandomValues(buf); return String(buf[0]);
  }
  return String(Math.floor(Math.random()*1e9));
}
