"use client";
import { useEffect, useState } from "react";

export default function HomePage() {
  const API_BASE = "https://milan-j9u9.onrender.com";
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showFireworks, setShowFireworks] = useState(true); // for initial launch fireworks

  useEffect(() => {
    // Hearts background
    const canvas = document.getElementById("heartsCanvas");
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
        size: Math.random() * 30 + 15,
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

    // Initial Fireworks (5-6 sec) for launch only
    if (showFireworks) {
      const fireworksCanvas = document.createElement("canvas");
      fireworksCanvas.id = "fireworksCanvas";
      fireworksCanvas.style.position = "fixed";
      fireworksCanvas.style.top = "0";
      fireworksCanvas.style.left = "0";
      fireworksCanvas.style.width = "100%";
      fireworksCanvas.style.height = "100%";
      fireworksCanvas.style.pointerEvents = "none";
      fireworksCanvas.style.zIndex = "9999";
      document.body.appendChild(fireworksCanvas);
      const fctx = fireworksCanvas.getContext("2d");
      fireworksCanvas.width = window.innerWidth;
      fireworksCanvas.height = window.innerHeight;

      let particles = [];
      for (let i = 0; i < 100; i++) {
        particles.push({
          x: Math.random() * fireworksCanvas.width,
          y: fireworksCanvas.height,
          vx: (Math.random() - 0.5) * 8,
          vy: Math.random() * -10 - 5,
          alpha: 1,
          color: `hsl(${Math.random() * 360}, 100%, 50%)`,
        });
      }

      const fireworkAnim = setInterval(() => {
        fctx.clearRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);
        particles.forEach(p => {
          fctx.fillStyle = p.color;
          fctx.globalAlpha = p.alpha;
          fctx.beginPath();
          fctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          fctx.fill();
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.2;
          p.alpha -= 0.02;
        });
        particles = particles.filter(p => p.alpha > 0);
        if (particles.length === 0) clearInterval(fireworkAnim);
      }, 30);

      // Remove fireworks after 5-6 seconds
      setTimeout(() => {
        document.body.removeChild(fireworksCanvas);
        setShowFireworks(false);
      }, 5500);
    }

  }, []);

  function showError(msg) {
    const errDiv = document.getElementById("errorMessage");
    if (!errDiv) return;
    errDiv.textContent = msg;
    errDiv.style.display = "block";
    setTimeout(() => {
      errDiv.style.display = "none";
    }, 4000);
  }

  // ... (rest of handleRegister, handleLogin, handleReset remain unchanged)

  return (
    <>
      <canvas id="heartsCanvas"></canvas>
      <audio id="bgMusic" loop>
        <source src="music/romantic.mp3" type="audio/mpeg" />
      </audio>

      <div id="errorMessage"></div>

      <div className="container" id="userFormContainer">
        <div className="left">
          <h1>Welcome to Milan ❤️</h1>
          {/* Special Launch + Ganesh Chaturthi Wishes */}
          <p style={{ color: "#ffd700", fontWeight: "bold", fontSize: "18px" }}>
            🌺 Shubh Ganesh Chaturthi! 🌺 <br />
            🎉 Milan officially launches today! 🎉
          </p>
          <p>
            “Love recognizes no barriers. It jumps hurdles, leaps fences, penetrates walls to arrive at its
            destination full of hope.”
          </p>
        </div>
        <div className="right">
          {/* ... existing form-container remains unchanged ... */}
        </div>
      </div>

      {/* ✅ Old UI Styles imported here (unchanged) */}
      <style jsx global>{`
        /* ... existing styles remain unchanged ... */
      `}</style>
    </>
  );
}
