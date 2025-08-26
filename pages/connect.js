"use client";
import { useEffect } from "react";
import io from "socket.io-client";

export default function ConnectPage() {
  useEffect(() => {
    // ❤️ Hearts background
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

    // ❤️ Socket.io logic
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

      // ✅ Connect to backend
      socket = io("https://milan-j9u9.onrender.com");
      const token = localStorage.getItem("token");
      socket.emit("lookingForPartner", { type, token });

      socket.on("partnerFound", (data) => {
        console.log("✅ Partner found:", data);
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

  return (
    <>
      <canvas id="heartCanvas"></canvas>
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

      {/* ✅ Old UI Styles */}
      <style jsx global>{`
        body, html {
          margin: 0;
          padding: 0;
          height: 100%;
          font-family: 'Poppins', sans-serif;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          overflow: hidden;
        }
        .center-box {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255, 255, 255, 0.15);
          padding: 80px 60px;
          border-radius: 30px;
          text-align: center;
          backdrop-filter: blur(20px);
          color: #fff;
          width: 650px;
          max-width: 95%;
          box-shadow: 0 0 30px rgba(255, 255, 255, 0.2);
          border: 2px solid rgba(255,255,255,0.3);
          animation: glowBox 3s infinite alternate;
        }
        @keyframes glowBox {
          from { box-shadow: 0 0 30px rgba(255, 255, 255, 0.2); border-color: rgba(255,255,255,0.3);}
          to   { box-shadow: 0 0 60px rgba(255, 255, 255, 0.5); border-color: rgba(255,255,255,0.6);}
        }
        .center-box h2 {
          font-size: 40px;
          margin-bottom: 30px;
          font-weight: 700;
          text-shadow: 0 0 10px #ec4899;
        }
        .mode-text {
          font-size: 22px;
          margin: 15px 0;
          font-weight: bold;
          color: #ffe4f1;
        }
        .quote-box {
          margin: 30px 0;
          font-size: 20px;
          font-weight: bold;
          color: #ffeff7;
          text-shadow: 0 0 5px #ff88aa;
          padding: 20px;
          border-radius: 15px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255,255,255,0.3);
          backdrop-filter: blur(10px);
        }
        .center-box button {
          margin: 15px;
          padding: 20px 50px;
          border: none;
          border-radius: 12px;
          font-size: 20px;
          background: #fff;
          color: #ec4899;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s;
        }
        .center-box button:hover:enabled {
          background: #ec4899;
          color: #fff;
          transform: scale(1.05);
          box-shadow: 0 0 15px #fff;
        }
        .center-box button:disabled {
          background: rgba(255,255,255,0.4);
          color: rgba(255,255,255,0.8);
          cursor: not-allowed;
        }
        .disabled-message {
          font-size: 16px;
          margin-top: -10px;
          margin-bottom: 15px;
          color: #ffe4f1;
          font-style: italic;
        }
        .loader { display: none; margin: 20px auto; }
        .heart-loader {
          font-size: 40px;
          animation: blink 1s infinite;
          color: #fff;
        }
        @keyframes blink {
          0% { opacity: 0.2; transform: scale(1);}
          50% { opacity: 1; transform: scale(1.3);}
          100% { opacity: 0.2; transform: scale(1);}
        }
        #stopBtn {
          background: #ff4d4f;
          color: #fff;
          margin-top: 30px;
          padding: 14px 40px;
          font-size: 18px;
          display: none;
          border-radius: 12px;
        }
        #statusMessage {
          margin-top: 25px;
          font-size: 28px;
          font-weight: bold;
          min-height: 40px;
          text-shadow: 0 0 10px #fff;
        }
        canvas {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 0;
        }
      `}</style>
    </>
  );
}
