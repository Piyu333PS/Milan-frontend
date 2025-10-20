"use client";
import { useEffect, useRef } from "react";
import io from "socket.io-client";

export default function ChatPage() {
  const socketRef = useRef(null);
  const menuRef = useRef(null);

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
    const kebabBtn = document.getElementById("kebabBtn");

    // Session
    let partnerData = null;
    try { partnerData = JSON.parse(sessionStorage.getItem("partnerData")); } catch {}
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
    setTimeout(() => welcomeMessageEl.classList.add("isHidden"), 2500);

    // Helpers
    function formatTime() {
      const t = new Date();
      const h12 = t.getHours() % 12 || 12;
      const m = t.getMinutes().toString().padStart(2, "0");
      const ampm = t.getHours() >= 12 ? "PM" : "AM";
      return `${h12}:${m} ${ampm}`;
    }
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

    // Create one message node
    function makeMessageNode({ from, htmlContent, isSelf }) {
      const wrap = document.createElement("div");
      wrap.className = `msg ${isSelf ? "self" : "partner"} trail--pending`;

      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.innerHTML = `
        <div class="bubble__meta">
          <div class="meta__who">
            <strong class="bubble__from">${from}</strong>
            <span class="bubble__time">${formatTime()}</span>
          </div>
          <button class="reactBtn" title="React">✨</button>
        </div>
        <div class="bubble__text">${htmlContent}</div>
        <div class="bubble__status">
          <span class="statusDot"></span>
          <span class="statusText">Delivered</span>
        </div>
        <div class="reactPopover">
          <button class="reactItem">❤️</button>
          <button class="reactItem">🔥</button>
          <button class="reactItem">✨</button>
          <button class="reactItem">🌙</button>
        </div>
      `;

      // Small reaction flow
      const reactBtn = bubble.querySelector(".reactBtn");
      const pop = bubble.querySelector(".reactPopover");
      reactBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeAllPopovers();
        pop.classList.toggle("open");
      });
      bubble.querySelectorAll(".reactItem").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          bubble.setAttribute("data-react", btn.textContent);
          bubble.classList.add("bubble--reacted");
          setTimeout(() => bubble.classList.remove("bubble--reacted"), 800);
          pop.classList.remove("open");
        });
      });

      wrap.appendChild(bubble);
      messagesContainer.appendChild(wrap);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      // Trail: delivered glow
      requestAnimationFrame(() => {
        wrap.classList.remove("trail--pending");
        wrap.classList.add("trail--delivered");
      });

      return wrap;
    }

    function closeAllPopovers() {
      document.querySelectorAll(".reactPopover.open").forEach((el) => el.classList.remove("open"));
    }
    document.addEventListener("click", (e) => {
      if (!(e.target.closest && e.target.closest(".reactPopover")) &&
          !(e.target.closest && e.target.closest(".reactBtn"))) {
        closeAllPopovers();
      }
      // close kebab menu if clicked outside
      if (!(e.target.closest && e.target.closest(".kebabWrap"))) {
        document.querySelector(".kebabMenu")?.classList.remove("open");
      }
    });

    // Send text
    function sendText() {
      const text = msgInput.value.trim();
      if (!text) return;
      socket.emit("message", { text, roomCode, senderId: socket.id });
      const node = makeMessageNode({
        from: "You",
        htmlContent: escapeHTML(text),
        isSelf: true,
      });
      node.dataset.localId = cryptoRandom();
      msgInput.value = "";
      whisper("you");
    }

    function whisper(who) {
      const you = document.getElementById("youAvatar");
      const them = document.getElementById("themAvatar");
      const tgt = who === "you" ? you : them;
      tgt.classList.remove("avatar--pulse"); void tgt.offsetWidth; tgt.classList.add("avatar--pulse");
    }

    function markSeenForLastSelfMessage() {
      const nodes = messagesContainer.querySelectorAll(".msg.self.trail--delivered");
      if (!nodes.length) return;
      const last = nodes[nodes.length - 1];
      if (!last.classList.contains("trail--seen")) {
        last.classList.add("trail--seen");
        const txt = last.querySelector(".statusText");
        if (txt) txt.textContent = "Seen";
      }
    }

    // UI events
    sendBtn.addEventListener("click", sendText);
    msgInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendText(); });
    msgInput.addEventListener("input", () => socket.emit("typing", { roomCode }));

    // Kebab menu actions
    kebabBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelector(".kebabMenu")?.classList.toggle("open");
    });
    menuRef.current = document.querySelector(".kebabMenu");
    menuRef.current.querySelector(".menuReport").addEventListener("click", () => {
      alert("Partner reported.");
      socket.emit("reportPartner", { roomCode });
      document.querySelector(".kebabMenu")?.classList.remove("open");
    });
    menuRef.current.querySelector(".menuDisconnect").addEventListener("click", () => {
      socket.emit("disconnectByUser");
      socket.disconnect();
      window.location.href = "/";
    });

    // Socket listeners
    socket.on("message", (msg) => {
      if (!msg) return;
      const isSelf = msg.senderId === socket.id;
      const node = makeMessageNode({
        from: isSelf ? "You" : partnerData.name,
        htmlContent: (msg.text && escapeHTML(msg.text)) || "",
        isSelf,
      });
      if (!isSelf) {
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

    return () => { try { socket.disconnect(); } catch {} };
  }, []);

  return (
    <>
      <div className="milanChat">
        {/* Header */}
        <div className="header">
          <div className="header__left">
            <div className="avatarWrap">
              <img id="partnerAvatar" className="avatar" src="partner-avatar.png" alt="Partner"/>
            </div>
            <div className="who">
              <span id="partnerName" className="who__name">Partner</span>
              <span id="typingIndicator" className="who__typing isHidden">typing…</span>
            </div>
          </div>

          <div className="header__right kebabWrap">
            <button id="kebabBtn" className="kebabBtn" aria-haspopup="true" aria-expanded="false">⋮</button>
            <div className="kebabMenu">
              <button className="kItem menuReport">Report</button>
              <button className="kItem menuDisconnect">Disconnect</button>
            </div>
          </div>
        </div>

        {/* Avatar Whisper + Heart line */}
        <div className="whisper">
          <div className="whisper__lane">
            <img id="themAvatar" className="miniAvatar" src="partner-avatar.png" alt="Them"/>
            <div className="lane__mid">
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

        {/* Messages */}
        <div id="messages" className="thread" />

        {/* Composer */}
        <div className="composer">
          <button className="mic" title="Voice note (coming soon)">🎙️</button>
          <input id="msgInput" className="input" placeholder="Type a message…" />
          <button id="sendBtn" className="send" title="Send">➤</button>
        </div>
      </div>

      {/* SCOPED styles */}
      <style jsx>{`
        .milanChat{
          width:100%;
          max-width:820px;
          height:100dvh;
          margin:0 auto;
          display:flex; flex-direction:column;
          background:#0f172a;
          border:1px solid rgba(255,255,255,.08);
          border-radius:16px; overflow:hidden;
        }

        /* Header */
        .header{
          display:flex; align-items:center; justify-content:space-between;
          padding:10px 12px;
          background:linear-gradient(90deg,#ec4899,#fb7185);
          color:#fff;
          position:relative;
        }
        .header__left{ display:flex; align-items:center; gap:10px; }
        .avatarWrap{
          width:46px; height:46px; border-radius:999px;
          border:3px solid rgba(255,255,255,.6);
          display:flex; align-items:center; justify-content:center;
          background:rgba(255,255,255,.25);
          overflow:hidden;
        }
        .avatar{ width:100%; height:100%; object-fit:cover; border-radius:999px; }
        .who{ display:flex; flex-direction:column; line-height:1.1; }
        .who__name{ font-weight:800; font-size:14px; }
        .who__typing{ font-size:12px; opacity:.9; }
        .isHidden{ display:none; }

        /* Kebab */
        .kebabBtn{
          width:38px; height:38px; border-radius:10px; border:none;
          background:#ffffff; color:#ec4899; font-size:20px; cursor:pointer;
        }
        .kebabMenu{
          position:absolute; right:10px; top:56px;
          background:#ffffff; color:#1f2937; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.25);
          overflow:hidden; transform:scale(0.95); opacity:0; pointer-events:none; transition:.15s;
          min-width:150px;
        }
        .kebabMenu.open{ transform:scale(1); opacity:1; pointer-events:auto; }
        .kItem{
          display:block; width:100%; text-align:left; padding:10px 14px; background:#fff; border:none; cursor:pointer;
        }
        .kItem:hover{ background:#f3f4f6; }
        .menuReport{ color:#ef4444; font-weight:700; }
        .menuDisconnect{ color:#111827; }

        /* Whisper space + Heart line */
        .whisper{ padding:8px 12px; background:#0b1224; }
        .whisper__lane{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .miniAvatar{
          width:34px; height:34px; border-radius:999px; object-fit:cover; border:2px solid rgba(255,255,255,.6);
        }
        .avatar--pulse{ animation:pulse 600ms ease; }
        @keyframes pulse{ 0%{ transform:scale(1); } 50%{ transform:scale(1.12); } 100%{ transform:scale(1); } }

        .lane__mid{ flex:1; position:relative; height:38px; display:flex; align-items:center; }
        .pulseLine{
          position:relative; width:100%; height:2px; background:linear-gradient(90deg,#f9a8d4,#93c5fd);
          border-radius:999px;
        }
        .beat{ position:absolute; top:-6px; width:10px; height:10px; border-radius:999px; background:#fff; opacity:.9; }
        .beat--l{ left:15%; animation:beat 1.3s infinite ease-in-out; }
        .beat--c{ left:50%; animation:beat 1.3s .2s infinite ease-in-out; }
        .beat--r{ left:82%; animation:beat 1.3s .4s infinite ease-in-out; }
        @keyframes beat{ 0%,100%{ transform:translateY(0) scale(1); } 50%{ transform:translateY(-6px) scale(1.1); } }

        /* Messages */
        .thread{
          position:relative; flex:1; overflow:auto; padding:12px;
          background:linear-gradient(180deg,#0f172a,#0b1224);
        }
        .msg{ display:flex; margin:12px 0; }
        .msg.partner{ justify-content:flex-start; }
        .msg.self{ justify-content:flex-end; }
        .bubble{
          max-width:72%; position:relative;
          padding:10px 12px; border-radius:16px;
          background:#fff; color:#1f2937;
          box-shadow:0 4px 16px rgba(0,0,0,.12);
        }
        .msg.self .bubble{
          background:linear-gradient(90deg,#ec4899,#fb7185); color:#fff;
          border-bottom-right-radius:6px;
        }
        .msg.partner .bubble{
          background:rgba(255,255,255,.95); color:#111827;
          border-bottom-left-radius:6px;
        }
        .bubble__meta{
          display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px;
          font-size:12px; opacity:.85;
        }
        .meta__who{ display:flex; align-items:baseline; gap:10px; }
        .bubble__text{ line-height:1.45; word-break:break-word; }
        .bubble .bubble__status{ display:flex; align-items:center; gap:6px; margin-top:6px; font-size:11px; opacity:.85; }
        .statusDot{ width:8px; height:8px; border-radius:999px; background:#10b981; box-shadow:0 0 8px #10b981; }

        /* Tiny reaction button + popover */
        .reactBtn{
          border:none; background:transparent; color:inherit; cursor:pointer;
          font-size:16px; line-height:1; opacity:.9; padding:2px 6px; border-radius:8px;
        }
        .reactBtn:hover{ background:rgba(0,0,0,.06); }
        .msg.self .reactBtn:hover{ background:rgba(255,255,255,.15); }

        .reactPopover{
          position:absolute; inset:auto auto 100% 50%;
          transform:translateX(-50%) translateY(-6px) scale(.96);
          display:flex; gap:6px; padding:6px 8px; border-radius:999px;
          background:rgba(0,0,0,.7); color:#fff; backdrop-filter:blur(6px);
          opacity:0; pointer-events:none; transition:.15s;
        }
        .reactPopover.open{ opacity:1; pointer-events:auto; transform:translateX(-50%) translateY(-6px) scale(1); }
        .reactItem{
          border:none; background:transparent; cursor:pointer; font-size:16px; line-height:1;
          padding:2px 4px; border-radius:8px;
        }
        .reactItem:active{ transform:scale(.92); }

        .bubble--reacted::after{
          content:attr(data-react);
          position:absolute; right:-8px; bottom:-10px; font-size:16px;
          animation:reactPop .6s ease;
        }
        @keyframes reactPop{ 0%{ transform:scale(.3); opacity:.2 } 60%{ transform:scale(1.2); opacity:1 } 100%{ transform:scale(1); opacity:1 } }

        /* Trails */
        .trail--pending .bubble{ box-shadow:0 0 0 0 rgba(236,72,153,0); }
        .trail--delivered .bubble{ animation:deliveredGlow 800ms ease; }
        @keyframes deliveredGlow{
          0%{ box-shadow:0 0 0 0 rgba(236,72,153,0.0); }
          100%{ box-shadow:0 0 16px 2px rgba(236,72,153,.45); }
        }
        .trail--seen .bubble{
          background:linear-gradient(90deg,#f472b6,#fb7185,#f472b6);
          background-size:200% 100%;
          animation:seenAurora 1.2s ease forwards;
        }
        @keyframes seenAurora{ 0%{ background-position:0% 0%; } 100%{ background-position:100% 0%; } }

        /* Composer */
        .composer{
          display:flex; align-items:center; gap:8px;
          padding:10px; border-top:1px solid rgba(255,255,255,.08);
          background:#0b1224;
        }
        .mic{
          width:40px; height:40px; border-radius:999px; border:none; background:#111827; color:#fff; cursor:pointer;
        }
        .input{
          flex:1; padding:12px 14px; border-radius:999px; border:1px solid rgba(255,255,255,.2);
          background:#111827; color:#e5e7eb; outline:none;
        }
        .send{
          width:44px; height:44px; border-radius:999px; border:none; cursor:pointer;
          background:linear-gradient(90deg,#ec4899,#fb7185); color:#fff; font-weight:900;
        }

        /* Responsive */
        @media (min-width:900px){
          .milanChat{ height:86dvh; margin-top:7dvh; }
        }
      `}</style>
    </>
  );
}
