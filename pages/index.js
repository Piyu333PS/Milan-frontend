"use client";
import { useEffect, useState } from "react";

export default function HomePage() {
  const API_BASE = "https://milan-j9u9.onrender.com";
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
        color: ["#ff4d6d", "#ff1c68", "#ff6b81", "#e6005c"][
          Math.floor(Math.random() * 4)
        ],
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

  function calculateAge(dateString) {
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  async function handleRegister() {
    const name = document.getElementById("name").value.trim();
    const gender = document.getElementById("gender").value;
    const contact = document.getElementById("contact").value.trim();
    const password = document.getElementById("password").value.trim();
    const dob = document.getElementById("dob").value;
    const city = document.getElementById("city").value.trim();
    const reason = document.getElementById("reason").value;
    const termsAccepted = document.getElementById("terms").checked;

    if (!name || !gender || !contact || !password || !dob || !city || !reason)
      return showError("Please fill all required fields!");

    if (!termsAccepted) {
      return showError("Please accept Terms & Conditions to continue.");
    }

    const userAge = calculateAge(dob);
    if (isNaN(userAge)) {
      return showError("Please enter a valid Date of Birth.");
    }
    if (userAge < 18) {
      return showError("Milan is strictly 18+ only.");
    }

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

  return (
    <>
      <canvas id="heartsCanvas"></canvas>
      <div id="errorMessage"></div>

      <div className="container" id="userFormContainer">
        {/* Left Side */}
        <div className="left">
          <h1>Welcome to Milan ❤️</h1>
          <p className="welcome-text">
            “Love recognizes no barriers. It jumps hurdles, leaps fences,
            penetrates walls to arrive at its destination full of hope.”
          </p>
          <p className="age-warning">🔞 Milan is strictly for 18+ users.</p>
        </div>

        {/* Right Side */}
        <div className="right">
          <div className="form-container">
            <h2>Create Your Account</h2>

            <label>Name *</label>
            <input type="text" id="name" placeholder="Your name or nickname" />

            <label>Gender *</label>
            <select id="gender">
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>

            <label>Email or Mobile *</label>
            <input type="text" id="contact" placeholder="Email or 10-digit Mobile number" />

            <label>Password *</label>
            <input type="password" id="password" placeholder="Enter password" />

            <label>Date of Birth *</label>
            <input type="date" id="dob" max={new Date().toISOString().split("T")[0]} />

            <label>City/Country *</label>
            <input type="text" id="city" placeholder="City / Country" />

            <label>Reason for Joining *</label>
            <select id="reason">
              <option value="">Select reason</option>
              <option value="Looking for Love">Looking for Love ❤️</option>
              <option value="Friendship">Friendship 🤗</option>
              <option value="Casual Chat">Casual Chat 🎈</option>
              <option value="Exploring">Exploring 🌎</option>
              <option value="Other">Other</option>
            </select>

            {/* ✅ Checkbox + Text inline fix */}
            <div className="terms-container">
              <input type="checkbox" id="terms" />
              <label htmlFor="terms">
                I agree to the{" "}
                <a href="/terms.html" target="_blank">Terms & Conditions</a>,{" "}
                <a href="/privacy.html" target="_blank">Privacy Policy</a> and{" "}
                <a href="/guidelines.html" target="_blank">Community Guidelines</a>
              </label>
            </div>

            <button onClick={handleRegister}>Register & Start</button>
            <p className="link-text" onClick={() => setShowLogin(true)}>
              Already Registered? Login here
            </p>
          </div>
        </div>
      </div>

      {/* ✅ Footer */}
      <footer className="footer-section">
        <div className="footer-links">
          <a href="/terms.html" target="_blank">Terms & Conditions</a>
          <a href="/privacy.html" target="_blank">Privacy Policy</a>
          <a href="/guidelines.html" target="_blank">Community Guidelines</a>
        </div>
        <p className="support-text">
          For any support, contact us at <span>Support@milanlove.in</span>
        </p>
      </footer>

      {/* ✅ Styles */}
      <style jsx global>{`
        :root {
          --bg-color: #1f2937;
          --text-color: #ffffff;
        }
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          font-family: "Segoe UI", sans-serif;
          background: var(--bg-color);
          color: var(--text-color);
        }
        #heartsCanvas {
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          z-index: 0;
        }
        .container {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 60px 10%;
          flex-wrap: wrap;
          min-height: calc(100vh - 80px);
          gap: 40px;
        }
        .left {
          flex: 1;
          min-width: 280px;
        }
        .left h1 {
          font-size: 32px;
          margin-bottom: 12px;
        }
        .welcome-text {
          font-size: 18px;
          margin-bottom: 20px;
        }
        .age-warning {
          font-size: 18px;
          font-weight: bold;
          margin-top: 12px;
        }
        .right {
          flex: 1;
          min-width: 320px;
          max-width: 420px;
          display: flex;
          justify-content: center;
        }
        .form-container {
          background: rgba(255,255,255,0.1);
          padding: 30px;
          border-radius: 12px;
          width: 100%;
        }
        .form-container h2 {
          text-align: center;
          margin-bottom: 20px;
          font-size: 22px;
        }
        label {
          font-size: 15px;
          font-weight: bold;
          margin-top: 10px;
          display: block;
        }
        input, select, button {
          width: 100%;
          padding: 10px;
          margin-top: 6px;
          margin-bottom: 12px;
          border: none;
          border-radius: 5px;
          font-size: 15px;
        }
        button {
          background: #fff;
          color: #ec4899;
          font-weight: bold;
          cursor: pointer;
        }
        button:hover {
          background: #ec4899;
          color: #fff;
        }
        .terms-container {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          margin: 15px 0;
        }
        .terms-container a {
          color: yellow;
        }
        .link-text {
          text-align: center;
          cursor: pointer;
          color: yellow;
          margin-top: 10px;
        }
        .footer-section {
          position: fixed;
          bottom: 10px;
          left: 0;
          width: 100%;
          text-align: center;
          z-index: 5;
        }
        .footer-links {
          display: flex;
          justify-content: center;
          gap: 25px;
          margin-bottom: 6px;
          flex-wrap: wrap;
        }
        .footer-links a {
          color: yellow;
          text-decoration: none;
          font-size: 15px;
        }
        .support-text {
          font-size: 14px;
          color: #ddd;
        }
        .support-text span {
          color: yellow;
          font-weight: bold;
        }
        @media(max-width: 768px) {
          .container {
            flex-direction: column;
            align-items: center;
            padding: 30px 20px;
          }
          .left, .right {
            text-align: center;
          }
        }
      `}</style>
    </>
  );
}
