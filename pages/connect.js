"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import io from "socket.io-client";

export default function ConnectPage() {
  const [profile, setProfile] = useState({
    name: "",
    contact: "",
    photoDataUrls: [],
    interests: [],
    age: "",
    city: "",
    language: "",
    bio: "",
  });
  const [isSearching, setIsSearching] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "❤️ जहां दिल मिले, वहीं होती है शुरुआत Milan की…"
  );

  const fwRef = useRef({ raf: null, burst: () => {}, cleanup: null });
  const socketRef = useRef(null);
  const partnerRef = useRef(null);
  const connectingRef = useRef(false);

  const backendUrl = useMemo(
    () =>
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "https://milan-j9u9.onrender.com",
    []
  );

  // Load profile (SSR-safe)
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const saved = localStorage.getItem("milan_profile");
      if (saved) {
        const p = JSON.parse(saved);
        setProfile((prev) => ({
          ...prev,
          ...p,
          photoDataUrls: Array.isArray(p.photoDataUrls) ? p.photoDataUrls : [],
          interests: Array.isArray(p.interests) ? p.interests : [],
        }));
      } else {
        setProfile((p) => ({
          ...p,
          name: localStorage.getItem("registered_name") || "",
          contact: localStorage.getItem("registered_contact") || "",
        }));
      }
    } catch {}
  }, []);

  // Hearts BG
  useEffect(() => {
    const cvs = document.getElementById("heartsCanvas");
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    let W, H, rafId;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    let items = [];

    function resize() {
      W = Math.round(window.innerWidth * dpr);
      H = Math.round(window.innerHeight * dpr);
      cvs.width = W;
      cvs.height = H;
      cvs.style.width = window.innerWidth + "px";
      cvs.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function spawn() {
      const small = window.innerWidth < 760;
      const size = (small ? 6 : 10) + Math.random() * (small ? 16 : 22);
      items.push({
        x: Math.random() * window.innerWidth,
        y: window.innerHeight + size,
        s: size,
        v: (small ? 0.5 : 0.9) + Math.random() * (small ? 0.6 : 0.9),
        c: ["#ff6ea7", "#ff8fb7", "#ff4d6d", "#e6007a"][
          Math.floor(Math.random() * 4)
        ],
      });
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < items.length; i++) {
        const h = items[i];
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.translate(h.x, h.y);
        ctx.rotate(Math.sin(h.y / 40) * 0.03);
        ctx.fillStyle = h.c;
        const s = h.s;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(s / 2, -s, s * 1.5, s / 3, 0, s);
        ctx.bezierCurveTo(-s * 1.5, s / 3, -s / 2, -s, 0, 0);
        ctx.fill();
        ctx.restore();
        h.y -= h.v;
      }
      items = items.filter((h) => h.y + h.s > -40);
      if (Math.random() < (window.innerWidth < 760 ? 0.06 : 0.12)) spawn();
      rafId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Fireworks layer
  useEffect(() => {
    startFireworks();
    return stopFireworks;
  }, []);

  function startFireworks() {
    const cvs = document.getElementById("fxCanvas");
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    let W, H;
    let ents = [];

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
      const n = 60 + ((Math.random() * 40) | 0);
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
      ctx.fillStyle = "rgba(10,7,16,.22)";
      ctx.fillRect(0, 0, W, H);

      if (Math.random() < 0.02) {
        burst(rand(W * 0.05, W * 0.95), rand(H * 0.12, H * 0.9));
      }

      const next = [];
      for (let i = 0; i < ents.length; i++) {
        const p = ents[i];
        p.age += 0.016;
        if (p.age < p.life) next.push(p);
      }
      ents = next;

      for (let i = 0; i < ents.length; i++) {
        const p = ents[i];
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
    if (fwRef.current.cleanup) fwRef.current.cleanup();
  }

  // SWC-safe file input handler
  const handlePhotoPick = (e) => {
    try {
      const input = e && e.target ? e.target : null;
      const files = input && input.files ? input.files : null;
      const f = files && files.length ? files[0] : null;
      if (!f) return;

      const r = new FileReader();
      r.onload = (ev) => {
        const du = ev && ev.target ? ev.target.result : null;
        if (!du) return;

        const prev = Array.isArray(profile.photoDataUrls)
          ? profile.photoDataUrls
          : [];
        if (prev.length >= 3) {
          alert("Max 3 photos");
          return;
        }
        const next = [...prev, du];
        const p = { ...profile, photoDataUrls: next };
        setProfile(p);
        try {
          localStorage.setItem("milan_profile", JSON.stringify(p));
        } catch {}
      };
      r.readAsDataURL(f);
    } catch {}
    try {
      if (e && e.target) e.target.value = "";
    } catch {}
  };

  // Matching
  function startSearch(type) {
    if (isSearching || connectingRef.current) return;
    connectingRef.current = true;
    setIsSearching(true);
    setShowLoader(true);
    setStatusMessage(
      type === "video"
        ? "🎥 Finding your video chat soulmate..."
        : "💬 Connecting hearts through words..."
    );

    try {
      if (!socketRef.current || !socketRef.current.connected) {
        socketRef.current = io(backendUrl, {
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 800,
        });
      }
      const token =
        (typeof window !== "undefined" && localStorage.getItem("token")) || "";

      if (socketRef.current && socketRef.current.off) {
        socketRef.current.off("partnerFound");
        socketRef.current.off("partnerDisconnected");
        socketRef.current.off("connect_error");
      }

      socketRef.current.emit("lookingForPartner", { type, token });

      socketRef.current.on("partnerFound", (data) => {
        try {
          const roomCode = data && data.roomCode ? data.roomCode : "";
          partnerRef.current = data && data.partner ? data.partner : {};
          if (!roomCode) {
            setTimeout(() => stopSearch(), 800);
            return;
          }
          sessionStorage.setItem(
            "partnerData",
            JSON.stringify(partnerRef.current)
          );
          sessionStorage.setItem("roomCode", roomCode);
          localStorage.setItem("lastRoomCode", roomCode);
          setStatusMessage("💖 Milan Successful!");
          setTimeout(() => {
            window.location.href = type === "video" ? "/video" : "/chat";
          }, 120);
        } catch {
          setTimeout(() => stopSearch(), 500);
        }
      });

      socketRef.current.on("partnerDisconnected", () => {
        alert("Partner disconnected.");
        stopSearch();
      });

      socketRef.current.on("connect_error", () => {
        alert("Connection error. Please try again.");
        stopSearch();
      });
    } catch {
      alert("Something went wrong starting the search.");
      stopSearch();
    } finally {
      setTimeout(() => {
        connectingRef.current = false;
      }, 300);
    }
  }

  function stopSearch() {
    if (socketRef.current) {
      try {
        socketRef.current.emit("disconnectByUser");
        socketRef.current.disconnect();
      } catch {}
      try {
        if (socketRef.current.removeAllListeners) {
          socketRef.current.removeAllListeners();
        }
      } catch {}
      socketRef.current = null;
    }
    setIsSearching(false);
    setShowLoader(false);
    setStatusMessage("❤️ जहां दिल मिले, वहीं होती है शुरुआत Milan की…");
  }

  // Completeness meter
  function completeness(p = profile) {
    let s = 0;
    if (p.name) s += 18;
    if (p.contact) s += 12;
    if (p.age) s += 10;
    if (p.city) s += 10;
    if (p.language) s += 10;
    if (p.bio) s += 15;
    if ((p.interests || []).length) s += 15;
    if ((p.photoDataUrls || []).length)
      s += Math.min(10, p.photoDataUrls.length * 4);
    return Math.min(100, Math.round(s));
  }
  const percent = completeness(profile);

  return (
    <>
      <Head>
        <title>Milan – Connect</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Poppins:wght@300;400;600;700;900&display=swap"
          rel="stylesheet"
        />
      </Head>

      {/* Frame */}
      <div className="frame" aria-hidden />

      {/* Background layers */}
      <canvas id="heartsCanvas" />
      <canvas
        id="fxCanvas"
        style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
      />
      <audio id="bellAudio" preload="auto">
        <source
          src="https://cdn.pixabay.com/download/audio/2022/03/15/audio_4c76d6de8a.mp3?filename=soft-bell-ambient-10473.mp3"
          type="audio/mpeg"
        />
      </audio>

      {/* Sidebar (desktop only) */}
      <aside className="sidebar">
        <div className="profileTop">
          <div className="avatarWrap">
            <Avatar />
          </div>
          <div className="name">{profile.name || "Pinky"}</div>
          <div className="meter">
            <div className="bar" style={{ width: `${percent}%` }} />
          </div>
          <label htmlFor="photoPick" className="photoPick">
            Change / Add Photo
          </label>
          <input
            id="photoPick"
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handlePhotoPick}
          />
        </div>
        <ul className="nav">
          <li>👤 Profile Info</li>
          <li>🔒 Security</li>
          <li>💘 Love Calculator</li>
          <li
            onClick={() => {
              try {
                localStorage.clear();
              } catch {}
              window.location.href = "/login";
            }}
          >
            🚪 Logout
          </li>
        </ul>
      </aside>

      {/* Brand */}
      <div className="brandBlock">
        <div className="heroBrand">Milan</div>
        <div className="brandTagline">
          Where hearts connect <span aria-hidden>❤️</span>
        </div>
      </div>

      {/* Center */}
      <main className="heroWrap">
        <p className="miniGreeting">
          🌟 Wishing you a sparkling Diwali full of love, light, and unforgettable
          connections – from all of us at Milan 💞
        </p>

        <section
          className="featuresGrid"
          role="navigation"
          aria-label="Choose a mode"
        >
          <article className="featureCard text">
            <header>
              <h3>Text Chat</h3>
              <p>Say hello. Trade vibes. Let the story find you.</p>
            </header>
            <button className="cta ghost" onClick={() => startSearch("text")}>
              💬 Start Text Chat
            </button>
          </article>

          <article className="featureCard video">
            <header>
              <h3>Video Chat</h3>
              <p>Face-to-face chemistry. Zero setup, all spark.</p>
            </header>
            <button className="cta primary" onClick={() => startSearch("video")}>
              🎥 Start Video Chat
            </button>
          </article>

          {/* 🔗 NEW: Invite Link (Zero-DB) – Quick Direct Connect */}
          <article className="featureCard invite">
            <header>
              <h3>Invite Link (Zero-DB)</h3>
              <p>Share a link. Partner clicks. You're connected.</p>
            </header>
            <button
              className="cta outline"
              onClick={() => {
                const rid = Math.random().toString(36).slice(2, 8);
                const mode = "text";
                window.location.href = `/invite/${rid}?mode=${mode}`;
              }}
            >
              🔗 Create Invite Link
            </button>
          </article>

          <article className="featureCard studio">
            <header>
              <h3>Milan AI Studio</h3>
              <p>Create dreamy prompts & reels—love, but make it aesthetic.</p>
            </header>
            <a href="/ai" className="cta outline">
              🎨 Open AI Studio
            </a>
          </article>

          <article className="featureCard celebrate">
            <header>
              <h3>Festive Spark</h3>
              <p>Light up the sky & your heart—Diwali vibes on tap.</p>
            </header>
            <button
              className="cta gold"
              onClick={() => {
                const a = document.getElementById("bellAudio");
                try {
                  a.currentTime = 0;
                  a.play();
                } catch {}
                const b =
                  fwRef.current && fwRef.current.burst
                    ? fwRef.current.burst
                    : null;
                const x = window.innerWidth / 2;
                const y = window.innerHeight * 0.58;
                for (let i = 0; i < 6; i++) {
                  setTimeout(() => {
                    if (b)
                      b(
                        x + (Math.random() * 260 - 130),
                        y + (Math.random() * 140 - 70)
                      );
                  }, i * 120);
                }
              }}
            >
              🎆 Let's Celebrate
            </button>
          </article>
        </section>

        {/* NEW: Enhanced Search Modal with Rotating Hearts */}
        {showLoader && isSearching && (
          <div className="search-modal-overlay" role="dialog" aria-modal="true">
            <div className="search-modal">
              <div className="modal-content">
                {/* Main Heading */}
                <h2 className="modal-heading">
                  💖 Your Milan story is about to begin…
                </h2>
                
                {/* Heart Loading Animation */}
                <div className="heart-loader-container">
                  {/* Rotating small hearts around center */}
                  <div className="orbiting-hearts">
                    <div className="orbit-heart heart-1">💗</div>
                    <div className="orbit-heart heart-2">💕</div>
                    <div className="orbit-heart heart-3">💖</div>
                    <div className="orbit-heart heart-4">💝</div>
                    <div className="orbit-heart heart-5">💓</div>
                    <div className="orbit-heart heart-6">💞</div>
                  </div>
                  
                  {/* Center large animated heart */}
                  <svg className="center-heart" viewBox="0 0 32 29" aria-hidden>
                    <defs>
                      <linearGradient id="heartGrad" x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0%" stopColor="#ff6ea7" />
                        <stop offset="50%" stopColor="#ff9fb0" />
                        <stop offset="100%" stopColor="#ff6ea7" />
                      </linearGradient>
                    </defs>
                    <path 
                      fill="url(#heartGrad)" 
                      d="M23.6,0c-2.9,0-4.6,1.8-5.6,3.1C16.9,1.8,15.2,0,12.3,0C8.1,0,5.3,3,5.3,6.7c0,7.1,11.7,13.9,11.7,13.9s11.7-6.8,11.7-13.9C28.7,3,25.9,0,23.6,0z"
                      className="heart-pulse"
                    />
                  </svg>
                </div>

                {/* Romantic Status Message */}
                <p className="modal-description">
                  We're gently nudging hearts together — finding someone who vibes with your rhythm. Hold on, cupid is working his magic! 💘
                </p>

                {/* Status Text */}
                <div className="status-text">{statusMessage}</div>

                {/* Stop Button */}
                <button className="stop-search-btn" onClick={() => stopSearch()}>
                  <span className="btn-icon">✕</span>
                  <span className="btn-text">Stop Searching</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        :root{ --brandH: 170px; --bottomH: 60px; } 
        *,*::before,*::after{ box-sizing:border-box; min-width:0; }
        html,body{ margin:0; padding:0; height:100%; background:#08060c; color:#f7f7fb; font-family:Poppins,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; }
        body{ overflow:hidden; } 
        #heartsCanvas{ position:fixed; inset:0; z-index:0; pointer-events:none; }
        #fxCanvas{ position:fixed; inset:0; z-index:0; pointerEvents:none; }

        .frame{ position:fixed; top:10px; bottom:10px; right:10px; left:210px; z-index:2; pointer-events:none; }
        .frame::before{ padding:2px; background:linear-gradient(135deg, rgba(255,209,102,.9), rgba(255,209,102,.45) 40%, rgba(255,110,167,.55), rgba(255,209,102,.9)); -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite:xor; mask-composite:exclude; border-radius:18px; box-shadow:0 0 24px rgba(255,209,102,.32), 0 0 46px rgba(255,110,167,.2); }
        .frame::after{ inset:8px; border:2px solid rgba(255,209,102,.6); border-radius:14px; box-shadow:0 0 20px rgba(255,209,102,.28) inset; }

        .sidebar{ position:fixed; left:0; top:0; bottom:0; width:200px; background:rgba(255,255,255,.04); backdrop-filter:blur(8px); border-right:1px solid rgba(255,255,255,.06); z-index:3; display:flex; flex-direction:column; align-items:center; padding-top:18px; }
        .avatarWrap{ width:70px; height:70px; border-radius:50%; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,.35); }
        .name{ margin-top:8px; font-weight:800; }
        .meter{ width:140px; height:8px; background:rgba(255,255,255,.1); border-radius:8px; margin-top:6px; overflow:hidden; }
        .meter .bar{ height:100%; background:linear-gradient(90deg,#ff6ea7,#ff9fb0); }
        .photoPick{ margin-top:8px; font-size:12px; color:#fff; background:rgba(255,255,255,.08); padding:6px 10px; border-radius:8px; cursor:pointer; }
        .nav{ list-style:none; padding:0; width:100%; margin-top:18px; }
        .nav li{ padding:10px 14px; margin:6px 12px; border-radius:12px; background:rgba(255,255,255,.04); cursor:pointer; font-weight:700; }

        .brandBlock{ position:fixed; left:50%; transform:translateX(-50%); top:120px; text-align:center; z-index:3; pointer-events:none; }
        .heroBrand{ font-family:'Great Vibes', cursive; font-size:116px; line-height:1.02; background: linear-gradient(180deg, #fff5cc, #ffd166 48%, #f3b03f); -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: 0 0 22px rgba(255,209,102,.35), 0 0 40px rgba(255,110,167,.15); }
        .brandTagline{ margin-top:6px; font-size:20px; font-weight:700; letter-spacing:.02em; background: linear-gradient(90deg, #ffd166, #ffb6c1); -webkit-background-clip:text; background-clip:text; color:transparent; font-style: italic; position:relative; display:inline-block; }
        .brandTagline:after{ content:""; display:block; height:2px; margin:8px auto 0; width:160px; border-radius:999px; background:linear-gradient(90deg, rgba(255,182,193,0), #ffd166, rgba(255,182,193,0)); box-shadow:0 0 12px rgba(255,209,102,.45); }

        .heroWrap{ position:relative; margin-left:200px; z-index:3; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding: calc(var(--brandH) + 16px) 12px var(--bottomH); box-sizing:border-box; gap:16px; }
        .miniGreeting{ max-width:min(980px, calc(100vw - 260px)); text-align:center; font-weight:700; line-height:1.35; color:#ffe9ac; text-shadow:0 0 14px rgba(255,209,102,.22); margin:0; }

        .featuresGrid{ width:min(980px, calc(100vw - 260px)); display:grid; grid-template-columns:repeat(2, minmax(260px, 1fr)); gap:16px; }
        .featureCard{ background:rgba(16,13,22,.46); border:1px solid rgba(255,255,255,.08); border-radius:18px; padding:22px; backdrop-filter:blur(8px); box-shadow:0 14px 44px rgba(0,0,0,.35); display:flex; flex-direction:column; align-items:flex-start; gap:14px; transition:transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
        .featureCard header h3{ margin:0; font-size:22px; font-weight:900; letter-spacing:.2px; }
        .featureCard header p{ margin:4px 0 0 0; opacity:.9; }
        .featureCard:hover{ transform: translateY(-4px); box-shadow:0 18px 56px rgba(0,0,0,.45); }
        .featureCard.text{ border-color:rgba(255,110,167,.22); }
        .featureCard.video{ border-color:rgba(255,110,167,.18); }
        .featureCard.invite{ border-color:rgba(160, 220, 255, .28); }
        .featureCard.studio{ border-color:rgba(140,150,255,.22); }
        .featureCard.celebrate{ border-color:rgba(255,209,102,.35); }

        .cta{ padding:12px 16px; border-radius:12px; font-weight:900; border:0; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; text-decoration:none; transition:transform .14s ease, box-shadow .14s ease, filter .14s ease; }
        .cta:hover{ transform: translateY(-2px); filter: brightness(1.02); }
        .cta:active{ transform: scale(.97); box-shadow: inset 0 0 0 9999px rgba(0,0,0,.05); }
        .cta:focus-visible{ outline: 3px solid rgba(255,209,102,.6); outline-offset: 2px; }

        .cta.primary{ background:linear-gradient(90deg,#ff6ea7,#ff9fb0); color:#0a0b12; box-shadow:0 10px 34px rgba(255,110,167,.25); }
        .cta.ghost{ background:rgba(255,255,255,.07); color:#fff; border:1px solid rgba(255,255,255,.14); }
        .cta.outline{ background:transparent; color:#fff; border:2px solid rgba(255,110,167,.45); box-shadow:0 0 0 2px rgba(255,110,167,.12) inset; }
        .cta.gold{ background:rgba(255,209,102,.18); color:#ffe9ac; border:1px solid rgba(255,209,102,.4); box-shadow:0 12px 36px rgba(255,209,102,.18); }

        /* ============================================
           ENHANCED SEARCH MODAL WITH ROTATING HEARTS
           ============================================ */
        .search-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: grid;
          place-items: center;
          background: rgba(8, 6, 12, 0.92);
          backdrop-filter: blur(12px);
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .search-modal {
          width: min(520px, calc(100% - 32px));
          background: linear-gradient(145deg, 
            rgba(255, 110, 167, 0.12) 0%, 
            rgba(255, 159, 176, 0.08) 50%,
            rgba(255, 110, 167, 0.12) 100%);
          border: 2px solid rgba(255, 110, 167, 0.25);
          border-radius: 28px;
          padding: 40px 32px;
          box-shadow: 
            0 30px 80px rgba(255, 79, 160, 0.35),
            0 0 60px rgba(255, 110, 167, 0.2),
            inset 0 1px 1px rgba(255, 255, 255, 0.1);
          animation: modalSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
          overflow: hidden;
        }

        .search-modal::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, 
            rgba(255, 110, 167, 0.15) 0%, 
            transparent 70%);
          animation: bgPulse 3s ease-in-out infinite;
        }

        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes bgPulse {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.5; }
          50% { transform: scale(1.1) rotate(180deg); opacity: 0.8; }
        }

        .modal-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }

        .modal-heading {
          margin: 0;
          font-size: 28px;
          font-weight: 900;
          text-align: center;
          background: linear-gradient(135deg, #fff 0%, #ffd6ea 50%, #ff9fb0 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          letter-spacing: 0.3px;
          text-shadow: 0 4px 20px rgba(255, 110, 167, 0.3);
          animation: textShimmer 2s ease-in-out infinite;
        }

        @keyframes textShimmer {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.2); }
        }

        /* Heart Loader Container */
        .heart-loader-container {
          position: relative;
          width: 180px;
          height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Orbiting Hearts */
        .orbiting-hearts {
          position: absolute;
          width: 100%;
          height: 100%;
          animation: rotate 8s linear infinite;
        }

        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .orbit-heart {
          position: absolute;
          font-size: 24px;
          animation: pulse 1.5s ease-in-out infinite;
          filter: drop-shadow(0 4px 12px rgba(255, 110, 167, 0.6));
        }

        @keyframes pulse {
          0%, 100% { 
            transform: scale(1); 
            opacity: 0.8;
          }
          50% { 
            transform: scale(1.3); 
            opacity: 1;
          }
        }

        .orbit-heart.heart-1 {
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          animation-delay: 0s;
        }

        .orbit-heart.heart-2 {
          top: 25%;
          right: 10%;
          animation-delay: 0.2s;
        }

        .orbit-heart.heart-3 {
          top: 50%;
          right: 0;
          transform: translateY(-50%);
          animation-delay: 0.4s;
        }

        .orbit-heart.heart-4 {
          bottom: 25%;
          right: 10%;
          animation-delay: 0.6s;
        }

        .orbit-heart.heart-5 {
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          animation-delay: 0.8s;
        }

        .orbit-heart.heart-6 {
          top: 50%;
          left: 0;
          transform: translateY(-50%);
          animation-delay: 1s;
        }

        /* Center Heart SVG */
        .center-heart {
          width: 80px;
          height: 80px;
          filter: drop-shadow(0 8px 24px rgba(255, 110, 167, 0.6));
          animation: heartBeat 1.2s ease-in-out infinite;
        }

        @keyframes heartBeat {
          0%, 100% { 
            transform: scale(1); 
          }
          10%, 30% { 
            transform: scale(1.15); 
          }
          20%, 40% { 
            transform: scale(1.05); 
          }
        }

        .heart-pulse {
          animation: fillPulse 2s ease-in-out infinite;
        }

        @keyframes fillPulse {
          0%, 100% { 
            opacity: 1;
            filter: brightness(1);
          }
          50% { 
            opacity: 0.85;
            filter: brightness(1.3);
          }
        }

        /* Modal Description */
        .modal-description {
          margin: 0;
          text-align: center;
          color: #ffdfe8;
          font-size: 16px;
          line-height: 1.6;
          font-weight: 500;
          max-width: 420px;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        /* Status Text */
        .status-text {
          font-size: 14px;
          color: #ffb6d1;
          font-weight: 600;
          text-align: center;
          padding: 8px 16px;
          background: rgba(255, 110, 167, 0.1);
          border-radius: 12px;
          border: 1px solid rgba(255, 110, 167, 0.2);
          animation: statusBlink 2s ease-in-out infinite;
        }

        @keyframes statusBlink {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }

        /* Stop Search Button */
        .stop-search-btn {
          margin-top: 8px;
          padding: 14px 32px;
          background: linear-gradient(135deg, #ff6ea7 0%, #ff4d6d 100%);
          color: #fff;
          border: none;
          border-radius: 16px;
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 
            0 8px 24px rgba(255, 79, 160, 0.4),
            0 0 30px rgba(255, 110, 167, 0.3);
          transition: all 0.3s ease;
          letter-spacing: 0.5px;
        }

        .stop-search-btn:hover {
          transform: translateY(-3px);
          box-shadow: 
            0 12px 32px rgba(255, 79, 160, 0.5),
            0 0 40px rgba(255, 110, 167, 0.4);
          background: linear-gradient(135deg, #ff4d6d 0%, #ff6ea7 100%);
        }

        .stop-search-btn:active {
          transform: translateY(-1px) scale(0.98);
        }

        .btn-icon {
          font-size: 18px;
          font-weight: bold;
        }

        .btn-text {
          letter-spacing: 0.3px;
        }

        /* Responsive Design */
        @media (max-width: 760px) {
          .search-modal {
            padding: 32px 24px;
            border-radius: 24px;
          }

          .modal-heading {
            font-size: 24px;
          }

          .heart-loader-container {
            width: 150px;
            height: 150px;
          }

          .center-heart {
            width: 70px;
            height: 70px;
          }

          .orbit-heart {
            font-size: 20px;
          }

          .modal-description {
            font-size: 14px;
          }

          .stop-search-btn {
            padding: 12px 28px;
            font-size: 15px;
          }

          .sidebar {
            display: none;
          }

          .heroWrap {
            margin-left: 0;
          }

          .frame {
            left: 10px;
          }

          .featuresGrid {
            grid-template-columns: 1fr;
            width: calc(100vw - 32px);
          }

          .miniGreeting {
            max-width: calc(100vw - 32px);
          }
        }

        @media (max-width: 480px) {
          .modal-heading {
            font-size: 20px;
          }

          .heart-loader-container {
            width: 130px;
            height: 130px;
          }

          .center-heart {
            width: 60px;
            height: 60px;
          }

          .orbit-heart {
            font-size: 18px;
          }
        }
      `}</style>
    </>
  );
}

function Avatar() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        if (typeof window === "undefined") return;
        const uid = localStorage.getItem("uid") || "";
        const token = localStorage.getItem("token") || "";
        if (!uid || !token) return;
        const res = await fetch(`/api/profile/${uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("fail");
        const data = await res.json();
        setProfile(data);
      } catch {
        setProfile({
          name:
            (typeof window !== "undefined" &&
              localStorage.getItem("registered_name")) || "M",
        });
      }
    })();
  }, []);

  if (!profile) return <div>Loading...</div>;

  const first =
    (profile.name && profile.name.trim().charAt(0).toUpperCase()) || "M";

  return profile.avatar ? (
    <img
      src={profile.avatar}
      alt="avatar"
      style={{
        width: 70,
        height: 70,
        borderRadius: "50%",
        objectFit: "cover",
      }}
    />
  ) : (
    <div
      style={{
        width: 70,
        height: 70,
        borderRadius: "50%",
        background: "#ec4899",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 28,
        fontWeight: 700,
        color: "#fff",
      }}
    >
      {first}
    </div>
  );
}
