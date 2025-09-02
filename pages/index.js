"use client";
import { useEffect, useState } from "react";

// ----------------- AGE GATE COMPONENT -----------------
function AgeGate({ onPass }) {
  const [dob, setDob] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  function calculateAge(dob) {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!dob) {
      setError("Please enter your Date of Birth.");
      return;
    }
    if (!confirmed) {
      setError("You must confirm to proceed.");
      return;
    }
    const age = calculateAge(dob);
    if (age < 18) {
      setError("Sorry, Milan is only available for 18+ users.");
    } else {
      localStorage.setItem("ageVerified", "true");
      onPass();
    }
  }

  return (
    <div className="age-gate">
      <h2>🔞 Age Verification</h2>
      <p>Milan is for users aged 18 and above only.</p>
      <form onSubmit={handleSubmit}>
        <label>Date of Birth:</label>
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />

        <div style={{ marginTop: "10px" }}>
          <input
            type="checkbox"
            id="confirm"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <label htmlFor="confirm" style={{ marginLeft: "8px" }}>
            I confirm that I am 18+ years old.
          </label>
        </div>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <button type="submit">Enter Milan</button>
      </form>

      <style jsx>{`
        .age-gate {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          z-index: 99999;
          padding: 20px;
          text-align: center;
        }
        .age-gate form {
          margin-top: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
          max-width: 300px;
        }
        .age-gate input,
        .age-gate button {
          padding: 10px;
          border-radius: 6px;
          border: none;
          font-size: 16px;
        }
        .age-gate input[type="date"] {
          background: #fff;
          color: #000;
        }
        .age-gate button {
          background: #ff0066;
          color: #fff;
          cursor: pointer;
          font-weight: bold;
        }
        .age-gate button:hover {
          background: #e6005c;
        }
      `}</style>
    </div>
  );
}

// ----------------- MAIN APP -----------------
export default function HomePage() {
  const API_BASE = "https://milan-j9u9.onrender.com";
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("ageVerified") === "true") {
      setAgeVerified(true);
    }
  }, []);

  // ----------------- HEARTS BACKGROUND -----------------
  useEffect(() => {
    if (!ageVerified) return;
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
        size: Math.random() * 30 + 15,
        speed: Math.random() * 1.5 + 0.5,
        color: ["#ff4d6d", "#ff1c68", "#ff6b81", "#e6005c"][Math.floor(Math.random() * 4)],
      };
    }

    function drawHearts() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hearts.forEach((h) => {
        ctx.fillStyle = h.color;
        ctx.beginPath();
        ctx.moveTo(h.x, h.y);
        ctx.bezierCurveTo(
          h.x + h.size / 2,
          h.y - h.size,
          h.x + h.size * 1.5,
          h.y + h.size / 3,
          h.x,
          h.y + h.size
        );
        ctx.bezierCurveTo(
          h.x - h.size * 1.5,
          h.y + h.size / 3,
          h.x - h.size / 2,
          h.y - h.size,
          h.x,
          h.y
        );
        ctx.fill();
        h.y -= h.speed;
      });
      hearts = hearts.filter((h) => h.y + h.size > 0);
      if (Math.random() < 0.1) hearts.push(createHeart());
      requestAnimationFrame(drawHearts);
    }
    drawHearts();
  }, [ageVerified]);

  // ----------------- ERROR HANDLER -----------------
  function showError(msg) {
    const errDiv = document.getElementById("errorMessage");
    if (!errDiv) return;
    errDiv.textContent = msg;
    errDiv.style.display = "block";
    setTimeout(() => {
      errDiv.style.display = "none";
    }, 4000);
  }

  // ----------------- API HANDLERS -----------------
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
        body: JSON.stringify({ emailOrMobile: contact, password, name }),
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
        body: JSON.stringify({ emailOrMobile: contact, password }),
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
        body: JSON.stringify({ emailOrMobile: contact, password: newPassword }),
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

  // ----------------- RENDER -----------------
  if (!ageVerified) {
    return <AgeGate onPass={() => setAgeVerified(true)} />;
  }

  return (
    <>
      {/* your original JSX remains unchanged here */}
      <canvas id="heartsCanvas"></canvas>
      <audio id="bgMusic" loop>
        <source src="music/romantic.mp3" type="audio/mpeg" />
      </audio>
      <div id="errorMessage"></div>
      {/* 🎉 Banner */}
      <div className="banner">
        <h2>🌺 Ganesh Chaturthi ki Shubhkamnaye! 🌺</h2>
        <p>✨ Milan is Live! Let your hearts connect… ❤️</p>
      </div>
      {/* ---- container, forms, reset, CSS etc. (unchanged from your code) ---- */}
      {/* 👇 Paste the rest of your original JSX here (no changes needed) */}
    </>
  );
}
