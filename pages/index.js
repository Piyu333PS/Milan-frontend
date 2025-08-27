"use client";
import { useEffect, useState } from "react";

export default function HomePage() {
  const API_BASE = "https://milan-j9u9.onrender.com";
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
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

  async function handleRegister() {
    const name = document.getElementById("name").value.trim();
    const gender = document.getElementById("gender").value;
    const contact = document.getElementById("contact").value.trim();
    const password = document.getElementById("password").value.trim();
    const age = document.getElementById("age").value.trim();
    const city = document.getElementById("city").value.trim();
    const reason = document.getElementById("reason").value;
    if (!name || !gender || !contact || !password || !age || !city || !reason)
      return showError("Please fill all required fields!");

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrMobile: contact, password, name })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        window.location.href = "/connect";
      } else showError(data.error || "Registration failed");
    } catch {
      showError("Server error");
    }
  }

  async function handleLogin() {
    const contact = document.getElementById("loginContact").value.trim();
    const password = document.getElementById("loginPassword").value.trim();
    if (!contact || !password) return showError("Enter Email/Mobile and Password");

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrMobile: contact, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        window.location.href = "/connect";
      } else {
        showError(data.error || "Login failed");
      }
    } catch {
      showError("Server error");
    }
  }

  async function handleReset() {
    const contact = document.getElementById("resetContact").value.trim();
    const newPassword = document.getElementById("newPassword").value.trim();
    if (!contact || !newPassword) return showError("Fill all fields");

    try {
      const res = await fetch(`${API_BASE}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrMobile: contact, password: newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Password reset successful, please login again.");
        setShowReset(false);
        setShowLogin(true);
      } else showError(data.error || "Reset failed");
    } catch {
      showError("Server error");
    }
  }

  return (
    <>
      <canvas id="heartsCanvas"></canvas>
      <audio id="bgMusic" loop>
        <source src="music/romantic.mp3" type="audio/mpeg" />
      </audio>
      <div id="errorMessage"></div>

      <div className="container">
        <div className="left">
          {/* Welcome Message at Top */}
          <div className="welcome-message">
            <h1>Welcome to Milan ❤️</h1>
            <p>
              “Love recognizes no barriers. It jumps hurdles, leaps fences, penetrates walls to arrive at its
              destination full of hope.”
            </p>
          </div>

          {/* Ganesh Banner Below */}
          <div className="ganesh-banner-new">
            <img src="/images/ganesh.png" alt="Ganesh Ji" className="ganesh-img-large" />
            <div className="ganesh-text-large">
              <h2>गणेश चतुर्थी की हार्दिक शुभकामनाएं!</h2>
              <p>✨ Milan is Live! Let your hearts connect… ❤️</p>
            </div>
          </div>
        </div>

        <div className="right">
          {/* Same registration/login form */}
          <div className="form-container">
            {/* ... Keep your existing login/register/reset forms here ... */}
            {/* I’ve skipped re-pasting them here to save space, since they’re unchanged */}
          </div>
        </div>
      </div>

      <style jsx global>{`
        /* ... your existing global styles ... */
        .welcome-message {
          margin-bottom: 25px;
        }
        .welcome-message h1 {
          font-size: 28px;
          margin-bottom: 10px;
        }
        .welcome-message p {
          font-size: 16px;
          line-height: 1.5;
        }
        .ganesh-banner-new {
          background: rgba(255, 255, 255, 0.15);
          padding: 20px;
          border-radius: 20px;
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          gap: 20px;
          animation: fadeInPulse 2s ease-in-out infinite alternate;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
          justify-content: flex-start;
        }
        .ganesh-img-large {
          width: 70px;
          height: 70px;
          object-fit: contain;
        }
        .ganesh-text-large h2 {
          margin: 0;
          font-size: 20px;
          color: var(--text-color);
        }
        .ganesh-text-large p {
          margin: 5px 0 0 0;
          font-size: 16px;
          color: var(--text-color);
        }
        @keyframes fadeInPulse {
          0% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0.8; transform: scale(1); }
        }
      `}</style>
    </>
  );
}
