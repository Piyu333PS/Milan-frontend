"use client";
import { useEffect, useState } from "react";
import io from "socket.io-client";

export default function ConnectPage() {
  const [showProfile, setShowProfile] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // ✅ mobile toggle

  // ❤️ Hearts + Socket effect
  useEffect(() => {
    const canvas = document.getElementById("heartCanvas");
    const ctx = canvas.getContext("2d");
    let hearts = [];

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    function createHeart() {
      return {
        x: Math.random() * canvas.width,
        y: canvas.height + 50,
        size: Math.random() * 20 + 10,
        speed: Math.random() * 1.5 + 0.5,
        color: ["#ff4d6d", "#ff1c68", "#ff6b81", "#e6005c"][Math.floor(Math.random() * 4)]
      };
    }

    function drawHearts() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hearts.forEach(h => {
        ctx.fillStyle = h.color;
        ctx.beginPath();
        ctx.moveTo(h.x, h.y);
        ctx.bezierCurveTo(h.x + h.size / 2, h.y - h.size, h.x + h.size * 1.5, h.y + h.size / 3, h.x, h.y + h.size);
        ctx.bezierCurveTo(h.x - h.size * 1.5, h.y + h.size / 3, h.x - h.size / 2, h.y - h.size, h.x, h.y);
        ctx.fill();
        h.y -= h.speed;
      });
      hearts = hearts.filter(h => h.y + h.size > 0);
      if (Math.random() < 0.1) hearts.push(createHeart());
      requestAnimationFrame(drawHearts);
    }
    drawHearts();

    // Socket logic
    let socket = null;
    let currentMode = null;

    const textBtn = document.getElementById("textBtn");
    const videoBtn = document.getElementById("videoBtn");
    const loader = document.getElementById("loader");
    const statusMessage = document.getElementById("statusMessage");
    const stopBtn = document.getElementById("stopBtn");
    const modeText = document.getElementById("modeText");
    const quoteBox = document.getElementById("quoteBox");

    const quotes = [
      "❤️ Love recognizes no barriers. – Maya Angelou",
      "❤️ इश्क़ वो नहीं जो दुनिया को दिखाया जाए, इश्क़ वो है जो दिल से निभाया जाए।",
      "❤️ In dreams and in love there are no impossibilities.",
      "❤️ सच्चा प्यार वही है, जो खामोशी में भी एहसास करे।",
      "❤️ Love is composed of a single soul inhabiting two bodies. – Aristotle",
      "❤️ मोहब्बत एक खामोश दुआ है, जिसे सिर्फ़ दिल से महसूस किया जाता है।"
    ];

    function stopSearch() {
      if (socket) {
        socket.emit("disconnectByUser");
        socket.disconnect();
        socket = null;
      }
      loader.style.display = "none";
      modeText.textContent = "";
      statusMessage.innerHTML = "";
      quoteBox.innerHTML = `❤️ जहाँ दिल मिले, वहीं होती है शुरुआत Milan की… 
        <br>
        <span style="font-size:16px; display:block; margin-top:5px;">
          (Where hearts meet, that’s where Milan begins…)
        </span>`;
      stopBtn.style.display = "none";
      videoBtn.style.display = "inline-block";
      textBtn.style.display = "inline-block";
    }

    function startSearch(type) {
      if (socket) {
        socket.disconnect();
        socket = null;
      }

      currentMode = type;
      loader.style.display = "block";
      modeText.textContent = `Mode Selected: ${type === "text" ? "Text Chat" : "Video Chat"}`;
      statusMessage.innerHTML = `❤️ Waiting for Milan...`;
      stopBtn.style.display = "inline-block";
      videoBtn.style.display = "none";
      textBtn.style.display = "none";

      const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
      quoteBox.textContent = randomQuote;

      socket = io("https://milan-j9u9.onrender.com");
      const token = localStorage.getItem("token");
      socket.emit("lookingForPartner", { type, token });

      socket.on("partnerFound", (data) => {
        const partner = data.partner || {};
        const safePartner = {
          name: partner.name || "Romantic Stranger",
          age: partner.age || null,
          city: partner.city || null,
          country: partner.country || null,
          socketId: partner.socketId || data.partnerId || null
        };

        sessionStorage.setItem("partnerData", JSON.stringify(safePartner));
        sessionStorage.setItem("roomCode", data.roomCode || "");

        statusMessage.innerHTML = `💖 Milan Successful!`;

        setTimeout(() => {
          if (type === "video") {
            window.location.href = "/video";
          } else {
            window.location.href = "chat.html";
          }
        }, 1500);
      });

      socket.on("partnerDisconnected", () => {
        alert("Partner disconnected.");
        stopSearch();
      });
    }

    videoBtn.addEventListener("click", () => startSearch("video"));
    stopBtn.addEventListener("click", stopSearch);

    return () => {
      if (socket) socket.disconnect();
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  // ✅ Logout confirm handler
  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/";
  };

  return (
    <>
      <canvas id="heartCanvas"></canvas>

      {/* Hamburger (only mobile visible) */}
      <div className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
        ☰
      </div>

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="profile-pic">M</div>
        <div className="username">My Name</div>
        <ul>
          <li onClick={() => { setShowProfile(true); setShowSecurity(false); }}>
            <span>👤</span> <span>Profile Info</span>
          </li>
          <li onClick={() => { setShowSecurity(true); setShowProfile(false); }}>
            <span>🔒</span> <span>Security</span>
          </li>
          <li onClick={() => setShowLogoutConfirm(true)}>
            <span>🚪</span> <span>Logout</span>
          </li>
        </ul>
      </div>

      {/* Content area that fills the remaining space after sidebar */}
      <div className="content-wrap">
        {/* Centered Glass Box */}
        <div className="glass-card">
          <div className="center-box">
            <h2>Select Connection Mode</h2>
            <div className="mode-text" id="modeText"></div>

            <div className="btn-row">
              <button id="videoBtn">Start Video Chat</button>
              <button id="textBtn" disabled>Start Text Chat</button>
            </div>
            <div className="disabled-message">
              💌 Text Chat on the way… Video Chat ka maza lijiye ❤️
            </div>

            <div className="loader" id="loader">
              <div className="heart-loader" id="statusMessage"></div>
            </div>
            <button id="stopBtn" style={{ display: "none" }}>Stop Searching</button>

            <div className="quote-box" id="quoteBox">
              ❤️ जहाँ दिल मिले, वहीं होती है शुरुआत Milan की… <br />
              <span style={{ fontSize: "16px", display: "block", marginTop: "5px" }}>
                (Where hearts meet, that’s where Milan begins…)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Panels */}
      {showProfile && (
        <div className="panel">
          <h3>Personal Info</h3>
          <input placeholder="Full Name" />
          <input placeholder="Email or Mobile" />
          <button>Save</button>
        </div>
      )}
      {showSecurity && (
        <div className="panel">
          <h3>Security</h3>
          <input type="password" placeholder="Current Password" />
          <input type="password" placeholder="New Password" />
          <button>Save</button>
        </div>
      )}
      {showLogoutConfirm && (
        <div className="panel">
          <p>Do you want to Logout?</p>
          <label><input type="radio" name="logout" onClick={handleLogout}/> Yes</label>
          <label><input type="radio" name="logout" onClick={() => setShowLogoutConfirm(false)} /> No</label>
        </div>
      )}

      <style jsx global>{`
        body, html {
          margin: 0;
          padding: 0;
          height: 100%;
          font-family: 'Poppins', sans-serif;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          overflow: hidden;
        }
        canvas { position: fixed; top: 0; left: 0; z-index: 0; }

        /* Hamburger */
        .hamburger {
          display: none;
          position: fixed;
          top: 15px;
          left: 15px;
          font-size: 26px;
          color: white;
          z-index: 20;
          cursor: pointer;
          background: rgba(0,0,0,0.3);
          padding: 8px 12px;
          border-radius: 6px;
          user-select: none;
        }

        /* Sidebar */
        .sidebar {
          position: fixed;
          top: 0;
          left: 0;
          width: 220px;
          height: 100%;
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(12px);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 40px;
          z-index: 15;
          color: white;
          transition: transform 0.3s ease;
        }
        .sidebar.open { transform: translateX(0); }
        .profile-pic {
          width: 70px;
          height: 70px;
          border-radius: 50%;
          background: #ec4899;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .username { margin-bottom: 30px; font-size: 18px; font-weight: 600; }
        .sidebar ul { list-style: none; padding: 0; width: 100%; }
        .sidebar li {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          margin: 8px 15px;
          background: rgba(255,255,255,0.15);
          border-radius: 10px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.3s;
        }
        .sidebar li:hover {
          background: rgba(255,255,255,0.3);
          transform: translateX(5px);
        }

        /* Content area (fills remaining space besides sidebar) */
        .content-wrap {
          position: fixed;
          top: 0;
          left: 220px;           /* equal to sidebar width on desktop */
          right: 0;
          bottom: 0;
          display: grid;         /* easy centering */
          place-items: center;   /* vertical + horizontal center */
          padding: 24px;
          z-index: 5;
        }

        /* Big transparent glass box */
        .glass-card {
          width: min(100%, 1100px);           /* cap width */
          height: min(88vh, 820px);           /* nice height – not too tall */
          background: rgba(255,255,255,0.14); /* transparent box */
          border: 2px solid rgba(255,255,255,0.28);
          border-radius: 24px;
          backdrop-filter: blur(18px);
          box-shadow: 0 10px 40px rgba(0,0,0,0.25), inset 0 0 60px rgba(255,255,255,0.08);
          display: grid;
          place-items: center;                /* center inner content */
          padding: 32px;
        }

        /* Inner content */
        .center-box {
          width: 100%;
          max-width: 820px;
          color: #fff;
          text-align: center;
        }
        .center-box h2 {
          font-size: 40px;
          margin-bottom: 20px;
          font-weight: 700;
          text-shadow: 0 0 10px #ec4899;
        }
        .mode-text {
          font-size: 20px;
          margin: 6px 0 18px;
          font-weight: 600;
          color: #ffe4f1;
        }
        .btn-row {
          display: flex;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .center-box button {
          margin: 0;
          padding: 16px 36px;
          border: none;
          border-radius: 12px;
          font-size: 18px;
          background: #fff;
          color: #ec4899;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
        }
        .center-box button:hover:enabled {
          background: #ec4899;
          color: #fff;
          transform: translateY(-2px);
          box-shadow: 0 10px 18px rgba(236,72,153,0.35);
        }
        .center-box button:disabled {
          background: rgba(255,255,255,0.45);
          color: rgba(255,255,255,0.85);
          cursor: not-allowed;
        }
        .disabled-message {
          font-size: 14px;
          margin-top: 10px;
          color: #ffe4f1;
          font-style: italic;
        }

        .loader { display: none; margin: 20px auto; }
        .heart-loader {
          font-size: 36px;
          animation: blink 1s infinite;
          color: #fff;
        }
        @keyframes blink {
          0% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
          100% { opacity: 0.2; transform: scale(1); }
        }
        #stopBtn {
          background: #ff4d4f;
          color: #fff;
          margin: 18px auto 0;
          padding: 12px 32px;
          font-size: 16px;
          display: none;
          border-radius: 10px;
        }
        #statusMessage {
          margin-top: 16px;
          font-size: 24px;
          font-weight: bold;
          min-height: 34px;
          text-shadow: 0 0 10px #fff;
        }
        .quote-box {
          margin: 22px auto 0;
          font-size: 18px;
          font-weight: 600;
          color: #ffeff7;
          text-shadow: 0 0 5px #ff88aa;
          padding: 16px 18px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255,255,255,0.28);
          backdrop-filter: blur(10px);
          width: 100%;
        }

        /* Panels */
        .panel {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255,255,255,0.95);
          padding: 30px;
          border-radius: 12px;
          z-index: 30;
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 320px;
        }
        .panel h3 { margin: 0 0 10px; }
        .panel input { padding: 10px; border: 1px solid #ccc; border-radius: 6px; }
        .panel button { padding: 10px; border: none; border-radius: 6px; background: #ec4899; color: white; font-weight: bold; cursor: pointer; }

        /* Responsive */
        @media (max-width: 1024px) {
          .glass-card {
            width: min(100%, 960px);
            height: min(86vh, 760px);
          }
        }
        @media (max-width: 768px) {
          .hamburger { display: block; }
          .sidebar {
            transform: translateX(-100%);
            width: 200px;
          }
          .sidebar.open { transform: translateX(0); }

          /* Content takes full width on mobile */
          .content-wrap {
            left: 0;            /* no fixed space for sidebar on mobile */
            padding: 16px;
          }
          .glass-card {
            width: 100%;
            height: auto;
            min-height: 72vh;   /* mobile par bhi achchi height */
            padding: 22px;
            border-radius: 20px;
          }
          .center-box h2 { font-size: 30px; }
          .quote-box { font-size: 16px; }
        }
      `}</style>
    </>
  );
}
