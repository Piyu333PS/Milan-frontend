"use client";
import { useEffect, useState } from "react";

export default function HomePage() {
  const API_BASE = "https://milan-j9u9.onrender.com";
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showReset, setShowReset] = useState(false);

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

  // Theme toggle helper to update button label (keeps UX clear)
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
      <canvas id="heartsCanvas" />

      <audio id="bgMusic" loop>
        <source src="music/romantic.mp3" type="audio/mpeg" />
      </audio>

      <div id="errorMessage" />

      {/* Decorative bandanwar (pure CSS/JS generated beads) */}
      <div className="bandanwar" aria-hidden="true">
        <div className="bandanwar-string">
          {[...Array(13)].map((_, i) => (
            <span key={i} className="bandanwar-bead" style={{ left: `${6 + i * 7}%` }} />
          ))}
        </div>
      </div>

      <div className="container">
        {/* LEFT: Ganesh + message */}
        <div className="left">
          <div className="ganesh-box" role="img" aria-label="Ganesh Bappa">
            {/* Cute Ganesh (inline SVG, simple & decorative) */}
            <svg viewBox="0 0 200 220" className="ganesh-svg" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="g1" x1="0" x2="1">
                  <stop offset="0" stopColor="#ffd085" />
                  <stop offset="1" stopColor="#ffb3c1" />
                </linearGradient>
              </defs>

              {/* head */}
              <circle cx="100" cy="70" r="42" fill="url(#g1)" stroke="#ff6b81" strokeWidth="2"/>
              {/* ears */}
              <path d="M60 70 Q40 80 60 100" fill="#ffd4c2" stroke="#ff6b81" strokeWidth="1"/>
              <path d="M140 70 Q160 80 140 100" fill="#ffd4c2" stroke="#ff6b81" strokeWidth="1"/>
              {/* trunk */}
              <path d="M100 90 Q96 120 108 140 Q118 150 100 154" stroke="#ff6b81" strokeWidth="6" fill="none" strokeLinecap="round"/>
              {/* eyes */}
              <circle cx="88" cy="66" r="4" fill="#3b3b3b" />
              <circle cx="112" cy="66" r="4" fill="#3b3b3b" />
              {/* tilak */}
              <rect x="96" y="52" width="8" height="6" rx="2" fill="#ff1744" />
              {/* small crown */}
              <path d="M85 40 L100 28 L115 40 Z" fill="#ffd166" stroke="#d18b00" strokeWidth="1"/>
              {/* body heart (cute) */}
              <path d="M100 120 C 90 110, 70 120, 80 140 C 90 160, 110 170, 100 190 C 90 170, 110 160, 120 140 C 130 120, 110 110, 100 120 Z" fill="#ff6b81" opacity="0.15"/>
            </svg>

            <div className="launch-message">
              <h2>🙏 Happy Ganesh Chaturthi! 🌺</h2>
              <p>
                A new beginning not just with Bappa’s arrival, but also with the <strong>launch of Milan</strong> –<br />
                Your new destination to find love and meaningful connections.<br />
                Let’s welcome love, togetherness, and positivity this festive season. ❤️
              </p>
            </div>
          </div>

          <h1 className="welcome-title">Welcome to Milan ❤️</h1>
          <p className="welcome-sub">
            “Love recognizes no barriers. It jumps hurdles, leaps fences, penetrates walls to arrive at its
            destination full of hope.”
          </p>
        </div>

        {/* RIGHT: Form area (theme toggle moved here ABOVE music button) */}
        <div className="right">
          <div className="form-container">
            {!showLogin && !showReset && (
              <div id="registerForm">
                <h2>Create Your Account</h2>

                {/* THEME TOGGLE placed above the music button (as requested) */}
                <div style={{ marginBottom: 8 }}>
                  <button
                    id="themeToggle"
                    type="button"
                    onClick={() => document.body.classList.toggle("light-mode")}
                    className="theme-btn"
                  >
                    🌙 Toggle Theme
                  </button>
                </div>

                {/* MUSIC button below theme toggle */}
                <div style={{ marginBottom: 12 }}>
                  <button
                    id="musicBtn"
                    type="button"
                    onClick={() => {
                      const bgMusic = document.getElementById("bgMusic");
                      if (musicPlaying) {
                        bgMusic.pause();
                      } else {
                        bgMusic.play().catch(() => {});
                      }
                      setMusicPlaying(!musicPlaying);
                    }}
                    className="music-btn"
                  >
                    {musicPlaying ? "Music Off" : "Music On"}
                  </button>
                </div>

                <label>Name <span className="star">*</span></label>
                <input type="text" id="name" placeholder="Your name or nickname" />

                <label>Gender <span className="star">*</span></label>
                <select id="gender">
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>

                <label>Email or Mobile <span className="star">*</span></label>
                <input type="text" id="contact" placeholder="Email or 10-digit Mobile number" />

                <label>Password <span className="star">*</span></label>
                <input type="password" id="password" placeholder="Enter password" />

                <label>Age <span className="star">*</span></label>
                <input type="number" id="age" placeholder="Your age" min="18" max="99" />

                <label>City/Country <span className="star">*</span></label>
                <input type="text" id="city" placeholder="City / Country" />

                <label>Reason for Joining <span className="star">*</span></label>
                <select id="reason">
                  <option value="">Select reason</option>
                  <option value="Looking for Love">Looking for Love ❤️</option>
                  <option value="Friendship">Friendship 🤗</option>
                  <option value="Casual Chat">Casual Chat 🎈</option>
                  <option value="Exploring">Exploring 🌎</option>
                  <option value="Other">Other</option>
                </select>

                <button onClick={handleRegister} className="primary-btn">Register & Start</button>
                <p style={{ textAlign: "center", cursor: "pointer", color: "yellow" }} onClick={() => setShowLogin(true)}>
                  Already Registered? Login here
                </p>
              </div>
            )}

            {showLogin && !showReset && (
              <div id="loginForm">
                <h2>Login to Milan</h2>

                {/* Theme toggle here too for convenience on login screen */}
                <div style={{ marginBottom: 8 }}>
                  <button
                    id="themeToggleLogin"
                    type="button"
                    onClick={() => document.body.classList.toggle("light-mode")}
                    className="theme-btn"
                  >
                    🌙 Toggle Theme
                  </button>
                </div>

                <label>Email or Mobile</label>
                <input type="text" id="loginContact" placeholder="Enter Email/Mobile" />
                <label>Password</label>
                <input type="password" id="loginPassword" placeholder="Enter password" />
                <button onClick={handleLogin} className="primary-btn">Login</button>
                <p style={{ textAlign: "center", cursor: "pointer", color: "yellow" }} onClick={() => setShowLogin(false)}>
                  New User? Register here
                </p>
                <p style={{ textAlign: "center", cursor: "pointer", color: "#ff4d4f" }} onClick={() => setShowReset(true)}>
                  Forgot Password?
                </p>
              </div>
            )}

            {showReset && (
              <div id="resetForm">
                <h2>Reset Password</h2>
                <label>Email or Mobile</label>
                <input type="text" id="resetContact" placeholder="Enter your Email/Mobile" />
                <label>New Password</label>
                <input type="password" id="newPassword" placeholder="Enter new password" />
                <button onClick={handleReset} className="primary-btn">Reset Password</button>
                <p style={{ textAlign: "center", cursor: "pointer", color: "yellow" }}
                   onClick={() => { setShowReset(false); setShowLogin(true); }}>
                  Back to Login
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Styles */}
      <style jsx global>{`
        :root {
          --bg-color: #141318;
          --text-color: #fff;
          --muted: rgba(255,255,255,0.7);
          --card: rgba(255,255,255,0.06);
          --accent: #ff4d6d;
        }
        .light-mode {
          --bg-color: #f3f4f6;
          --text-color: #111827;
          --muted: rgba(0,0,0,0.6);
          --card: rgba(0,0,0,0.04);
          --accent: #d946ef;
        }
        html,body,#__next { height: 100%; }
        body {
          margin: 0; padding: 0; height: 100%;
          background: var(--bg-color); color: var(--text-color);
          font-family: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial;
        }

        /* hearts canvas sits under everything */
        #heartsCanvas { position: fixed; inset: 0; z-index: 0; }

        /* bandanwar at top */
        .bandanwar {
          position: fixed; top: 0; left: 0; width: 100%; height: 82px; z-index: 40; pointer-events: none;
          display: flex; align-items: center; justify-content: center;
        }
        .bandanwar-string {
          position: relative; width: 88%; height: 6px; background: linear-gradient(90deg,#8b5e3c,#b07c4a); border-radius: 6px;
          box-shadow: 0 2px 0 rgba(0,0,0,0.3);
          transform-origin: center;
          animation: bandSwing 3.5s ease-in-out infinite;
        }
        @keyframes bandSwing {
          0%,100%{ transform: rotate(0deg); } 50%{ transform: rotate(1.8deg); }
        }
        .bandanwar-bead {
          position: absolute; top: -12px; width: 18px; height: 18px; border-radius: 50%; background: #ffb347;
          box-shadow: 0 6px 0 rgba(0,0,0,0.08) inset;
        }

        .container {
          position: relative; z-index: 10; display: flex; align-items: center; justify-content: center;
          gap: 24px; height: 100%; padding: 28px; padding-top: 110px; /* offset for bandanwar */
        }
        .left, .right { flex: 1; padding: 12px; min-width: 280px; max-width: 720px; }
        .left { display:flex; flex-direction:column; gap:12px; }
        .ganesh-box { display:flex; gap:12px; align-items:center; }
        .ganesh-svg { width: 140px; height: 160px; flex-shrink:0; filter: drop-shadow(0 6px 16px rgba(0,0,0,0.5)); border-radius:12px; background: linear-gradient(180deg,rgba(255,255,255,0.02), rgba(255,255,255,0.00)); padding:6px; }
        .launch-message h2 { margin:0 0 6px 0; color: #ffd166; font-size: 1.2rem; }
        .launch-message p { margin:0; color: var(--muted); line-height:1.4; }

        .welcome-title { margin: 10px 0 4px 0; font-size: 2rem; }
        .welcome-sub { margin: 0; color: var(--muted); max-width: 560px; }

        .form-container {
          background: var(--card); padding: 20px; border-radius: 14px; box-shadow: 0 8px 30px rgba(0,0,0,0.35);
        }

        h2 { margin-top:0; color: var(--text-color); text-align: center; }

        label { display:block; margin-top:10px; font-weight:600; color: var(--muted); font-size: 13px; }
        .star { color: #ff6b81; margin-left:6px; }

        input, select, textarea {
          width:100%; padding:10px 12px; margin-top:8px; border-radius:8px; border:1px solid rgba(255,255,255,0.04);
          background: transparent; color: var(--text-color); font-size:14px;
        }

        .theme-btn, .music-btn, .primary-btn {
          width:100%; padding:10px 12px; border-radius:8px; border:none; cursor:pointer; font-weight:700;
        }
        .theme-btn { background: linear-gradient(90deg,#111827,#334155); color:#fff; margin-bottom:6px; }
        .music-btn { background: linear-gradient(90deg,var(--accent), #f973b2); color:#fff; margin-bottom:6px; }
        .primary-btn { background: linear-gradient(90deg,#ff4d6d,#ff8aa1); color:#fff; margin-top:12px; }

        .primary-btn:hover, .music-btn:hover, .theme-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 26px rgba(0,0,0,0.4); }

        #errorMessage {
          display:none; position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%);
          background: #ff4d4f; color: #fff; padding: 10px 16px; border-radius: 8px; z-index:9999;
        }

        @media (max-width: 900px) {
          .container { flex-direction: column; padding-top: 80px; gap:18px; }
          .ganesh-svg { width: 110px; height: 120px; }
          .left, .right { max-width: 640px; }
        }
      `}</style>
    </>
  );
}
