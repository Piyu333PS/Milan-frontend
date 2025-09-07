
"use client";
import { useEffect, useState, useRef } from "react";

/**
 * index_final_revert.js
 * - Reverts form style to a simpler, compact grey card (like your preferred older version).
 * - Reduces hearts density and size to avoid visual clutter.
 * - Adjusts layout and sizes so the main content fits within the viewport (minimize vertical scrolling).
 * - Keeps features: hearts canvas (lighter), consent modal, ripple + loader, footer, why-cards.
 *
 * Replace your pages/index.js with this file (backup original first).
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

  // hearts control (light)
  const heartsRef = useRef({ raf: null, smallMode: false });

  useEffect(() => {
    const smallScreen = window.innerWidth < 760;
    heartsRef.current.smallMode = smallScreen;
    startHearts(); // lightweight always
    // ensure body fits viewport
    document.documentElement.style.height = "100%";
    document.body.style.height = "100%";
    return () => stopHearts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        y: canvas.height + 30,
        size: small ? Math.random() * 16 + 6 : Math.random() * 20 + 8,
        speed: small ? Math.random() * 0.8 + 0.3 : Math.random() * 1.2 + 0.4,
        color: ["#ff6b81", "#ff9fb0", "#ff4d6d"][Math.floor(Math.random() * 3)],
        alpha: small ? 0.7 : 0.85,
      };
    }

    function drawHearts() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hearts.forEach((h) => {
        ctx.save();
        ctx.globalAlpha = h.alpha;
        ctx.translate(h.x, h.y);
        ctx.rotate(Math.sin(h.y / 40) * 0.02);
        ctx.fillStyle = h.color;
        ctx.beginPath();
        const s = h.size;
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(s / 2, -s, s * 1.2, s / 3, 0, s);
        ctx.bezierCurveTo(-s * 1.2, s / 3, -s / 2, -s, 0, 0);
        ctx.fill();
        ctx.restore();
        h.y -= h.speed;
      });

      hearts = hearts.filter((h) => h.y + h.size > -50);

      const spawnProb = heartsRef.current.smallMode ? 0.04 : 0.08; // lighter
      if (Math.random() < spawnProb) hearts.push(createHeart());

      // limit for performance
      if (heartsRef.current.smallMode && hearts.length > 40) hearts = hearts.slice(-40);
      if (!heartsRef.current.smallMode && hearts.length > 140) hearts = hearts.slice(-140);

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
    setTimeout(() => circle.remove(), 600);
  }

  async function registerUser() {
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

  function onRegisterClick(e) {
    rippleEffect(e);
    if (!consentAccepted) {
      setShowConsent(true);
      return;
    }
    registerUser();
  }

  function acceptConsent() {
    setConsentAccepted(true);
    setShowConsent(false);
    setTimeout(() => {
      registerUser();
    }, 140);
  }
  function cancelConsent() {
    setConsentAccepted(false);
    setShowConsent(false);
  }

  return (
    <>
      <canvas id="heartsCanvas" aria-hidden="false"></canvas>
      <div id="errorMessage" style={{ display: "none" }} role="alert"></div>

      <div className="page-wrap">
        <div className="container" role="main">
          <div className="left">
            <div className="welcome-box">
              <div className="welcome-row">
                <h1 className="welcome-title">Welcome to Milan</h1>
                <span className="pulse-heart" aria-hidden="true">❤</span>
              </div>
              <p className="welcome-text">
                “Love recognizes no barriers. It jumps hurdles, leaps fences, penetrates walls to arrive at its destination full of hope.”
              </p>
              <p className="age-note">🔞 Milan is strictly for 18+ users.</p>

              <div className="why-grid">
                <div className="why-card">
                  <div className="why-emoji">🔒</div>
                  <h4>Safe & Moderated</h4>
                  <p>Profiles monitored, reporting tools and community guidelines keep things safe.</p>
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
            <div className="form-container simple" role="form" aria-label="Signup or Login">
              {!showLogin && !showReset && (
                <div id="registerForm">
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

                  <textarea id="otherReason" placeholder="If other, please describe" style={{ display: "none" }} />

                  <div className="terms-container">
                    <input type="checkbox" id="terms" />
                    <label htmlFor="terms" style={{ marginLeft: 8 }}>
                      I agree to the <a href="/terms.html" target="_blank" rel="noreferrer">Terms</a>, <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy</a>, <a href="/guidelines.html" target="_blank" rel="noreferrer">Guidelines</a>
                    </label>
                  </div>

                  <button className="primary-btn" onClick={onRegisterClick} disabled={loadingRegister} onMouseDown={(e) => rippleEffect(e)}>
                    {loadingRegister ? <span className="btn-loader" /> : null}
                    Register & Start
                  </button>

                  <p className="link-text" onClick={() => setShowLogin(true)}>Already Registered? Login</p>
                </div>
              )}

              {showLogin && !showReset && (
                <div id="loginForm">
                  <h2>Login to Milan</h2>
                  <label>Email or Mobile</label>
                  <input id="loginContact" />
                  <label>Password</label>
                  <input type="password" id="loginPassword" />
                  <button className="primary-btn" onClick={handleLogin} disabled={loadingLogin} onMouseDown={(e) => rippleEffect(e)}>
                    {loadingLogin ? <span className="btn-loader" /> : null}
                    Login
                  </button>
                  <p className="link-text" onClick={() => setShowLogin(false)}>New User? Register</p>
                  <p className="reset-link" onClick={() => setShowReset(true)}>Forgot Password?</p>
                </div>
              )}

              {showReset && (
                <div id="resetForm">
                  <h2>Reset Password</h2>
                  <label>Email or Mobile</label>
                  <input id="resetContact" />
                  <label>New Password</label>
                  <input type="password" id="newPassword" />
                  <button className="primary-btn" onClick={handleReset} disabled={loadingLogin} onMouseDown={(e) => rippleEffect(e)}>
                    {loadingLogin ? <span className="btn-loader" /> : null}
                    Reset Password
                  </button>
                  <p className="link-text" onClick={() => { setShowReset(false); setShowLogin(true); }}>Back to Login</p>
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
          <p className="support-text">For any support, contact us at <a href="mailto:Support@milanlove.in">Support@milanlove.in</a></p>
          <p className="copyright">© {new Date().getFullYear()} Milan. All rights reserved.</p>
        </footer>
      </div>

      {/* Consent modal */}
      {showConsent && (
        <div className="modal-back" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Before you continue — A quick consent</h3>
            <p className="modal-desc">By continuing you agree to Milan's Terms & Privacy. We value your safety — we moderate content, do not share personal data, and provide reporting tools.</p>
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
        :root{
          --bg-1:#071021;
          --bg-2:#0b2030;
          --accent:#ff6b81;
          --muted:#cbd7ea;
        }
        html,body{height:100%;margin:0;padding:0;font-family:"Poppins", "Segoe UI", Roboto, sans-serif;background:linear-gradient(180deg,var(--bg-1) 0%,var(--bg-2) 100%);color:#eef6ff;overflow-y:auto;}

        /* canvas */
        #heartsCanvas{position:fixed;inset:0;z-index:0;pointer-events:none;}

        #errorMessage{position:fixed;top:18px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:#fff;padding:10px 14px;border-radius:8px;display:none;z-index:9999;font-weight:700;}

        .page-wrap{position:relative;z-index:5;min-height:100vh;display:flex;flex-direction:column;justify-content:space-between;}

        /* container set to fit viewport - less vertical overflow */
        .container{
          width:100%;
          max-width:1000px;
          margin: 18px auto 12px;
          display:grid;
          grid-template-columns: 1fr 420px;
          gap:28px;
          padding:12px;
          align-items:start;
          min-height: calc(100vh - 140px); /* tries to fit the main area within viewport */
        }

        /* LEFT */
        .left{display:flex;align-items:flex-start;justify-content:flex-start;padding-left:6px;}
        .welcome-box{
          width:100%;
          background:linear-gradient(180deg, rgba(6,10,14,0.6), rgba(10,14,20,0.45));
          border-radius:12px;padding:24px;box-shadow:0 10px 28px rgba(2,6,23,0.5);
          border:1px solid rgba(255,107,129,0.04);
        }
        .welcome-row{display:flex;align-items:center;gap:12px;justify-content:flex-start;}
        .welcome-title{font-size:44px;margin:0;font-weight:900;background:linear-gradient(90deg,var(--accent),#ff9fb0);-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-shadow:0 8px 24px rgba(0,0,0,0.45);}
        .pulse-heart{font-size:30px;color:#ff465e;animation:heartBeat 1000ms linear infinite;}
        @keyframes heartBeat{0%{transform:scale(1)}30%{transform:scale(1.22)}50%{transform:scale(1)}100%{transform:scale(1)}}
        .welcome-text{margin-top:12px;font-size:18px;color:var(--muted);line-height:1.6;font-weight:600;max-width:760px;}
        .age-note{margin-top:12px;color:#ffd7e0;font-weight:700;}

        .why-grid{display:flex;gap:12px;margin-top:18px;flex-wrap:wrap;}
        .why-card{background:rgba(255,255,255,0.02);border-radius:10px;padding:12px;width:200px;box-shadow:0 8px 20px rgba(2,6,23,0.35);border:1px solid rgba(255,255,255,0.02);}
        .why-emoji{font-size:22px;margin-bottom:6px;}
        .why-card h4{margin:0 0 6px 0;font-size:15px;color:#fff;}
        .why-card p{margin:0;color:var(--muted);font-size:13px;line-height:1.45;}

        /* RIGHT: simple old-style form */
        .right{display:flex;justify-content:center;align-items:flex-start;}
        .form-container.simple{
          width:100%;
          max-width:420px; /* revert to old comfortable size */
          background: linear-gradient(180deg, rgba(200,200,200,0.06), rgba(160,160,160,0.03));
          padding:20px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);box-shadow:0 6px 18px rgba(2,6,23,0.45);
        }

        h2{font-size:18px;margin:0 0 10px 0;text-align:center;color:#fff;font-weight:800;}

        label{display:block;margin-top:8px;font-size:14px;font-weight:700;color:#eef6ff;}
        input, select, textarea{
          width:100%;padding:10px 12px;margin-top:6px;border-radius:6px;border:1px solid rgba(0,0,0,0.15);font-size:14px;background:#fff;color:#111;box-sizing:border-box;
        }
        input:focus, select:focus, textarea:focus{outline:2px solid rgba(255,107,129,0.18);}

        .primary-btn{width:100%;padding:10px;border-radius:6px;border:none;background:#ff9fb0;color:#08121a;font-weight:800;margin-top:12px;cursor:pointer;}
        .primary-btn:disabled{opacity:0.85;cursor:not-allowed;}
        .btn-loader{width:16px;height:16px;border-radius:50%;border:2px solid rgba(0,0,0,0.12);border-top:2px solid rgba(255,255,255,0.9);animation:spin 900ms linear infinite;display:inline-block;margin-right:8px;}
        @keyframes spin{to{transform:rotate(360deg)}}

        .terms-container{display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13px;color:#e3e9f2;}
        .terms-container a{color:#ffd54d;text-decoration:none;font-weight:700;}

        .link-text{color:#ffd54d;text-align:center;margin-top:10px;cursor:pointer;font-weight:700;}
        .reset-link{color:#ff7a8a;text-align:center;cursor:pointer;margin-top:8px;}

        /* footer */
        .footer-section{ text-align:center;margin:18px auto 16px;padding:0 18px;color:#dcdfea;font-size:13px;}
        .footer-links{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:6px;}
        .footer-links a{color:#ffd54d;text-decoration:none;font-weight:600;}
        .support-text{color:#cdd6e6;margin:6px 0;font-size:13px;}
        .copyright{color:#aab5c6;margin-top:6px;font-size:12px;}

        /* modal */
        .modal-back{position:fixed;inset:0;background:rgba(2,6,23,0.65);display:flex;align-items:center;justify-content:center;z-index:99999;}
        .modal{width:92%;max-width:520px;background:linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01));padding:18px;border-radius:10px;color:#eef6ff;}
        .modal h3{margin:0 0 8px 0;font-size:18px;}
        .modal-desc{color:var(--muted);font-size:14px;margin:6px 0 12px 0;}
        .modal-list{margin:0 0 14px 18px;color:var(--muted);}
        .modal-actions{display:flex;gap:10px;justify-content:flex-end;}

        /* responsive tweaks */
        @media (max-width: 980px){
          .container{grid-template-columns:1fr 380px;max-width:880px;gap:18px;padding:12px;min-height:calc(100vh - 150px);}
          .welcome-title{font-size:40px;}
        }
        @media (max-width: 760px){
          .container{display:block;padding:12px;margin-top:6px;min-height:auto;}
          .welcome-title{font-size:28px;text-align:center;}
          .welcome-box{padding:16px;}
          .form-container.simple{max-width:100%;width:94%;margin:6px auto;padding:18px;}
        }
      `}</style>
    </>
  );
}
