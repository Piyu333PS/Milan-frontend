"use client";
import { useEffect, useState } from "react";
import io from "socket.io-client";

export default function ConnectPage() {
  const [showProfile, setShowProfile] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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

      {/* Sidebar */}
      <div className="sidebar">
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

      {/* Main connect UI */}
      <div className="center-box">
        <h2>Select Connection Mode</h2>
        <div className="mode-text" id="modeText"></div>
        <button id="videoBtn">Start Video Chat</button>
        <button id="textBtn" disabled>Start Text Chat</button>
        <div className="disabled-message">💌 Text Chat on the way… Video Chat ka maza lijiye ❤️</div>

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
          z-index: 10;
          color: white;
        }
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
          justify-content: flex-start;
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

        /* Center box */
        .center-box {
          position: relative;
          margin-left: 240px;
          padding: 20px;
          text-align: center;
          color: white;
          z-index: 5;
        }
        .center-box h2 { font-size: 26px; margin-bottom: 15px; }
        .center-box button {
          margin: 10px;
          padding: 12px 20px;
          border: none;
          border-radius: 8px;
          background: #ec4899;
          color: white;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.3s;
        }
        .center-box button:hover { background: #db2777; }
        .disabled-message { font-size: 14px; margin-top: 10px; color: #eee; }
        .quote-box { margin-top: 20px; font-size: 18px; font-style: italic; }

        /* Panels */
        .panel {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255,255,255,0.95);
          padding: 30px;
          border-radius: 12px;
          z-index: 20;
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 300px;
        }
        .panel h3 { margin: 0 0 10px; }
        .panel input { padding: 10px; border: 1px solid #ccc; border-radius: 6px; }
        .panel button { padding: 10px; border: none; border-radius: 6px; background: #ec4899; color: white; font-weight: bold; cursor: pointer; }

        /* Responsive */
        @media (max-width: 768px) {
          .sidebar { width: 180px; }
          .center-box { margin-left: 0; padding-top: 120px; }
        }
      `}</style>
    </>
  );
}
