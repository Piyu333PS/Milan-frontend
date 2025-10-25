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

  // Fireworks (bursts)
  const fwRef = useRef({ ents: [], raf: null, burst: () => {}, cleanup: null });

  // Rockets (niche se upar)
  const rocketsRef = useRef({ ents: [], raf: null, cleanup: null });

  // Wish modal
  const [showWish, setShowWish] = useState(false);
  const [wishText, setWishText] = useState("");
  const [wishDone, setWishDone] = useState(false);

  // Gift Box
  const [showGift, setShowGift] = useState(false);
  const [giftAccepted, setGiftAccepted] = useState(false);
  const offerEndsAt = new Date("2025-10-31T23:59:59+05:30").getTime();
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    const smallScreen =
      window.innerWidth < 760 ||
      (window.devicePixelRatio > 1.5 && window.innerWidth < 980);

    heartsRef.current.smallMode = smallScreen;
    setEnableHearts(true);
    startHearts();
    startFireworks();
    startRockets();

    const t = setInterval(() => {
      const diff = offerEndsAt - Date.now();
      if (diff <= 0) {
        setCountdown("Offer ended");
        clearInterval(t);
        return;
      }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setCountdown(`${d}d : ${h}h : ${m}m : ${s}s`);
    }, 1000);

    return () => {
      stopHearts();
      stopFireworks();
      stopRockets();
      clearInterval(t);
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
        y: canvas.height + (small ? 30 : 50),
        size: small ? Math.random() * 18 + 6 : Math.random() * 28 + 12,
        speed: small ? Math.random() * 0.9 + 0.3 : Math.random() * 1.6 + 0.6,
        color: small
          ? ["#ff7a9a", "#ff6b81", "#ff9fb0"][Math.floor(Math.random() * 3)]
          : ["#ff4d6d", "#ff1c68", "#ff6b81", "#e6005c"][
              Math.floor(Math.random() * 4)
            ],
        alpha: small ? 0.75 : 0.95,
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
      hearts = hearts.filter((h) => h.y + h.size > -60);
      const spawnProb = heartsRef.current.smallMode ? 0.06 : 0.12;
      if (Math.random() < spawnProb) hearts.push(createHeart());
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
    heartsRef.current.cleanup && heartsRef.current.cleanup();
  }

  /** FIREWORKS (bursts) */
  function startFireworks() {
    const cvs = document.getElementById("fireworksCanvas");
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    let W, H, ents = [];

    function resize() {
      W = cvs.width = window.innerWidth;
      H = cvs.height = window.innerHeight;
    }
    window.addEventListener("resize", resize);
    resize();

    function rand(a, b) {
      return a + Math.random() * (b - a);
    }
    function hsv(h, s, v) {
      const f = (n, k = (n + h / 60) % 6) =>
        v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
      return `rgb(${(f(5) * 255) | 0},${(f(3) * 255) | 0},${(f(1) * 255) | 0})`;
    }

    function burst(x, y) {
      const n = (60 + Math.random() * 40) | 0;
      const hue = Math.random() * 360;
      for (let i = 0; i < n; i++) {
        const speed = rand(1.2, 3.2);
        const ang = ((Math.PI * 2) * i) / n + rand(-0.03, 0.03);
        ents.push({
          x,
          y,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - rand(0.2, 0.6),
          life: rand(0.9, 1.4),
          age: 0,
          color: hsv(hue + rand(-20, 20), 0.9, 1),
          r: rand(1, 2.2),
        });
      }
    }

    function tick() {
      ctx.fillStyle = "rgba(10,7,16,0.22)";
      ctx.fillRect(0, 0, W, H);
      if (Math.random() < 0.015)
        burst(rand(W * 0.1, W * 0.9), rand(H * 0.1, H * 0.6));
      ents = ents.filter((p) => (p.age += 0.016) < p.life);
      for (const p of ents) {
        p.vy += 0.5 * 0.016;
        p.x += p.vx;
        p.y += p.vy;
        const a = 1 - p.age / p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color
          .replace("rgb", "rgba")
          .replace(")", `,${a.toFixed(2)})`);
        ctx.fill();
      }
      fwRef.current.raf = requestAnimationFrame(tick);
    }
    tick();

    fwRef.current.burst = burst;
    fwRef.current.cleanup = () => {
      cancelAnimationFrame(fwRef.current.raf);
      window.removeEventListener("resize", resize);
    };
  }
  function stopFireworks() {
    fwRef.current.cleanup && fwRef.current.cleanup();
  }

  /** ROCKETS (bottom → top, with trail + optional burst) */
  function startRockets() {
    const cvs = document.getElementById("rocketsCanvas");
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    let W, H;
    let rockets = [];

    function resize() {
      W = cvs.width = window.innerWidth;
      H = cvs.height = window.innerHeight;
    }
    window.addEventListener("resize", resize);
    resize();

    function spawnRocket() {
      rockets.push({
        x: Math.random() * W * 0.9 + W * 0.05,
        y: H + 20,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -(3.8 + Math.random() * 1.6),
        life: 0,
        hue: Math.random() * 360,
        trail: [],
      });
    }

    // launch cadence
    const launcher = setInterval(() => {
      const launches = window.innerWidth > 768 ? 2 : 1;
      for (let i = 0; i < launches; i++) spawnRocket();
    }, 900);

    function tick() {
      ctx.clearRect(0, 0, W, H);
      rockets.forEach((r) => {
        // physics
        r.vy += 0.008; // small drag
        r.x += r.vx;
        r.y += r.vy;

        // trail
        r.trail.push({ x: r.x, y: r.y, a: 1 });
        if (r.trail.length > 24) r.trail.shift();

        // draw trail
        for (let i = 0; i < r.trail.length; i++) {
          const t = r.trail[i];
          t.a *= 0.94;
          ctx.beginPath();
          ctx.arc(t.x, t.y, 2 + i * 0.05, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 220, 160, ${t.a})`;
          ctx.fill();
        }

        // draw rocket head
        ctx.beginPath();
        ctx.arc(r.x, r.y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${r.hue}, 95%, 60%)`;
        ctx.fill();

        // burst when high enough
        if (r.vy > -0.2 || r.y < H * 0.28) {
          fwRef.current.burst && fwRef.current.burst(r.x, r.y);
          r.life = -1; // mark for removal
        }
      });

      rockets = rockets.filter((r) => r.life !== -1 && r.y > -40);
      rocketsRef.current.raf = requestAnimationFrame(tick);
    }
    tick();

    rocketsRef.current.cleanup = () => {
      cancelAnimationFrame(rocketsRef.current.raf);
      window.removeEventListener("resize", resize);
      clearInterval(launcher);
    };
  }
  function stopRockets() {
    rocketsRef.current.cleanup && rocketsRef.current.cleanup();
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
      if (giftAccepted) payload.diwaliGift = true;
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

  // Celebrate button
  function celebrateDiwali(e) {
    rippleEffect(e);
    const audio = document.getElementById("diwaliChime");
    try {
      audio.currentTime = 0;
      audio.play();
    } catch {}
    const { burst } = fwRef.current;
    if (burst) {
      const x = window.innerWidth / 2,
        y = window.innerHeight * 0.3;
      for (let i = 0; i < 4; i++)
        setTimeout(
          () =>
            burst(
              x + (Math.random() * 160 - 80),
              y + (Math.random() * 80 - 40)
            ),
          i * 140
        );
    }
  }

  // Wish CTA
  function openWish(e) {
    rippleEffect(e);
    setShowWish(true);
    setWishDone(false);
    setWishText("");
  }
  function submitWish() {
    setWishDone(true);
    const { burst } = fwRef.current;
    if (burst) {
      const x = window.innerWidth * 0.5,
        y = window.innerHeight * 0.32;
      burst(x, y);
      setTimeout(() => burst(x + 60, y - 20), 180);
    }
  }

  // Gift Box
  function openGift() {
    setShowGift(true);
  }
  function acceptGift() {
    setGiftAccepted(true);
    setShowGift(false);
    try {
      localStorage.setItem("milan_diwali_gift", "accepted");
    } catch {}
    setShowReset(false);
    setShowLogin(true);
    setTimeout(() => {
      try {
        const el = document.getElementById("loginContact");
        el && el.focus({ preventScroll: true });
        el &&
          el.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {}
    }, 150);
  }

  return (
    <>
      <Head>
        <title>Milan — Happy Diwali</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0b1220" />
      </Head>

      {/* Background layers */}
      <div className="rangoli-bg" aria-hidden />
      <canvas id="heartsCanvas" aria-hidden={!enableHearts}></canvas>
      <canvas
        id="rocketsCanvas"
        style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none" }}
      />
      <canvas
        id="fireworksCanvas"
        style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
      />
      <audio id="diwaliChime" preload="auto">
        <source
          src="https://cdn.pixabay.com/download/audio/2022/03/15/audio_4c76d6de8a.mp3?filename=soft-bell-ambient-10473.mp3"
          type="audio/mpeg"
        />
      </audio>
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
              <h3 className="festive-wish">Happy Diwali! ✨</h3>
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
                    Romantic UI, soft animations and a gentle atmosphere for real
                    connections.
                  </p>
                </div>
                <div className="why-card">
                  <div className="why-emoji">🕶️</div>
                  <h4>Anonymous & Fun</h4>
                  <p>Chat anonymously, express freely — it's light, friendly & playful.</p>
                </div>
              </div>

              <div className="cta-row">
                <button
                  className="celebrate-btn"
                  onClick={celebrateDiwali}
                  onMouseDown={rippleEffect}
                >
                  🎉 Celebrate Diwali
                </button>
                <button className="ghost-btn" onClick={openWish} onMouseDown={rippleEffect}>
                  ✨ Make a Wish
                </button>
                <button className="gift-btn" onClick={openGift} onMouseDown={rippleEffect}>
                  🎁 Open Diwali Gift
                </button>
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

      {showWish && (
        <div className="modal-back" role="dialog" aria-modal>
          <div className="modal">
            <h3>✨ Make a Wish</h3>
            {!wishDone ? (
              <>
                <p className="modal-desc">
                  Close your eyes for a second, type your wish below, and release it to the
                  universe. May it come true this Diwali ✨
                </p>
                <textarea
                  value={wishText}
                  onChange={(e) => setWishText(e.target.value)}
                  placeholder="Type your Diwali wish here..."
                />
                <div className="modal-actions">
                  <button className="ghost-btn" onClick={() => setShowWish(false)} onMouseDown={rippleEffect}>
                    Cancel
                  </button>
                  <button className="primary-btn" onClick={submitWish} onMouseDown={rippleEffect}>
                    Make it Happen
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="modal-desc">Wish sent! Now go meet someone special on Milan 💖</p>
                <div className="modal-actions">
                  <button className="primary-btn" onClick={() => setShowWish(false)} onMouseDown={rippleEffect}>
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showGift && (
        <div className="modal-back" role="dialog" aria-modal>
          <div className="modal">
            <h3>🎁 Diwali Gift Box</h3>
            <p className="modal-desc">
              Unlock special perks when you register before <b>31 Oct 2025</b>:
            </p>
            <ul className="modal-list">
              <li>✨ <b>3-day Spotlight</b> — your profile gets top visibility</li>
              <li>💘 <b>1 Priority Match</b> — we’ll boost you to someone highly compatible</li>
              <li>🏷️ <b>Festival Badge</b> — "Diwali ’25" on your profile (limited)</li>
            </ul>
            <p className="countdown">⏳ Offer ends in: <b>{countdown}</b></p>
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => setShowGift(false)} onMouseDown={rippleEffect}>
                Maybe later
              </button>
              <button className="primary-btn" onClick={acceptGift} onMouseDown={rippleEffect}>
                Add Gift to My Account
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
        :root{ --bg-1:#0b1220; --bg-2:#0f2030; --accent1:#ff6b81; --accent2:#ff9fb0; --muted:#c7d7ea; --gold:#ffd166; }
        html,body{ margin:0; padding:0; font-family:Poppins, "Segoe UI", Roboto, sans-serif; background: radial-gradient(1200px circle at 10% 0%, #0e1526 0%, var(--bg-1) 35%, var(--bg-2) 100%); color:#eef6ff; }
        #heartsCanvas{ position:fixed; inset:0; z-index:0; pointer-events:none; }
        #errorMessage{ position:fixed; top:18px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.7); color:#fff; padding:10px 14px; border-radius:8px; display:none; z-index:9999; font-weight:700; }

        /* Rangoli watermark (subtle, center) */
        .rangoli-bg{
          position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: .18;
          background:
            radial-gradient(closest-side, rgba(255,215,170,.25), rgba(255,215,170,0) 70%) no-repeat 50% 72% / 900px 900px,
            repeating-conic-gradient(from 0deg, rgba(255,209,102,.28) 0 8deg, rgba(255,209,102,0) 8deg 16deg) no-repeat 50% 72% / 900px 900px;
          mask-image: radial-gradient(circle at 50% 70%, rgba(0,0,0,1), rgba(0,0,0,0) 70%);
        }

        .page-wrap{ position:relative; z-index:5; min-height:100svh; display:flex; flex-direction:column; justify-content:space-between; padding-bottom:24px; }
        .container{ width:100%; max-width:1200px; margin:28px auto 6px; display:flex; gap:34px; padding:18px; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; }
        .left{ flex:1 1 560px; min-width:320px; display:flex; align-items:center; justify-content:center; }
        .right{ flex:0 0 420px; min-width:300px; display:flex; align-items:flex-start; justify-content:center; }

        .welcome-box{ background: linear-gradient(180deg, rgba(10,14,20,0.54), rgba(12,18,24,0.44)); border-radius:16px; padding:26px 32px; box-shadow: 0 12px 48px rgba(2,6,23,0.6); max-width:780px; text-align:center; border: 1px solid rgba(255,107,129,0.06); }
        .welcome-row{ display:flex; align-items:center; gap:12px; justify-content:center; }
        .welcome-title{ font-size:56px; margin:0; font-weight:900; background: linear-gradient(90deg, #ff6b81, #ff9fb0); -webkit-background-clip:text; -webkit-text-fill-color:transparent; text-shadow:0 10px 28px rgba(0,0,0,0.45); }
        .pulse-heart{ display:inline-block; font-size:36px; color:#ff465e; animation: heartBeat 1000ms ease-in-out infinite; transform-origin:center; text-shadow: 0 8px 22px rgba(255,70,94,0.12); }
        .festive-wish{ margin:8px 0 2px; font-size:24px; color: var(--gold); text-shadow:0 0 16px rgba(255,209,102,.25); font-weight:800; }
        @keyframes heartBeat{ 0%{transform:scale(1)} 28%{transform:scale(1.28)} 42%{transform:scale(1)} 100%{transform:scale(1)} }
        .welcome-text{ font-size:20px; color: var(--muted); margin-top:12px; font-weight:600; line-height:1.6; }
        .age-note{ margin-top:14px; color:#ffd7e0; font-weight:700; }

        .why-grid{ display:flex; gap:14px; margin-top:18px; justify-content:center; flex-wrap:wrap; }
        .why-card{ background: rgba(255,255,255,0.03); border-radius:12px; padding:14px; width:220px; box-shadow: 0 8px 28px rgba(2,6,23,0.5); border:1px solid rgba(255,255,255,0.05); }
        .why-emoji{ font-size:28px; display:block; margin-bottom:8px; }
        .why-card h4{ margin:0 0 6px 0; font-size:16px; color:#fff; }
        .why-card p{ margin:0; color: var(--muted); font-size:13px; line-height:1.4; }

        .cta-row{ margin-top:16px; display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
        .celebrate-btn{ position:relative; overflow:hidden; display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:12px 16px; border-radius:12px; border:none; cursor:pointer; background: rgba(255,209,102,0.2); color:#ffe9ac; font-weight:900; box-shadow: 0 10px 36px rgba(255,209,102,0.12); }
        .celebrate-btn:hover{ filter:brightness(1.1); }
        .ghost-btn{ position:relative; overflow:hidden; display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:12px 16px; border-radius:12px; border:1px solid rgba(255,255,255,0.08); cursor:pointer; background: rgba(255,255,255,0.05); color:#e9f0ff; font-weight:800; }
        .gift-btn{ position:relative; overflow:hidden; display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:12px 16px; border-radius:12px; border:none; cursor:pointer; background: linear-gradient(90deg, #ff6b81, #ff9fb0); color:#09121f; font-weight:900; box-shadow: 0 14px 48px rgba(255,107,129,0.22); }

        .form-container{ width:100%; background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02)); padding:24px; border-radius:16px; backdrop-filter: blur(6px); box-shadow: 0 14px 50px rgba(2,6,23,0.6); }
        h2{ font-size:20px; margin:0 0 8px 0; text-align:center; }
        label{ display:block; margin-top:10px; font-size:15px; font-weight:700; color:#f3f7fb; }
        input,select,textarea{ width:100%; padding:12px 14px; margin-top:6px; border-radius:8px; border:none; font-size:15px; background: rgba(0,0,0,0.36); color:#fff; outline:2px solid transparent; transition: outline 120ms ease, transform 100ms ease; }
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
          .gift-btn{ width:100%; }
        }
      `}</style>
    </>
  );
}
