"use client";
import { useEffect, useState, useRef } from "react";

/**
 * pages/index.js (updated)
 * - Mobile hearts enabled in lightweight mode (smaller, fewer, slower) for performance.
 * - Other existing functionality preserved (register/login, modal, ripple, styles).
 *
 * Replace your existing pages/index.js with this file (keep a backup first).
 */

export default function HomePage() {
  const API_BASE = "https://milan-j9u9.onrender.com";
  const [showLogin, setShowLogin] = useState(false);
  const [showReset, setShowReset] = useState(false);

  // loaders
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [loadingLogin, setLoadingLogin] = useState(false);

  // consent modal
  const [showConsent, setShowConsent] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

  // hearts control for lazy-load
  const [enableHearts, setEnableHearts] = useState(true);
  // heartsRef stores RAF id and smallMode flag
  const heartsRef = useRef({ raf: null, smallMode: false });

  useEffect(() => {
    // Decide small/large hearts behavior based on viewport width & device capability
    const smallScreen =
      window.innerWidth < 760 ||
      (window.devicePixelRatio > 1.5 && window.innerWidth < 980);

    // store smallMode flag for startHearts to use
    heartsRef.current.smallMode = smallScreen ? true : false;

    // keep enableHearts true so canvas exists — but startHearts will adapt to smallMode
    setEnableHearts(true);

    // start hearts always, but inside startHearts we will limit spawn in smallMode
    startHearts();
    return () => stopHearts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // HEARTS: lightweight canvas heart animation (adapts to smallMode)
  function startHearts() {
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
      const small = heartsRef.current.smallMode;
      return {
        x: Math.random() * canvas.width,
        y: canvas.height + (small ? 30 : 50),
        size: small ? Math.random() * 18 + 6 : Math.random() * 28 + 12,
        speed: small ? Math.random() * 0.9 + 0.3 : Math.random() * 1.6 + 0.6,
        color: small
          ? ["#ff7a9a", "#ff6b81", "#ff9fb0"][Math.floor(Math.random() * 3)]
          : ["#ff4d6d", "#ff1c68", "#ff6b81", "#e6005c"][
              Math.floor(Math.random() * 4)
            ],
        alpha: small ? 0.75 : 0.95,
        rot: Math.random() * Math.PI * 2,
      };
    }

    function drawHearts() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      hearts.forEach((h) => {
        ctx.save();
        ctx.globalAlpha = h.alpha;
        ctx.translate(h.x, h.y);
        ctx.rotate(Math.sin(h.y / 50) * 0.03);
        ctx.fillStyle = h.color;
        ctx.beginPath();
        const s = h.size;
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(s / 2, -s, s * 1.5, s / 3, 0, s);
        ctx.bezierCurveTo(-s * 1.5, s / 3, -s / 2, -s, 0, 0);
        ctx.fill();
        ctx.restore();
        h.y -= h.speed;
      });

      // remove offscreen hearts
      hearts = hearts.filter((h) => h.y + h.size > -60);

      // spawn probability smaller on small screens to reduce clutter / CPU usage
      const spawnProb = heartsRef.current.smallMode ? 0.06 : 0.12;
      if (Math.random() < spawnProb) hearts.push(createHeart());

      // limit count for performance (smaller limit on mobile)
      if (heartsRef.current.smallMode && hearts.length > 60) hearts = hearts.slice(-60);
      if (!heartsRef.current.smallMode && hearts.length > 220) hearts = hearts.slice(-220);

      heartsRef.current.raf = requestAnimationFrame(drawHearts);
    }

    drawHearts();

    heartsRef.current.cleanup = () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(heartsRef.current.raf);
    };
  }

  function stopHearts() {
    if (heartsRef.current.cleanup) heartsRef.current.cleanup();
  }

  // small helper for showing error toast
  function showError(msg) {
    const errDiv = document.getElementById("errorMessage");
    if (!errDiv) return;
    errDiv.textContent = msg;
    errDiv.style.display = "block";
    setTimeout(() => {
      errDiv.style.display = "none";
    }, 3500);
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

  // Ripple effect for buttons
  function rippleEffect(e) {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const circle = document.createElement("span");
    const diameter = Math.max(rect.width, rect.height);
    const radius = diameter / 2;
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - rect.left - radius}px`;
    circle.style.top = `${e.clientY - rect.top - radius}px`;
    circle.classList.add("ripple");
    const ripple = btn.getElementsByClassName("ripple")[0];
    if (ripple) ripple.remove();
    btn.appendChild(circle);
    setTimeout(() => circle.remove(), 700);
  }

  // Register flow with consent modal
  function onRegisterClick(e) {
    rippleEffect(e);
    const termsAccepted = document.getElementById("terms")?.checked;
    // If consent not yet accepted in modal, open modal
    if (!consentAccepted) {
      setShowConsent(true);
      return;
    }
    // proceed with registration
    registerUser();
  }

  async function registerUser() {
    // validations (same as before)
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
    if (!termsAccepted) return showError("Please accept Terms & Conditions to continue.");

    const userAge = calculateAge(dob);
    if (isNaN(userAge)) return showError("Please enter a valid Date of Birth.");
    if (userAge < 18) return showError("Milan is strictly 18+ only.");

    try {
      setLoadingRegister(true);
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
    } catch (err) {
      console.error(err);
      showError("Server error");
    } finally {
      setLoadingRegister(false);
    }
  }

  // Login with loader
  async function handleLogin(e) {
    rippleEffect(e);
    const contact = document.getElementById("loginContact").value.trim();
    const password = document.getElementById("loginPassword").value.trim();
    if (!contact || !password) return showError("Enter Email/Mobile and Password");

    try {
      setLoadingLogin(true);
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrMobile: contact, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        window.location.href = "/connect";
      } else showError(data.error || "Login failed");
    } catch (err) {
      console.error(err);
      showError("Server error");
    } finally {
      setLoadingLogin(false);
    }
  }

  async function handleReset(e) {
    rippleEffect(e);
    const contact = document.getElementById("resetContact").value.trim();
    const newPassword = document.getElementById("newPassword").value.trim();
    if (!contact || !newPassword) return showError("Fill all fields");

    try {
      setLoadingLogin(true);
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
    } finally {
      setLoadingLogin(false);
    }
  }

  // Consent modal accept handler
  function acceptConsent() {
    setConsentAccepted(true);
    setShowConsent(false);
    // small delay then continue registration automatically
    setTimeout(() => {
      registerUser();
    }, 180);
  }

  // Cancel consent (close)
  function cancelConsent() {
    setConsentAccepted(false);
    setShowConsent(false);
  }

  return (
    <>
      <canvas id="heartsCanvas" aria-hidden={!enableHearts}></canvas>
      <div id="errorMessage" style={{ display: "none" }} role="alert"></div>

      <div className="page-wrap">
        <div className="container">
          <div className="left">
            <div className="welcome-box" role="region" aria-label="Welcome to Milan">
              <div className="welcome-row">
                <h1 className="welcome-title">Welcome to Milan</h1>
                <span className="pulse-heart" aria-hidden="true">
                  ❤
                </span>
              </div>

              <p className="welcome-text">
                “Love recognizes no barriers. It jumps hurdles, leaps fences, penetrates
                walls to arrive at its destination full of hope.”
              </p>
              <p className="age-note">🔞 Milan is strictly for 18+ users.</p>

              {/* WHY MILAN cards */}
              <div className="why-grid" aria-hidden={false}>
                <div className="why-card">
                  <div className="why-emoji">🔒</div>
                  <h4>Safe & Moderated</h4>
                  <p>Profiles monitored, community guidelines & reporting tools keep things safe.</p>
                </div>
                <div className="why-card">
                  <div className="why-emoji">🌹</div>
                  <h4>Romantic Vibes</h4>
                  <p>Romantic UI, soft animations and a gentle atmosphere for real connections.</p>
                </div>
                <div className="why-card">
                  <div className="why-emoji">🕶️</div>
                  <h4>Anonymous & Fun</h4>
                  <p>Chat anonymously, express freely — it's light, friendly & playful.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="right">
            <div className="form-container" role="form" aria-label="Signup or Login">
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
                  <select id="gender" aria-label="Gender">
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
                    <label htmlFor="terms" style={{ marginLeft: 8 }}>
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

                  <button
                    className="primary-btn"
                    onClick={onRegisterClick}
                    disabled={loadingRegister}
                    aria-disabled={loadingRegister}
                    aria-busy={loadingRegister}
                    onMouseDown={(e) => rippleEffect(e)}
                  >
                    {loadingRegister ? (
                      <span className="btn-loader" aria-hidden="true"></span>
                    ) : null}
                    Register & Start
                  </button>

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

                  <button
                    className="primary-btn"
                    onClick={handleLogin}
                    disabled={loadingLogin}
                    aria-disabled={loadingLogin}
                    aria-busy={loadingLogin}
                    onMouseDown={(e) => rippleEffect(e)}
                  >
                    {loadingLogin ? <span className="btn-loader" /> : null}
                    Login
                  </button>

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

                  <button
                    className="primary-btn"
                    onClick={handleReset}
                    disabled={loadingLogin}
                    aria-disabled={loadingLogin}
                    onMouseDown={(e) => rippleEffect(e)}
                  >
                    {loadingLogin ? <span className="btn-loader" /> : null}
                    Reset Password
                  </button>

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

        <footer className="footer-section" role="contentinfo">
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

          <p className="copyright">© {new Date().getFullYear()} Milan. All rights reserved</p>
        </footer>
      </div>

      {/* Consent modal */}
      {showConsent && (
        <div className="modal-back" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Before you continue — A quick consent</h3>
            <p className="modal-desc">
              By continuing you agree to Milan's Terms & Privacy. We value your safety —
              we moderate content, do not share personal data, and provide reporting tools.
            </p>
            <ul className="modal-list">
              <li>We moderate chats & profiles.</li>
              <li>We do not share your email/mobile with strangers.</li>
              <li>You can report/block anyone from the profile options.</li>
            </ul>
            <div className="modal-actions">
              <button className="ghost-btn" onClick={cancelConsent} onMouseDown={(e)=>rippleEffect(e)}>Cancel</button>
              <button className="primary-btn" onClick={acceptConsent} onMouseDown={(e)=>rippleEffect(e)}>I Accept & Continue</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        :root {
          --bg-1: #0b1220;
          --bg-2: #0f2030;
          --accent1: #ff6b81;
          --accent2: #ff9fb0;
          --card: rgba(255,255,255,0.04);
          --muted: #c7d7ea;
        }
        html, body {
          margin: 0;
          padding: 0;
          font-family: "Poppins", "Segoe UI", Roboto, sans-serif;
          background: linear-gradient(180deg, var(--bg-1) 0%, var(--bg-2) 100%);
          color: #eef6ff;
        }

        /* canvas hearts */
        #heartsCanvas {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }

        #errorMessage {
          position: fixed;
          top: 18px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.7);
          color: #fff;
          padding: 10px 14px;
          border-radius: 8px;
          display: none;
          z-index: 9999;
          font-weight: 700;
        }

        .page-wrap { position: relative; z-index: 5; min-height: 100vh; display:flex; flex-direction:column; justify-content:space-between; }

        .container {
          width: 100%;
          max-width: 1200px;
          margin: 28px auto 6px;
          display:flex;
          gap: 34px;
          padding: 18px;
          align-items:flex-start;
          justify-content:space-between;
          flex-wrap:wrap;
        }

        .left { flex: 1 1 560px; min-width: 320px; display:flex; align-items:center; justify-content:center; }

        .welcome-box {
          background: linear-gradient(180deg, rgba(10,14,20,0.54), rgba(12,18,24,0.44));
          border-radius: 12px;
          padding: 26px 32px;
          box-shadow: 0 12px 48px rgba(2,6,23,0.6);
          max-width: 780px;
          text-align:center;
          border: 1px solid rgba(255,107,129,0.06);
          animation: fadeInUp 600ms ease both;
        }

        .welcome-row { display:flex; align-items:center; gap:12px; justify-content:center; }

        .welcome-title {
          font-size: 52px;
          margin: 0;
          font-weight: 900;
          background: linear-gradient(90deg, var(--accent1), var(--accent2));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 10px 28px rgba(0,0,0,0.45);
        }

        .pulse-heart {
          display:inline-block;
          font-size: 36px;
          color: #ff465e;
          animation: heartBeat 1000ms ease-in-out infinite;
          transform-origin: center;
          text-shadow: 0 8px 22px rgba(255,70,94,0.12);
        }

        @keyframes heartBeat {
          0% { transform: scale(1); opacity: 0.95; }
          28% { transform: scale(1.28); opacity: 1; }
          42% { transform: scale(1); opacity: 0.96; }
          100% { transform: scale(1); opacity: 0.95; }
        }

        .welcome-text {
          font-size: 20px;
          color: var(--muted);
          margin-top: 12px;
          font-weight: 600;
          line-height: 1.6;
        }

        .age-note { margin-top: 14px; color: #ffd7e0; font-weight:700; }

        /* WHY cards */
        .why-grid { display:flex; gap:14px; margin-top:18px; justify-content:center; flex-wrap:wrap; }
        .why-card {
          background: rgba(255,255,255,0.02);
          border-radius: 10px;
          padding: 12px;
          width: 220px;
          box-shadow: 0 8px 28px rgba(2,6,23,0.5);
          border: 1px solid rgba(255,255,255,0.02);
        }
        .why-emoji { font-size: 28px; display:block; margin-bottom:8px; }
        .why-card h4 { margin:0 0 6px 0; font-size:16px; color:#fff; }
        .why-card p { margin:0; color:var(--muted); font-size:13px; line-height:1.4; }

        /* right form */
        .right { flex: 0 0 420px; min-width: 300px; display:flex; align-items:flex-start; justify-content:center; }
        .form-container {
          width:100%;
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));
          padding: 24px;
          border-radius: 14px;
          backdrop-filter: blur(6px);
          box-shadow: 0 14px 50px rgba(2,6,23,0.6);
        }

        h2 { font-size:20px; margin:0 0 8px 0; text-align:center; }

        label { display:block; margin-top:10px; font-size:15px; font-weight:700; color:#f3f7fb; }
        input, select, textarea {
          width:100%;
          padding:12px 14px;
          margin-top:6px;
          border-radius:8px;
          border:none;
          font-size:15px;
          background: rgba(0,0,0,0.36);
          color:#fff;
          outline:2px solid transparent;
          transition: outline 120ms ease, transform 100ms ease;
        }
        input:focus, select:focus, textarea:focus {
          outline:2px solid rgba(255,107,129,0.18);
          transform: translateY(-2px);
        }
        textarea { min-height:84px; resize:vertical; }

        /* buttons + ripple + loader */
        .primary-btn, .ghost-btn {
          position: relative;
          overflow: hidden;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 12px 14px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          font-weight: 800;
          font-size: 15px;
        }
        .primary-btn {
          background: linear-gradient(90deg, var(--accent1), var(--accent2));
          color: #071320;
          box-shadow: 0 10px 36px rgba(255,107,129,0.12);
        }
        .ghost-btn {
          background: rgba(255,255,255,0.03);
          color: var(--muted);
          border: 1px solid rgba(255,255,255,0.04);
        }
        .primary-btn:disabled { opacity: 0.8; cursor: not-allowed; transform:none; }

        /* ripple span */
        .ripple {
          position: absolute;
          border-radius: 50%;
          transform: scale(0);
          animation: ripple 700ms linear;
          background: rgba(255,255,255,0.35);
          pointer-events: none;
        }
        @keyframes ripple { to { transform: scale(4); opacity: 0; } }

        /* small loader inside button */
        .btn-loader {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid rgba(0,0,0,0.12);
          border-top: 2px solid rgba(255,255,255,0.9);
          animation: spin 900ms linear infinite;
          display:inline-block;
          margin-right:8px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .terms-container { display:flex; align-items:center; gap:8px; margin-top:12px; font-size:13px; color:var(--muted); }
        .terms-container a { color:#ffd54d; text-decoration:none; font-weight:700; }

        .link-text { text-align:center; cursor:pointer; color:#ffd54d; margin-top:10px; font-weight:700; }
        .reset-link { text-align:center; cursor:pointer; color:#ff7a8a; font-weight:700; }

        /* modal */
        .modal-back {
          position: fixed;
          inset: 0;
          background: rgba(2,6,23,0.65);
          display:flex;
          align-items:center;
          justify-content:center;
          z-index: 99999;
        }
        .modal {
          width: 92%;
          max-width: 520px;
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 18px 68px rgba(0,0,0,0.6);
          color: #eef6ff;
        }
        .modal h3 { margin:0 0 8px 0; font-size:18px; }
        .modal-desc { color:var(--muted); font-size:14px; margin:6px 0 12px 0; }
        .modal-list { margin:0 0 14px 18px; color:var(--muted); }
        .modal-actions { display:flex; gap:12px; justify-content:flex-end; }

        /* footer */
        .footer-section { text-align:center; margin:28px auto 30px; padding: 0 18px; z-index:5; color:#dcdfea; }
        .footer-links { display:flex; gap:18px; justify-content:center; flex-wrap:wrap; margin-bottom:8px; }
        .footer-links a { color:#ffd54d; text-decoration:none; font-weight:600; }
        .support-text { font-size:14px; color:#cdd6e6; margin:6px 0; }
        .support-text a { color:#ff9fb0; font-weight:700; text-decoration:none; }
        .copyright { font-size:13px; color:#9fa8c3; margin-top:8px; }

        /* animations */
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* responsive */
        @media (max-width: 1024px) {
          .welcome-title { font-size:44px; }
          .container { gap:24px; padding:16px; }
        }
        @media (max-width: 768px) {
          .container { flex-direction:column; align-items:center; padding:12px; gap:16px; margin-top:10px; }
          .welcome-title { font-size: 30px; }
          .pulse-heart { font-size:24px; }
          .why-card { width: 92%; }
          .right { width:100%; margin-top:6px; display:flex; justify-content:center; }
          .form-container { width:94%; padding:16px; }
        }
      `}</style>
    </>
  );
}
