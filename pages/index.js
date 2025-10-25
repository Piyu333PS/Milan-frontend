// pages/index.js
"use client";
import Head from "next/head";
import { useEffect, useState, useRef } from "react";

export default function HomePage() {
  const API_BASE = "https://milan-j9u9.onrender.com";

  // --- HARD SCROLL-UNLOCK: prevents mobile freeze (body/html overflow locks) ---
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const unlock = () => {
      html.style.overflowY = "auto";
      body.style.overflowY = "auto";
      html.style.height = "auto";
      body.style.height = "auto";
      body.style.touchAction = "pan-y";
      body.style.webkitOverflowScrolling = "touch";
      body.style.overscrollBehaviorY = "auto";
    };
    unlock();

    // In case any runtime script re-locks scroll
    const i = setInterval(unlock, 500);
    return () => clearInterval(i);
  }, []);
  // ---------------------------------------------------------------------------

  // Auth views
  const [showLogin, setShowLogin] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [loadingLogin, setLoadingLogin] = useState(false);

  // Consent
  const [showConsent, setShowConsent] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

  // Background hearts
  const [enableHearts, setEnableHearts] = useState(true);
  const heartsRef = useRef({ raf: null, smallMode: false, cleanup: null });

  // Toast
  function showError(msg) {
    const n = document.getElementById("errorMessage");
    if (!n) return;
    n.textContent = msg;
    n.style.display = "block";
    setTimeout(() => (n.style.display = "none"), 3500);
  }

  useEffect(() => {
    const smallScreen =
      window.innerWidth < 760 ||
      (window.devicePixelRatio > 1.5 && window.innerWidth < 980);

    heartsRef.current.smallMode = smallScreen;
    setEnableHearts(true);
    startHearts();

    return () => {
      stopHearts();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** HEARTS */
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
        y: canvas.height + (small ? 10 : 40),
        size: small ? Math.random() * 16 + 6 : Math.random() * 26 + 10,
        speed: small ? Math.random() * 1.6 + 0.6 : Math.random() * 2.6 + 1.2,
        color: small
          ? ["#ffd4e6", "#ffcde8", "#ffe6f3"][Math.floor(Math.random() * 3)]
          : ["#ff7aa5", "#ff4d88", "#e63c86", "#ff9fb0"][Math.floor(Math.random() * 4)],
        alpha: small ? 0.85 : 0.98,
        rotate: Math.random() * 0.6 - 0.3
      };
    }

    function drawHearts() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // subtle soft glow background on canvas to make hearts pop
      const grad = ctx.createRadialGradient(
        canvas.width * 0.5,
        canvas.height * 0.2,
        canvas.width * 0.05,
        canvas.width * 0.5,
        canvas.height * 0.5,
        Math.max(canvas.width, canvas.height) * 0.9
      );
      grad.addColorStop(0, "rgba(255,230,240,0.02)");
      grad.addColorStop(1, "rgba(255,240,250,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      hearts.forEach((h) => {
        ctx.save();
        ctx.globalAlpha = h.alpha;
        ctx.translate(h.x, h.y);
        ctx.rotate(Math.sin(h.y / 40 + h.rotate) * 0.08);
        ctx.beginPath();
        const s = h.size;
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(s / 2, -s, s * 1.5, s / 3, 0, s);
        ctx.bezierCurveTo(-s * 1.5, s / 3, -s / 2, -s, 0, 0);
        ctx.fillStyle = h.color;
        ctx.fill();
        ctx.restore();
        h.y -= h.speed;
      });

      hearts = hearts.filter((h) => h.y + h.size > -60);

      // denser spawn logic (visible floating hearts)
      const baseProb = heartsRef.current.smallMode ? 0.16 : 0.36;
      const extraChance = Math.random() < 0.09 ? (heartsRef.current.smallMode ? 2 : 4) : 1;
      for (let i = 0; i < extraChance; i++) {
        if (Math.random() < baseProb) hearts.push(createHeart());
      }

      if (heartsRef.current.smallMode && hearts.length > 180) hearts = hearts.slice(-180);
      if (!heartsRef.current.smallMode && hearts.length > 720) hearts = hearts.slice(-720);

      heartsRef.current.raf = requestAnimationFrame(drawHearts);
    }
    drawHearts();

    heartsRef.current.cleanup = () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(heartsRef.current.raf);
    };
  }
  function stopHearts() {
    heartsRef.current.cleanup && heartsRef.current.cleanup();
  }

  function calculateAge(d) {
    const t = new Date();
    const b = new Date(d);
    let a = t.getFullYear() - b.getFullYear();
    const m = t.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
    return a;
  }

  // Ripple
  function rippleEffect(e) {
    const btn = e.currentTarget;
    const r = btn.getBoundingClientRect();
    const circle = document.createElement("span");
    const dia = Math.max(r.width, r.height);
    const rad = dia / 2;
    circle.style.width = circle.style.height = `${dia}px`;
    circle.style.left = `${e.clientX - r.left - rad}px`;
    circle.style.top = `${e.clientY - r.top - rad}px`;
    circle.classList.add("ripple");
    const exist = btn.getElementsByClassName("ripple")[0];
    if (exist) exist.remove();
    btn.appendChild(circle);
    setTimeout(() => circle.remove(), 700);
  }

  // Register & flows
  function onRegisterClick(e) {
    rippleEffect(e);
    if (!consentAccepted) {
      setShowConsent(true);
      return;
    }
    registerUser();
  }
  async function registerUser() {
    const name = document.getElementById("name")?.value.trim();
    const gender = document.getElementById("gender")?.value;
    const contact = document.getElementById("contact")?.value.trim();
    const password = document.getElementById("password")?.value.trim();
    const dob = document.getElementById("dob")?.value;
    const city = document.getElementById("city")?.value.trim();
    const reason = document.getElementById("reason")?.value;
    const termsAccepted = document.getElementById("terms")?.checked;

    if (!name || !gender || !contact || !password || !dob || !city || !reason)
      return showError("Please fill all required fields!");
    if (!termsAccepted)
      return showError("Please accept Terms & Conditions to continue.");
    const userAge = calculateAge(dob);
    if (isNaN(userAge)) return showError("Please enter a valid Date of Birth.");
    if (userAge < 18) return showError("Milan is strictly 18+ only.");

    try {
      setLoadingRegister(true);
      const payload = {
        emailOrMobile: contact,
        password,
        name,
        gender,
        dob,
        city,
        reason,
      };
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  async function handleLogin(e) {
    rippleEffect(e);
    const contact = document.getElementById("loginContact")?.value.trim();
    const password = document.getElementById("loginPassword")?.value.trim();
    if (!contact || !password)
      return showError("Enter Email/Mobile and Password");
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
    const contact = document.getElementById("resetContact")?.value.trim();
    const newPassword = document.getElementById("newPassword")?.value.trim();
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

  // Consent
  function acceptConsent() {
    setConsentAccepted(true);
    setShowConsent(false);
    setTimeout(() => registerUser(), 180);
  }
  function cancelConsent() {
    setConsentAccepted(false);
    setShowConsent(false);
  }

  return (
    <>
      <Head>
        <title>Milan — Where Hearts Connect 💞</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#ffd1e6" />
      </Head>

      {/* Background heart canvas */}
      <canvas
        id="heartsCanvas"
        aria-hidden={!enableHearts}
        style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
      />
      <div id="errorMessage" style={{ display: "none" }} role="alert"></div>

      <div className="page-wrap">
        <div className="container">
          <div className="left">
            <div className="welcome-box" role="region" aria-label="Welcome to Milan">
              <div className="welcome-row">
                <h1 className="welcome-title">Milan</h1>
                <span className="pulse-heart" aria-hidden>
                  ❤
                </span>
              </div>

              <h3 className="tagline">Where hearts find a little magic ✨</h3>

              <p className="welcome-text">
                “Love recognizes no barriers. It jumps hurdles, leaps fences,
                penetrates walls to arrive at its destination full of hope.”
              </p>
              <p className="age-note">🔞 Milan is strictly for 18+ users.</p>

              <div className="why-grid">
                <div className="why-card">
                  <div className="why-emoji">🔒</div>
                  <h4>Safe & Moderated</h4>
                  <p>
                    Profiles monitored, community guidelines & reporting tools keep
                    things safe.
                  </p>
                </div>
                <div className="why-card">
                  <div className="why-emoji">🌹</div>
                  <h4>Romantic Vibes</h4>
                  <p>
                    Soft animations and a gentle atmosphere for real connections.
                  </p>
                </div>
                <div className="why-card">
                  <div className="why-emoji">🕶️</div>
                  <h4>Anonymous & Fun</h4>
                  <p>Chat anonymously, express freely — it's light, friendly & playful.</p>
                </div>
              </div>

              {/* removed Diwali CTAs as requested */}
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
                  <input id="name" placeholder="Your name or nickname" />
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
                  <input id="contact" placeholder="Email or 10-digit Mobile number" />
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
                  <input id="city" placeholder="City / Country" />
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
                      ,
                      <a href="/privacy.html" target="_blank" rel="noreferrer">
                        {" "}
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
                    onMouseDown={rippleEffect}
                  >
                    {loadingRegister ? <span className="btn-loader" aria-hidden></span> : null}
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
                  <input id="loginContact" placeholder="Enter Email/Mobile" />
                  <label>Password</label>
                  <input type="password" id="loginPassword" placeholder="Enter password" />
                  <button
                    className="primary-btn"
                    onClick={handleLogin}
                    disabled={loadingLogin}
                    aria-disabled={loadingLogin}
                    aria-busy={loadingLogin}
                    onMouseDown={rippleEffect}
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
                  <input id="resetContact" placeholder="Enter your Email/Mobile" />
                  <label>New Password</label>
                  <input type="password" id="newPassword" placeholder="Enter new password" />
                  <button
                    className="primary-btn"
                    onClick={handleReset}
                    disabled={loadingLogin}
                    aria-disabled={loadingLogin}
                    onMouseDown={rippleEffect}
                  >
                    {loadingLogin ? <span className="btn-loader" /> : null}
                    Reset Password
                  </button>
                  <p className="link-text" onClick={() => { setShowReset(false); setShowLogin(true); }}>
                    Back to Login
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="footer-section" role="contentinfo">
          <div className="footer-links">
            <a href="/terms.html" target="_blank" rel="noreferrer">Terms & Conditions</a>
            <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a>
            <a href="/guidelines.html" target="_blank" rel="noreferrer">Community Guidelines</a>
          </div>
          <p className="support-text">
            For any support, contact us at{" "}
            <a href="mailto:Support@milanlove.in">Support@milanlove.in</a>
          </p>
          <p className="copyright">
            © {new Date().getFullYear()} Milan. All rights reserved
          </p>
        </footer>
      </div>

      {showConsent && (
        <div className="modal-back" role="dialog" aria-modal>
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
              <button className="ghost-btn" onClick={() => { setShowConsent(false); }} onMouseDown={rippleEffect}>
                Cancel
              </button>
              <button className="primary-btn" onClick={acceptConsent} onMouseDown={rippleEffect}>
                I Accept & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL overrides: ensure scroll works on all mobiles */}
      <style jsx global>{`
        html, body {
          overflow-y: auto !important;
          height: auto !important;
          -webkit-overflow-scrolling: touch !important;
          overscroll-behavior-y: auto !important;
          touch-action: pan-y !important;
          background: radial-gradient(800px circle at 10% 10%, #ffeef6 0%, #f6e6ff 40%, #fff7fb 100%);
        }
        #__next { min-height: 100%; }
      `}</style>

      <style>{`
        :root{
          --bg-1: #ffeef6;
          --bg-2: #f6e6ff;
          --accent1: #ff6b9a;
          --accent2: #c77bff;
          --muted: #6b6b7a;
          --soft: #ffd1e6;
        }
        html,body{ margin:0; padding:0; font-family:Poppins, "Segoe UI", Roboto, sans-serif; color:#3b2b3d; }
        #heartsCanvas{ position:fixed; inset:0; z-index:0; pointer-events:none; }

        .page-wrap{ position:relative; z-index:5; min-height:100svh; display:flex; flex-direction:column; justify-content:space-between; padding-bottom:24px; }
        .container{ width:100%; max-width:1200px; margin:28px auto 6px; display:flex; gap:34px; padding:18px; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; }
        .left{ flex:1 1 560px; min-width:320px; display:flex; align-items:center; justify-content:center; }
        .right{ flex:0 0 420px; min-width:300px; display:flex; align-items:flex-start; justify-content:center; }

        .welcome-box{ background: linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,249,255,0.85)); border-radius:16px; padding:26px 32px; box-shadow: 0 18px 60px rgba(199,123,255,0.08); max-width:780px; text-align:center; border: 1px solid rgba(199,123,255,0.12); }
        .welcome-row{ display:flex; align-items:center; gap:12px; justify-content:center; }
        .welcome-title{ font-size:56px; margin:0; font-weight:900; background: linear-gradient(90deg, var(--accent1), var(--accent2)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; text-shadow:0 10px 28px rgba(199,123,255,0.06); }
        .pulse-heart{ display:inline-block; font-size:36px; color:var(--accent1); animation: heartBeat 1000ms ease-in-out infinite; transform-origin:center; text-shadow: 0 8px 22px rgba(255,107,129,0.08); }
        .tagline{ margin:8px 0 2px; font-size:20px; color: #9a6aa8; font-weight:800; }
        @keyframes heartBeat{ 0%{transform:scale(1)} 28%{transform:scale(1.22)} 42%{transform:scale(1)} 100%{transform:scale(1)} }
        .welcome-text{ font-size:16px; color: var(--muted); margin-top:12px; font-weight:600; line-height:1.6; }
        .age-note{ margin-top:14px; color:#b85b7a; font-weight:700; }

        .why-grid{ display:flex; gap:14px; margin-top:18px; justify-content:center; flex-wrap:wrap; }
        .why-card{ background: linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,249,255,0.95)); border-radius:12px; padding:14px; width:220px; box-shadow: 0 8px 28px rgba(199,123,255,0.06); border:1px solid rgba(199,123,255,0.06); }
        .why-emoji{ font-size:28px; display:block; margin-bottom:8px; }
        .why-card h4{ margin:0 0 6px 0; font-size:16px; color:#3b2b3d; }
        .why-card p{ margin:0; color: var(--muted); font-size:13px; line-height:1.4; }

        .form-container{ width:100%; background: linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,249,255,0.98)); padding:24px; border-radius:16px; backdrop-filter: blur(2px); box-shadow: 0 18px 60px rgba(199,123,255,0.06); }
        h2{ font-size:20px; margin:0 0 8px 0; text-align:center; color:#3b2b3d; }
        label{ display:block; margin-top:10px; font-size:15px; font-weight:700; color:#f3f7fb; }
        input,select,textarea{ width:100%; padding:12px 14px; margin-top:6px; border-radius:8px; border:none; font-size:15px; background: rgba(243,226,238,0.8); color:#3b2b3d; outline:2px solid transparent; transition: outline 120ms ease, transform 100ms ease; }
        input:focus,select:focus,textarea:focus{ outline:2px solid rgba(255,107,129,0.18); transform: translateY(-2px); }
        textarea{ min-height:84px; resize:vertical; }
        .primary-btn{ position:relative; overflow:hidden; display:inline-flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:12px 14px; border-radius:10px; border:none; cursor:pointer; font-weight:800; font-size:15px; background: linear-gradient(90deg, #ff6b81, #ff9fb0); color:#071320; box-shadow: 0 10px 36px rgba(255,107,129,0.12); }
        .primary-btn:disabled{ opacity:.8; cursor:not-allowed; transform:none; }
        .ripple{ position:absolute; border-radius:50%; transform: scale(0); animation: ripple 700ms linear; background: rgba(255,255,255,0.35); pointer-events:none; }
        @keyframes ripple{ to{ transform: scale(4); opacity:0; } }
        .btn-loader{ width:18px; height:18px; border-radius:50%; border:2px solid rgba(0,0,0,0.12); border-top:2px solid rgba(255,255,255,0.9); animation: spin 900ms linear infinite; display:inline-block; margin-right:8px; }
        @keyframes spin{ to{ transform: rotate(360deg); } }
        .terms-container{ display:flex; align-items:center; gap:8px; margin-top:12px; font-size:13px; color:#c7d7ea; }
        .terms-container a{ color:#ffd54d; text-decoration:none; font-weight:700; }
        .link-text{ text-align:center; cursor:pointer; color:#ffd54d; margin-top:10px; font-weight:700; }
        .reset-link{ text-align:center; cursor:pointer; color:#ff7a8a; font-weight:700; }

        .modal-back{ position:fixed; inset:0; background: rgba(2,6,23,0.65); display:flex; align-items:center; justify-content:center; z-index: 99999; }
        .modal{ width:92%; max-width:540px; background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); padding:20px; border-radius:12px; box-shadow: 0 18px 68px rgba(0,0,0,0.6); color: #eef6ff; }
        .modal h3{ margin:0 0 8px 0; font-size:18px; }
        .modal-desc{ color:#c7d7ea; font-size:14px; margin:6px 0 12px; }
        .modal-list{ margin:0 0 14px 18px; color:#c7d7ea; }
        .modal-actions{ display:flex; gap:12px; justify-content:flex-end; }
        .countdown{ color:#ffd54d; font-weight:800; }

        .footer-section{ text-align:center; margin:28px auto 30px; padding: 0 18px; z-index:5; color:#dcdfea; }
        .footer-links{ display:flex; gap:18px; justify-content:center; flex-wrap:wrap; margin-bottom:8px; }
        .footer-links a{ color:#ffd54d; text-decoration:none; font-weight:600; }
        .support-text{ font-size:14px; color:#cdd6e6; margin:6px 0; }
        .support-text a{ color:#ff9fb0; font-weight:700; text-decoration:none; }

        @media (max-width:768px){
          .container{ flex-direction:column; align-items:center; padding:12px; gap:16px; margin-top:10px; }
          .welcome-title{ font-size:40px; }
          .why-card{ width:92%; }
          .right{ width:100%; margin-top:6px; display:flex; justify-content:center; }
          .form-container{ width:94%; padding:16px; }
        }
      `}</style>
    </>
  );
}
