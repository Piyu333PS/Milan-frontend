"use client";
import { useEffect, useState } from "react";

export default function HomePage() {
  const API_BASE = "https://milan-j9u9.onrender.com";
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showReset, setShowReset] = useState(false);

  // ✅ Curtain overlay state
  const [showCurtain, setShowCurtain] = useState(false);

  useEffect(() => {
    // Date check: 27 August 2025 only
    const today = new Date();
    if (
      today.getDate() === 27 &&
      today.getMonth() + 1 === 8 &&
      today.getFullYear() === 2025
    ) {
      setShowCurtain(true);
      setTimeout(() => {
        setShowCurtain(false);
      }, 4000); // 4s later curtain hides
    }
  }, []);

  useEffect(() => {
    // Hearts background animation (unchanged)
    const canvas = document.getElementById("heartsCanvas");
    if (!canvas) return;
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
        size: Math.random() * 30 + 12,
        speed: Math.random() * 1.5 + 0.6,
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
      if (Math.random() < 0.08) hearts.push(createHeart());
      requestAnimationFrame(drawHearts);
    }
    drawHearts();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  function showError(msg) {
    const errDiv = document.getElementById("errorMessage");
    if (!errDiv) return;
    errDiv.textContent = msg;
    errDiv.style.display = "block";
    setTimeout(() => {
      errDiv.style.display = "none";
    }, 3500);
  }

  async function handleRegister() {
    const name = document.getElementById("name").value?.trim();
    const gender = document.getElementById("gender").value;
    const contact = document.getElementById("contact").value?.trim();
    const password = document.getElementById("password").value?.trim();
    const age = document.getElementById("age").value?.trim();
    const city = document.getElementById("city").value?.trim();
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
    } catch (err) {
      console.error(err);
      showError("Server error");
    }
  }

  async function handleLogin() {
    const contact = document.getElementById("loginContact").value?.trim();
    const password = document.getElementById("loginPassword").value?.trim();
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
      } else showError(data.error || "Login failed");
    } catch {
      showError("Server error");
    }
  }

  async function handleReset() {
    const contact = document.getElementById("resetContact").value?.trim();
    const newPassword = document.getElementById("newPassword").value?.trim();
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

  // Theme toggle helper
  useEffect(() => {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;
    const updateLabel = () => {
      const isLight = document.body.classList.contains("light-mode");
      btn.textContent = isLight ? "🌞 Light Mode" : "🌙 Dark Mode";
    };
    updateLabel();
    const observer = new MutationObserver(updateLabel);
    observer.observe(document.body, { attributes: true });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* ✅ Curtain overlay for Ganesh Chaturthi Launch */}
      {showCurtain && (
        <div className="curtain-overlay">
          <div className="curtain-content">
            <img src="/ganesh.png" alt="Ganesh Ji" className="ganesh-img" />
            <h1>🙏 Happy Ganesh Chaturthi 🙏</h1>
            <p>
              With Bappa’s blessings, we launch <strong>Milan</strong> today ❤️
            </p>
          </div>
        </div>
      )}

      <canvas id="heartsCanvas" />

      <audio id="bgMusic" loop>
        <source src="music/romantic.mp3" type="audio/mpeg" />
      </audio>

      <div id="errorMessage" />

      {/* Decorative bandanwar */}
      <div className="bandanwar" aria-hidden="true">
        <div className="bandanwar-string">
          {[...Array(13)].map((_, i) => (
            <span key={i} className="bandanwar-bead" style={{ left: `${6 + i * 7}%` }} />
          ))}
        </div>
      </div>

      {/* Main existing homepage content here */}
      <div className="container">
        {/* ... existing left + right content unchanged ... */}
      </div>

      {/* Styles */}
      <style jsx global>{`
        /* Curtain overlay */
        .curtain-overlay {
          position: fixed;
          inset: 0;
          background: linear-gradient(135deg, #ffdde1, #ee9ca7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeOut 4s forwards;
        }
        .curtain-content {
          text-align: center;
          color: #b71c1c;
        }
        .ganesh-img {
          width: 120px;
          height: 120px;
          margin: 0 auto 12px auto;
          animation: bounce 1.5s infinite;
        }
        @keyframes bounce {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes fadeOut {
          0% { opacity: 1; }
          90% { opacity: 1; }
          100% { opacity: 0; visibility: hidden; }
        }
      `}</style>
    </>
  );
}
