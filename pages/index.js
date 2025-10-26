// pages/index.js
"use client";
import Head from "next/head";
import { useEffect, useState, useRef } from "react";

export default function HomePage() {
  const API_BASE = "https://milan-j9u9.onrender.com";

  // --- HARD SCROLL-UNLOCK: prevents mobile freeze ---
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

    const i = setInterval(unlock, 500);
    return () => clearInterval(i);
  }, []);

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

  /** HEARTS - Rising from bottom */
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
        size: small ? Math.random() * 20 + 8 : Math.random() * 32 + 14,
        speed: small ? Math.random() * 1.2 + 0.4 : Math.random() * 2 + 0.8,
        color: small
          ? ["#ff6b9d", "#ff4fa0", "#ff1493"][Math.floor(Math.random() * 3)]
          : ["#ff4d6d", "#ff1c68", "#ff6b81", "#e6005c"][
              Math.floor(Math.random() * 4)
            ],
        alpha: small ? 0.8 : 1,
        wobble: Math.random() * Math.PI * 2,
      };
    }

    function drawHearts() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hearts.forEach((h) => {
        ctx.save();
        ctx.globalAlpha = h.alpha;
        ctx.translate(h.x, h.y);

        // Wobble effect
        h.wobble += 0.02;
        ctx.rotate(Math.sin(h.wobble) * 0.1);

        ctx.fillStyle = h.color;
        ctx.beginPath();
        const s = h.size;
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(s / 2, -s, s * 1.5, s / 3, 0, s);
        ctx.bezierCurveTo(-s * 1.5, s / 3, -s / 2, -s, 0, 0);
        ctx.fill();
        ctx.restore();

        h.y -= h.speed;
        h.alpha *= 0.998; // Fade as it rises
      });

      hearts = hearts.filter((h) => h.y + h.size > -100 && h.alpha > 0.05);

      const spawnProb = heartsRef.current.smallMode ? 0.08 : 0.15;
      if (Math.random() < spawnProb) hearts.push(createHeart());

      if (heartsRef.current.smallMode && hearts.length > 80) hearts = hearts.slice(-80);
      if (!heartsRef.current.smallMode && hearts.length > 250) hearts = hearts.slice(-250);

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

  // Toast
  function showError(msg) {
    const n = document.getElementById("errorMessage");
    if (!n) return;
    n.textContent = msg;
    n.style.display = "block";
    setTimeout(() => (n.style.display = "none"), 3500);
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

  // Register
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
        localStorage.setItem("milan_name", name);
        window.location.href = "/connect";
      } else showError(data.message || data.error || "Registration failed");
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
        if (data.user && data.user.name) {
          localStorage.setItem("milan_name", data.user.name);
        }
        window.location.href = "/connect";
      } else showError(data.message || data.error || "Login failed");
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
      } else showError(data.message || data.error || "Reset failed");
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

  return (
    <>
      <Head>
        <title>Milan – Where Hearts Connect</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0b1220" />
      </Head>

      {/* Background hearts */}
      <canvas id="heartsCanvas" aria-hidden={!enableHearts}></canvas>

      <div id="errorMessage" style={{ display: "none" }} role="alert"></div>

      <div className="page-wrap">
        <div className="container">
          <div className="left">
            <div className="welcome-box" role="region" aria-label="Welcome to Milan">
              <div className="welcome-row">
                <h1 className="welcome-title">Milan</h1>
                <span className="pulse-heart" aria-hidden>
                  ❤️
                </span>
              </div>
              <h3 className="tagline">
                <span>Where Hearts Connect</span>
                <span className="beating-heart">💕</span>
              </h3>
              <p className="welcome-text">
                "Love recognizes no barriers. It jumps hurdles, leaps fences,
                penetrates walls to arrive at its destination full of hope."
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
                    Romantic UI, soft animations and a gentle atmosphere for real
                    connections.
                  </p>
                </div>
                <div className="why-card">
                  <div className="why-emoji">🕶️</div>
                  <h4>Anonymous & Fun</h4>
                  <p>Chat anonymously, express freely – it's light, friendly & playful.</p>
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
                    <label htmlFor="terms" className="terms-label">
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
            <h3>Before you continue – A quick consent</h3>
            <p className="modal-desc">
              By continuing you agree to Milan's Terms & Privacy. We value your safety –
              we moderate content, do not share personal data, and provide reporting tools.
            </p>
            <ul className="modal-list">
              <li>We moderate chats & profiles.</li>
              <li>We do not share your email/mobile with strangers.</li>
              <li>You can report/block anyone from the profile options.</li>
            </ul>
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => setShowConsent(false)} onMouseDown={rippleEffect}>
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
          background: #0b1220;
        }
        #__next { min-height: 100%; }
      `}</style>

      <style>{`
        :root{ 
          --bg-1:#0b1220; 
          --bg-2:#0f2030; 
          --accent1:#ff6b81; 
          --accent2:#ff9fb0; 
          --muted:#c7d7ea; 
        }
        
        html,body{ 
          margin:0; 
          padding:0; 
          font-family:Poppins, "Segoe UI", Roboto, sans-serif; 
          background: radial-gradient(1200px circle at 10% 0%, #1a0a1e 0%, var(--bg-1) 35%, var(--bg-2) 100%); 
          color:#eef6ff; 
        }
        
        #heartsCanvas{ 
          position:fixed; 
          inset:0; 
          z-index:0; 
          pointer-events:none; 
        }
        
        #errorMessage{ 
          position:fixed; 
          top:18px; 
          left:50%; 
          transform:translateX(-50%); 
          background:rgba(0,0,0,0.85); 
          color:#fff; 
          padding:12px 18px; 
          border-radius:12px; 
          display:none; 
          z-index:9999; 
          font-weight:700; 
          box-shadow: 0 8px 24px rgba(255,79,160,0.3);
        }

        .page-wrap{ 
          position:relative; 
          z-index:5; 
          min-height:100vh;
          max-height:100vh;
          display:flex; 
          flex-direction:column; 
          justify-content:space-between;
          overflow-y: auto;
          overflow-x: hidden;
        }
        
        .container{ 
          width:100%; 
          max-width:1400px; 
          margin:0 auto;
          display:flex; 
          gap:40px; 
          padding:20px; 
          align-items:center; 
          justify-content:center; 
          flex-wrap:wrap;
          min-height: calc(100vh - 120px);
        }
        
        .left{ 
          flex:1 1 580px; 
          min-width:320px; 
          display:flex; 
          align-items:center; 
          justify-content:center; 
        }
        
        .right{ 
          flex:0 0 460px; 
          min-width:320px; 
          display:flex; 
          align-items:center; 
          justify-content:center; 
        }

        .welcome-box{ 
          background: linear-gradient(145deg, rgba(255,79,160,0.08), rgba(139,92,246,0.05)); 
          border-radius:24px; 
          padding:36px 42px; 
          box-shadow: 0 20px 60px rgba(255,79,160,0.15); 
          max-width:720px; 
          text-align:center; 
          border: 2px solid rgba(255,107,129,0.15); 
          backdrop-filter: blur(10px);
        }
        
        .welcome-row{ 
          display:flex; 
          align-items:center; 
          gap:20px; 
          justify-content:center; 
          margin-bottom: 10px;
        }
        
        /* BIGGER / LOGO-LIKE brand title for desktop */
        .welcome-title{ 
          font-size:110px; /* increased from 84px */
          margin:0; 
          font-weight:900; 
          background: linear-gradient(135deg, #ff4fa0, #ff1493, #ff6b9d); 
          -webkit-background-clip:text; 
          -webkit-text-fill-color:transparent; 
          text-shadow:0 12px 36px rgba(255,79,160,0.45); 
          letter-spacing: -3px;
          font-family: 'Poppins', sans-serif;
          line-height: 0.9;
        }
        
        .pulse-heart{ 
          display:inline-block; 
          font-size:56px; 
          animation: heartBeat 1200ms ease-in-out infinite; 
          transform-origin:center; 
          filter: drop-shadow(0 8px 20px rgba(255,70,94,0.4));
        }
        
        .tagline {
          font-size: 24px;
          margin: 14px 0 20px;
          color: #ffeef8;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          text-shadow: 0 2px 12px rgba(255,107,157,0.3);
        }
        
        .beating-heart {
          display: inline-block;
          font-size: 28px;
          animation: heartBeat 800ms ease-in-out infinite;
          filter: drop-shadow(0 4px 16px rgba(255,107,157,0.5));
        }
        
        @keyframes heartBeat{ 
          0%{transform:scale(1)} 
          14%{transform:scale(1.1)} 
          28%{transform:scale(1)} 
          42%{transform:scale(1.1)} 
          70%{transform:scale(1)} 
          100%{transform:scale(1)} 
        }
        
        .welcome-text{ 
          font-size:17px; 
          color: var(--muted); 
          margin-top:14px; 
          font-weight:600; 
          line-height:1.7; 
          font-style: italic;
        }
        
        .age-note{ 
          margin-top:16px; 
          color:#ff9fb0; 
          font-weight:700; 
          font-size: 15px;
        }

        .why-grid{ 
          display:flex; 
          gap:16px; 
          margin-top:24px; 
          justify-content:center; 
          flex-wrap:wrap; 
        }
        
        .why-card{ 
          background: rgba(255,255,255,0.04); 
          border-radius:16px; 
          padding:18px; 
          width:200px; 
          box-shadow: 0 12px 32px rgba(255,79,160,0.08); 
          border:1px solid rgba(255,107,129,0.12); 
          transition: all 0.3s ease;
        }
        
        .why-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 40px rgba(255,79,160,0.15);
          border-color: rgba(255,107,129,0.25);
        }
        
        .why-emoji{ 
          font-size:32px; 
          display:block; 
          margin-bottom:10px; 
        }
        
        .why-card h4{ 
          margin:0 0 8px 0; 
          font-size:16px; 
          color:#fff; 
          font-weight: 800;
        }
        
        .why-card p{ 
          margin:0; 
          color: var(--muted); 
          font-size:13px; 
          line-height:1.5; 
        }

        /* Ensure form sits above footer / overlapping elements on desktop */
        .form-container{ 
          width:100%; 
          max-width:460px;
          background: linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03)); 
          padding:28px; 
          border-radius:20px; 
          backdrop-filter: blur(12px); 
          box-shadow: 0 20px 60px rgba(2,6,23,0.7); 
          border: 1px solid rgba(255,107,129,0.1);
          position: relative; /* added */
          z-index: 60; /* added — keep form clickable above footer/others */
          margin-bottom: 36px; /* small spacing to footer */
        }
        
        h2{ 
          font-size:22px; 
          margin:0 0 18px 0; 
          text-align:center; 
          color: #ffeef8;
          font-weight: 800;
        }
        
        label{ 
          display:block; 
          margin-top:12px; 
          font-size:14px; 
          font-weight:700; 
          color:#f3f7fb; 
        }
        
        .star {
          color: #ff6b9d;
        }
        
        input,select,textarea{ 
          width:100%; 
          padding:12px 14px; 
          margin-top:6px; 
          border-radius:10px; 
          border:1px solid rgba(255,107,129,0.2); 
          font-size:14px; 
          background: rgba(0,0,0,0.4); 
          color:#fff; 
          outline:2px solid transparent; 
          transition: all 200ms ease;
          box-sizing: border-box;
        }
        
        input:focus,select:focus,textarea:focus{ 
          outline:2px solid rgba(255,107,129,0.4); 
          transform: translateY(-2px); 
          background: rgba(0,0,0,0.5);
        }
        
        textarea{ 
          min-height:80px; 
          resize:vertical; 
        }
        
        .primary-btn{ 
          position:relative; 
          overflow:hidden; 
          display:inline-flex; 
          align-items:center; 
          justify-content:center; 
          gap:8px; 
          width:100%; 
          padding:14px 16px; 
          border-radius:12px; 
          border:none; 
          cursor:pointer; 
          font-weight:800; 
          font-size:16px; 
          background: linear-gradient(135deg, #ff4fa0, #ff1493); 
          color:#fff; 
          box-shadow: 0 12px 40px rgba(255,79,160,0.3); 
          transition: all 0.3s ease;
          margin-top: 16px;
        }
        
        .primary-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 48px rgba(255,79,160,0.4);
        }
        
        .primary-btn:disabled{ 
          opacity:.7; 
          cursor:not-allowed; 
          transform:none; 
        }
        
        .ripple{ 
          position:absolute; 
          border-radius:50%; 
          transform: scale(0); 
          animation: ripple 700ms linear; 
          background: rgba(255,255,255,0.4); 
          pointer-events:none; 
        }
        
        @keyframes ripple{ 
          to{ 
            transform: scale(4); 
            opacity:0; 
          } 
        }
        
        .btn-loader{ 
          width:18px; 
          height:18px; 
          border-radius:50%; 
          border:2px solid rgba(255,255,255,0.2); 
          border-top:2px solid rgba(255,255,255,0.9); 
          animation: spin 800ms linear infinite; 
          display:inline-block; 
          margin-right:8px; 
        }
        
        @keyframes spin{ 
          to{ 
            transform: rotate(360deg); 
          } 
        }
        
        .terms-container{ 
          display:flex; 
          align-items:flex-start; 
          gap:10px; 
          margin-top:14px; 
          padding: 12px;
          background: rgba(255,107,129,0.05);
          border-radius: 10px;
          border: 1px solid rgba(255,107,129,0.15);
        }
        
        .terms-container input[type="checkbox"] {
          margin-top: 3px;
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          cursor: pointer;
          accent-color: #ff4fa0;
        }
        
        .terms-label {
          font-size: 13px;
          color: #e9f0ff;
          line-height: 1.6;
          margin: 0;
          cursor: pointer;
        }
        
        .terms-container a{ 
          color:#ff9fb0; 
          text-decoration:none; 
          font-weight:700; 
        }
        
        .terms-container a:hover {
          text-decoration: underline;
          color: #ff6b9d;
        }
        
        /* Make the link clearly on top and clickable */
        .link-text{ 
          text-align:center; 
          cursor:pointer; 
          color:#ff9fb0; 
          margin-top:16px; 
          font-weight:700; 
          font-size: 14px;
          position: relative; /* added */
          z-index: 70; /* added to be above nearby elements */
          pointer-events: auto; /* ensure clickable */
          display: block;
        }
        
        .link-text:hover {
          color: #ff6b9d;
        }
        
        .reset-link{ 
          text-align:center; 
          cursor:pointer; 
          color:#ff6b9d; 
          font-weight:700; 
          margin-top: 12px;
          font-size: 14px;
        }
        
        .reset-link:hover {
          color: #ff4fa0;
        }

        .ghost-btn{ 
          position:relative; 
          overflow:hidden; 
          display:inline-flex; 
          align-items:center; 
          justify-content:center; 
          gap:8px; 
          padding:12px 20px; 
          border-radius:12px; 
          border:2px solid rgba(255,107,129,0.3); 
          cursor:pointer; 
          background: rgba(255,255,255,0.05); 
          color:#ffeef8; 
          font-weight:800; 
          transition: all 0.3s ease;
        }
        
        .ghost-btn:hover {
          background: rgba(255,107,129,0.1);
          border-color: rgba(255,107,129,0.5);
        }

        .modal-back{ 
          position:fixed; 
          inset:0; 
          background: rgba(0,0,0,0.8); 
          backdrop-filter: blur(8px);
          display:flex; 
          align-items:center; 
          justify-content:center; 
          z-index: 99999; 
          padding: 20px;
        }
        
        .modal{ 
          width:92%; 
          max-width:540px; 
          background: linear-gradient(145deg, rgba(255,79,160,0.15), rgba(139,92,246,0.1)); 
          padding:28px; 
          border-radius:20px; 
          box-shadow: 0 24px 80px rgba(255,79,160,0.3); 
          color: #eef6ff; 
          border: 2px solid rgba(255,107,129,0.2);
        }
        
        .modal h3{ 
          margin:0 0 12px 0; 
          font-size:22px; 
          color: #ffeef8;
          font-weight: 800;
        }
        
        .modal-desc{ 
          color:#c7d7ea; 
          font-size:15px; 
          margin:8px 0 16px; 
          line-height: 1.6;
        }
        
        .modal-list{ 
          margin:0 0 20px 20px; 
          color:#c7d7ea; 
          line-height: 1.8;
        }
        
        .modal-list li {
          margin-bottom: 8px;
        }
        
        .modal-actions{ 
          display:flex; 
          gap:12px; 
          justify-content:flex-end; 
          margin-top: 24px;
        }

        /* Lower footer z-index so content (form link) stays clickable above it */
        .footer-section{ 
          text-align:center; 
          padding: 20px 18px; 
          z-index:2; /* reduced from higher to avoid overlap */
          color:#dcdfea;
          background: rgba(0,0,0,0.2);
          border-top: 1px solid rgba(255,107,129,0.1);
        }
        
        .footer-links{ 
          display:flex; 
          gap:20px; 
          justify-content:center; 
          flex-wrap:wrap; 
          margin-bottom:10px; 
        }
        
        .footer-links a{ 
          color:#ff9fb0; 
          text-decoration:none; 
          font-weight:600; 
          font-size: 13px;
        }
        
        .footer-links a:hover {
          color: #ff6b9d;
          text-decoration: underline;
        }
        
        .support-text{ 
          font-size:13px; 
          color:#cdd6e6; 
          margin:8px 0; 
        }
        
        .support-text a{ 
          color:#ff9fb0; 
          font-weight:700; 
          text-decoration:none; 
        }
        
        .support-text a:hover {
          text-decoration: underline;
        }
        
        .copyright {
          font-size: 12px;
          color: #9ca9bb;
          margin-top: 6px;
        }

        @media (max-width:1024px){
          .container{ 
            gap:30px; 
            padding:16px; 
          }
          
          .welcome-title{ 
            font-size:72px; 
          }
          
          .pulse-heart {
            font-size: 48px;
          }
        }

        @media (max-width:768px){
          .page-wrap {
            min-height: auto;
            max-height: none;
          }

          .container{ 
            flex-direction:column; 
            align-items:center; 
            padding:16px 12px; 
            gap:24px; 
            min-height: auto;
          }
          
          .welcome-title{ 
            font-size:56px;
            letter-spacing: -2px; 
          }
          
          .pulse-heart {
            font-size: 42px;
          }
          
          .tagline {
            font-size: 20px;
          }
          
          .beating-heart {
            font-size: 24px;
          }
          
          .welcome-text {
            font-size: 15px;
          }
          
          .age-note {
            font-size: 14px;
          }
          
          .why-card{ 
            width:100%; 
            max-width: 320px;
          }
          
          .left {
            flex: 1 1 auto;
          }
          
          .right{ 
            width:100%;
            flex: 0 0 auto;
          }
          
          .form-container{ 
            width:100%; 
            max-width: 100%;
            padding:24px 20px; 
            margin-bottom: 18px; /* smaller mobile spacing */
            z-index: 60;
          }
          
          .welcome-box {
            padding: 28px 24px;
          }
          
          .modal {
            padding: 24px 20px;
          }
          
          .modal-actions {
            flex-direction: column;
          }
          
          .modal-actions button {
            width: 100%;
          }

          label {
            font-size: 13px;
            margin-top: 10px;
          }

          input, select, textarea {
            font-size: 14px;
            padding: 11px 13px;
          }

          .terms-container {
            padding: 10px;
          }

          .terms-label {
            font-size: 12px;
          }

          .footer-section {
            padding: 16px 12px;
          }
        }

        @media (max-width:480px){
          .welcome-title{ 
            font-size:44px; 
          }
          
          .pulse-heart {
            font-size: 36px;
          }
          
          .tagline {
            font-size: 18px;
          }
          
          .beating-heart {
            font-size: 22px;
          }

          .form-container {
            padding: 20px 16px;
          }

          h2 {
            font-size: 20px;
          }
        }
      `}</style>
    </>
  );
}
