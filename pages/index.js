"use client";
import { useEffect, useState } from "react";

export default function HomePage() {
  const API_BASE = "https://milan-j9u9.onrender.com";
  const [showLogin, setShowLogin] = useState(false);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
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
        size: Math.random() * 32 + 14,
        speed: Math.random() * 1.6 + 0.6,
        color: ["#ff4d6d", "#ff1c68", "#ff6b81", "#e6005c"][
          Math.floor(Math.random() * 4)
        ],
        rot: Math.random() * Math.PI * 2,
      };
    }

    function drawHearts() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hearts.forEach((h) => {
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.rotate((Math.sin(h.y / 50) * Math.PI) / 180);
        ctx.fillStyle = h.color;
        ctx.beginPath();
        // heart shape (path relative)
        const s = h.size;
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(s / 2, -s, s * 1.5, s / 3, 0, s);
        ctx.bezierCurveTo(-s * 1.5, s / 3, -s / 2, -s, 0, 0);
        ctx.fill();
        ctx.restore();
        h.y -= h.speed;
      });
      hearts = hearts.filter((h) => h.y + h.size > -50);
      if (Math.random() < 0.12) hearts.push(createHeart());
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

  async function handleLogin() {
    const contact = document.getElementById("loginContact").value.trim();
    const password = document.getElementById("loginPassword").value.trim();
    if (!contact || !password)
      return showError("Enter Email/Mobile and Password");

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

  return (
    <>
      <canvas id="heartsCanvas"></canvas>

      <div id="errorMessage" style={{ display: "none" }}></div>

      <div className="page-wrap">
        <div className="container">
          <div className="left">
            <div className="welcome-box">
              <div className="welcome-row">
                <h1 className="welcome-title">Welcome to Milan</h1>
                <span className="pulse-heart" aria-hidden="true">❤</span>
              </div>

              <p className="welcome-text">
                “Love recognizes no barriers. It jumps hurdles, leaps fences,
                penetrates walls to arrive at its destination full of hope.”
              </p>
              <p className="age-note">🔞 Milan is strictly for 18+ users.</p>
            </div>
          </div>

          <div className="right">
            <div className="form-container" role="region" aria-label="Signup form">
              {!showLogin && !showReset && (
                <div id="registerForm">
                  <h2>Create Your Account</h2>
                  <label>
                    Name <span className="star">*</span>
                  </label>
                  <input type="text" id="name" placeholder="Your name or nickname" />
                  <label>
                    Gender <span className="star">*</span>
                  </label>
                  <select id="gender">
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  <label>
                    Email or Mobile <span className="star">*</span>
                  </label>
                  <input
                    type="text"
                    id="contact"
                    placeholder="Email or 10-digit Mobile number"
                  />
                  <label>
                    Password <span className="star">*</span>
                  </label>
                  <input type="password" id="password" placeholder="Enter password" />
                  <label>
                    Date of Birth <span className="star">*</span>
                  </label>
                  <input
                    type="date"
                    id="dob"
                    max={new Date().toISOString().split("T")[0]}
                  />
                  <label>
                    City/Country <span className="star">*</span>
                  </label>
                  <input type="text" id="city" placeholder="City / Country" />
                  <label>
                    Reason for Joining <span className="star">*</span>
                  </label>
                  <select
                    id="reason"
                    onChange={(e) =>
                      (document.getElementById("otherReason").style.display =
                        e.target.value === "Other" ? "block" : "none")
                    }
                  >
                    <option value="">Select reason</option>
                    <option value="Looking for Love">Looking for Love ❤️</option>
                    <option value="Friendship">Friendship 🤗</option>
                    <option value="Casual Chat">Casual Chat 🎈</option>
                    <option value="Exploring">Exploring 🌎</option>
                    <option value="Other">Other</option>
                  </select>
                  <textarea
                    id="otherReason"
                    placeholder="If other, please describe"
                    style={{ display: "none" }}
                  />
                  <div className="terms-container">
                    <input type="checkbox" id="terms" />
                    <label htmlFor="terms">
                      I agree to the{" "}
                      <a href="/terms.html" target="_blank" rel="noreferrer">
                        Terms & Conditions
                      </a>
                      ,{" "}
                      <a href="/privacy.html" target="_blank" rel="noreferrer">
                        Privacy Policy
                      </a>{" "}
                      and{" "}
                      <a href="/guidelines.html" target="_blank" rel="noreferrer">
                        Community Guidelines
                      </a>
                    </label>
                  </div>
                  <button onClick={handleRegister}>Register & Start</button>
                  <p className="link-text" onClick={() => setShowLogin(true)}>
                    Already Registered? Login here
                  </p>
                </div>
              )}

              {showLogin && !showReset && (
                <div id="loginForm">
                  <h2>Login to Milan</h2>
                  <label>Email or Mobile</label>
                  <input
                    type="text"
                    id="loginContact"
                    placeholder="Enter Email/Mobile"
                  />
                  <label>Password</label>
                  <input
                    type="password"
                    id="loginPassword"
                    placeholder="Enter password"
                  />
                  <button onClick={handleLogin}>Login</button>
                  <p className="link-text" onClick={() => setShowLogin(false)}>
                    New User? Register here
                  </p>
                  <p className="reset-link" onClick={() => setShowReset(true)}>
                    Forgot Password?
                  </p>
                </div>
              )}

              {showReset && (
                <div id="resetForm">
                  <h2>Reset Password</h2>
                  <label>Email or Mobile</label>
                  <input
                    type="text"
                    id="resetContact"
                    placeholder="Enter your Email/Mobile"
                  />
                  <label>New Password</label>
                  <input
                    type="password"
                    id="newPassword"
                    placeholder="Enter new password"
                  />
                  <button onClick={handleReset}>Reset Password</button>
                  <p
                    className="link-text"
                    onClick={() => {
                      setShowReset(false);
                      setShowLogin(true);
                    }}
                  >
                    Back to Login
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="footer-section">
          <div className="footer-links">
            <a href="/terms.html" target="_blank" rel="noreferrer">
              Terms & Conditions
            </a>
            <a href="/privacy.html" target="_blank" rel="noreferrer">
              Privacy Policy
            </a>
            <a href="/guidelines.html" target="_blank" rel="noreferrer">
              Community Guidelines
            </a>
          </div>

          <p className="support-text">
            For any support, contact us at{" "}
            <a href="mailto:Support@milanlove.in">Support@milanlove.in</a>
          </p>

          <p className="copyright">© {new Date().getFullYear()} Milan. All rights reserved.</p>
        </footer>
      </div>

      <style jsx global>{`
        :root {
          --bg-color-1: #0b1220;
          --bg-color-2: #0f2030;
          --card-bg: rgba(255, 255, 255, 0.04);
          --panel-bg: rgba(12, 16, 23, 0.55);
          --accent1: #ff6b81;
          --accent2: #ff9fb0;
          --text: #f3f7fb;
        }
        html,
        body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          font-family: "Segoe UI", Roboto, "Poppins", sans-serif;
          background: linear-gradient(180deg, var(--bg-color-1) 0%, var(--bg-color-2) 100%);
          color: var(--text);
          -webkit-font-smoothing: antialiased;
        }

        /* Hearts canvas */
        #heartsCanvas {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
        }

        /* page wrapper */
        .page-wrap {
          position: relative;
          z-index: 5;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        #errorMessage {
          position: fixed;
          top: 18px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.7);
          color: #fff;
          padding: 10px 16px;
          border-radius: 10px;
          display: none;
          z-index: 9999;
          font-weight: 600;
        }

        .container {
          max-width: 1200px;
          margin: 32px auto 20px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 36px;
          padding: 20px;
          flex-wrap: wrap;
        }

        .left {
          flex: 1 1 560px;
          min-width: 320px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Welcome box */
        .welcome-box {
          background: rgba(10, 14, 20, 0.55);
          border-radius: 12px;
          padding: 28px 34px;
          box-shadow: 0 10px 40px rgba(2, 6, 23, 0.6);
          max-width: 760px;
          text-align: center;
          border: 1px solid rgba(255, 107, 129, 0.06);
          animation: fadeInUp 700ms ease both;
        }

        .welcome-row {
          display: flex;
          align-items: center;
          gap: 14px;
          justify-content: center;
        }

        .welcome-title {
          font-size: 48px;
          line-height: 1;
          margin: 0;
          font-weight: 900;
          color: var(--text);
          /* highlighted text with subtle gradient stroke */
          background: linear-gradient(90deg, var(--accent1), var(--accent2));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
        }

        /* pulsing heart */
        .pulse-heart {
          display: inline-block;
          font-size: 34px;
          color: #ff465e;
          transform-origin: center;
          animation: heartBeat 1s ease-in-out infinite;
          text-shadow: 0 6px 18px rgba(255, 70, 94, 0.15);
        }

        @keyframes heartBeat {
          0% { transform: scale(1); opacity: 0.95; }
          25% { transform: scale(1.25); opacity: 1; }
          45% { transform: scale(1); opacity: 0.95; }
          100% { transform: scale(1); opacity: 0.95; }
        }

        .welcome-text {
          max-width: 720px;
          font-size: 20px;
          color: #eaf1fb;
          margin: 14px auto 0;
          line-height: 1.6;
          font-weight: 600;
        }

        .age-note {
          margin-top: 14px;
          font-weight: 700;
          color: #ffd7e0;
        }

        /* right / form */
        .right {
          flex: 0 0 420px;
          min-width: 300px;
          display: flex;
          align-items: flex-start;
          justify-content: center;
        }

        .form-container {
          width: 100%;
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));
          padding: 26px;
          border-radius: 14px;
          backdrop-filter: blur(8px);
          box-shadow: 0 14px 50px rgba(2, 6, 23, 0.6);
          border: 1px solid rgba(255,255,255,0.03);
          animation: fadeIn 600ms ease both;
        }

        .form-container h2 {
          text-align: center;
          margin-bottom: 10px;
          font-size: 20px;
        }

        label {
          display: block;
          margin-top: 10px;
          font-size: 15px;
          font-weight: 700;
          color: #f3f7fb;
        }

        input,
        select,
        textarea {
          width: 100%;
          padding: 12px 14px;
          margin-top: 6px;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          background: rgba(0,0,0,0.35);
          color: #fff;
          outline: 2px solid transparent;
          transition: outline 120ms ease, transform 120ms ease;
        }

        input:focus,
        select:focus,
        textarea:focus {
          outline: 2px solid rgba(255, 107, 129, 0.2);
          transform: translateY(-2px);
        }

        textarea { min-height: 84px; resize: vertical; }

        button {
          background: linear-gradient(90deg, var(--accent1), var(--accent2));
          color: #0b1220;
          font-weight: 800;
          cursor: pointer;
          padding: 12px;
          border-radius: 10px;
          border: none;
          margin-top: 12px;
          font-size: 15px;
        }

        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 36px rgba(255, 107, 129, 0.12);
        }

        .terms-container {
          display: flex;
          align-items: center;
          font-size: 13px;
          margin: 12px 0;
        }
        .terms-container input { margin-right: 8px; }
        .terms-container a { color: #ffd54d; text-decoration: none; font-weight: 700; }

        .link-text {
          text-align: center;
          cursor: pointer;
          color: #ffd54d;
          margin-top: 10px;
          font-weight: 700;
        }
        .reset-link { text-align: center; cursor: pointer; color: #ff7a8a; font-weight: 700; }

        /* footer (not a heavy bar) */
        .footer-section {
          text-align: center;
          margin: 40px auto 26px;
          padding: 0 20px;
          position: relative;
          z-index: 5;
          color: #dcdfea;
        }
        .footer-links {
          display: flex;
          justify-content: center;
          gap: 18px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .footer-links a {
          color: #ffd54d;
          text-decoration: none;
          font-weight: 600;
        }
        .footer-links a:hover { text-decoration: underline; }
        .support-text { font-size: 14px; color: #cdd6e6; margin: 6px 0; }
        .support-text a { color: #ff9fb0; font-weight: 700; text-decoration: none; }
        .support-text a:hover { text-decoration: underline; }
        .copyright { font-size: 13px; color: #9fa8c3; margin-top: 8px; }

        /* animations */
        @keyframes fadeInUp {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .welcome-title { font-size: 42px; }
          .welcome-text { font-size: 18px; }
          .container { gap: 24px; padding: 18px; }
        }

        @media (max-width: 768px) {
          .container {
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding: 14px;
            gap: 18px;
            margin-top: 14px;
          }
          .welcome-box { padding: 18px 16px; max-width: 100%; }
          .welcome-title { font-size: 28px; }
          .pulse-heart { font-size: 26px; }
          .welcome-text { font-size: 15px; }
          .right { width: 100%; margin-top: 6px; display: flex; justify-content: center; }
          .form-container { width: 94%; padding: 18px; }
          label { font-size: 14px; }
          input, select, textarea { font-size: 14px; padding: 10px 12px; }
          button { font-size: 15px; padding: 12px; }
        }
      `}</style>
    </>
  );
}
