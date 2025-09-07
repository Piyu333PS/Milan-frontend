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
        // simple heart-like bezier
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
            {/* Logo removed as requested */}
            <h1 className="welcome-title">Welcome to Milan ❤️</h1>
            <p className="welcome-text">
              “Love recognizes no barriers. It jumps hurdles, leaps fences,
              penetrates walls to arrive at its destination full of hope.”
            </p>
            <p className="age-note">🔞 Milan is strictly for 18+ users.</p>
          </div>

          <div className="right">
            <div className="form-container">
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
          <p className="copyright">
            © {new Date().getFullYear()} Milan. All rights reserved.
          </p>
        </footer>
      </div>

      <style jsx global>{`
        :root {
          --bg-color: #0b1220;
          --panel-bg: rgba(255, 255, 255, 0.04);
          --card-bg: rgba(255, 255, 255, 0.06);
          --accent1: #ff6b81;
          --accent2: #ff9fb0;
          --text-color: #f8f8fb;
        }
        html,
        body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          font-family: "Segoe UI", Roboto, "Poppins", sans-serif;
          background: linear-gradient(180deg, #0b1220 0%, #10202b 100%);
          color: var(--text-color);
        }

        /* hearts canvas */
        #heartsCanvas {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
        }

        /* page wrapper to center main content with max width */
        .page-wrap {
          position: relative;
          z-index: 1;
        }

        .container {
          max-width: 1100px; /* center the whole layout */
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between; /* left & right balanced */
          min-height: calc(100vh - 140px);
          padding: 40px 20px;
          gap: 30px;
          flex-wrap: wrap;
        }

        .left {
          flex: 1 1 480px;
          min-width: 320px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        /* NEW: Welcome title styling (bigger + highlighted) */
        .welcome-title {
          font-size: 44px;
          line-height: 1.02;
          margin: 6px 0 12px 0;
          font-weight: 800;
          background: linear-gradient(90deg, var(--accent1), var(--accent2));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 6px 22px rgba(255, 107, 129, 0.12);
          letter-spacing: 0.5px;
        }

        .welcome-text {
          max-width: 760px;
          font-size: 18px;
          color: #e8eef6;
          margin: 0 auto;
          line-height: 1.6;
          text-align: center;
          font-weight: 500;
        }

        .age-note {
          margin-top: 12px;
          font-weight: 700;
          color: #ffd7e0;
        }

        /* error message popup */
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
        }

        /* right form */
        .right {
          flex: 0 0 420px;
          min-width: 300px;
          display: flex;
          align-items: flex-start;
          justify-content: center;
        }

        .form-container {
          width: 100%;
          background: var(--card-bg);
          padding: 28px;
          border-radius: 14px;
          backdrop-filter: blur(8px);
          box-shadow: 0 10px 40px rgba(2, 6, 23, 0.6);
        }

        .form-container h2 {
          text-align: center;
          margin-bottom: 18px;
          font-size: 20px;
        }

        input,
        select,
        textarea,
        button {
          width: 100%;
          padding: 10px 12px;
          margin: 8px 0;
          border: none;
          border-radius: 8px;
          font-size: 14px;
        }

        textarea {
          min-height: 80px;
          resize: vertical;
        }

        button {
          background: linear-gradient(90deg, var(--accent1), var(--accent2));
          color: #0b1220;
          font-weight: 700;
          cursor: pointer;
          padding: 12px;
          border-radius: 10px;
          border: none;
        }

        button:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(255, 107, 129, 0.12);
        }

        .terms-container {
          display: flex;
          align-items: center;
          font-size: 13px;
          margin: 12px 0;
        }
        .terms-container input {
          margin-right: 8px;
        }
        .terms-container a {
          color: #ffd54d;
          text-decoration: none;
        }

        .link-text {
          text-align: center;
          cursor: pointer;
          color: #ffd54d;
          margin-top: 10px;
        }
        .reset-link {
          text-align: center;
          cursor: pointer;
          color: #ff7a8a;
        }

        /* footer */
        .footer-section {
          text-align: center;
          margin-top: 30px;
          padding: 20px;
          position: relative;
          z-index: 2;
        }
        .footer-links {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        .footer-links a {
          color: #ffd54d;
          text-decoration: none;
        }
        .support-text {
          font-size: 14px;
          color: #ddd;
        }
        .copyright {
          font-size: 13px;
          color: #aaa;
          margin-top: 5px;
        }

        /* Responsive adjustments */
        @media (max-width: 1024px) {
          .welcome-title {
            font-size: 36px;
          }
          .container {
            padding: 28px 18px;
          }
          .right {
            flex-basis: 420px;
          }
        }

        @media (max-width: 768px) {
          .container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding: 22px 12px;
            min-height: auto;
          }
          .left {
            padding: 8px 6px;
          }
          .welcome-title {
            font-size: 28px;
          }
          .welcome-text {
            font-size: 15px;
            padding: 0 8px;
          }
          .right {
            width: 100%;
            margin-top: 18px;
            display: flex;
            justify-content: center;
          }
          .form-container {
            width: 92%;
            padding: 20px;
          }
        }
      `}</style>
    </>
  );
}
