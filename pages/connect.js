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
    "❤️ जहाँ दिल मिले, वहीं होती है शुरुआत Milan की…"
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

  // ===== Smoke mark: badge so you know this build is live =====
  const BUILD_TAG = "CONNECT v4 (no diyas) ✅";

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
        ? "🎥 Searching for a Video Chat partner..."
        : "💬 Searching for a Text Chat partner..."
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
    setStatusMessage("❤️ जहाँ दिल मिले, वहीं होती है शुरुआत Milan की…");
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
        <title>Milan — Connect</title>
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

      <div className="devBadge">{BUILD_TAG}</div>

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
              🎆 Let’s Celebrate
            </button>
          </article>
        </section>

        {showLoader ? <div className="status">{statusMessage}</div> : null}
      </main>

      <style>{`
        /* Hard reset helpers */
        :root{ --brandH: 170px; --bottomH: 60px; } /* reduced since diyas removed */
        *,*::before,*::after{ box-sizing: border-box; min-width:0; }
        html,body{ margin:0; padding:0; height:100%; background:#08060c; color:#f7f7fb; font-family:Poppins,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; }
        body{ overflow:hidden; } /* desktop */
        #heartsCanvas{ position:fixed; inset:0; z-index:0; pointer-events:none; }
        #fxCanvas{ position:fixed; inset:0; z-index:0; pointer-events:none; }

        .devBadge{ position:fixed; top:8px; left:8px; z-index:10; background:#111; border:1px solid rgba(255,255,255,.2); padding:6px 10px; border-radius:10px; font-weight:800; }

        .frame{ position:fixed; top:10px; bottom:10px; right:10px; left:210px; z-index:2; pointer-events:none; }
        .frame::before,.frame::after{ content:""; position:absolute; inset:0; border-radius:18px; }
        .frame::before{ padding:2px; background:linear-gradient(135deg, rgba(255,209,102,.9), rgba(255,209,102,.45) 40%, rgba(255,110,167,.55), rgba(255,209,102,.9));
          -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite:xor; mask-composite:exclude; border-radius:18px; box-shadow:0 0 24px rgba(255,209,102,.32), 0 0 46px rgba(255,110,167,.2); }
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
        .heroBrand{ font-family:'Great Vibes', cursive; font-size:116px; line-height:1.02; background: linear-gradient(180deg, #fff5cc, #ffd166 48%, #f3b03f);
          -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: 0 0 22px rgba(255,209,102,.35), 0 0 40px rgba(255,110,167,.15); }
        .brandTagline{ margin-top:6px; font-size:20px; font-weight:700; letter-spacing:.02em; background: linear-gradient(90deg, #ffd166, #ffb6c1);
          -webkit-background-clip:text; background-clip:text; color:transparent; font-style: italic; position:relative; display:inline-block; }
        .brandTagline:after{ content:""; display:block; height:2px; margin:8px auto 0; width:160px; border-radius:999px; background:linear-gradient(90deg, rgba(255,182,193,0), #ffd166, rgba(255,182,193,0)); box-shadow:0 0 12px rgba(255,209,102,.45); }

        .heroWrap{ position:relative; margin-left:200px; z-index:3; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center;
          padding: calc(var(--brandH) + 16px) 12px var(--bottomH); box-sizing:border-box; gap:16px; }
        .miniGreeting{ max-width:min(980px, calc(100vw - 260px)); text-align:center; font-weight:700; line-height:1.35; color:#ffe9ac; text-shadow:0 0 14px rgba(255,209,102,.22); margin:0; }

        .featuresGrid{ width:min(980px, calc(100vw - 260px)); display:grid; grid-template-columns:repeat(2, minmax(260px, 1fr)); gap:16px; }
        .featureCard{ background:rgba(16,13,22,.46); border:1px solid rgba(255,255,255,.08); border-radius:18px; padding:22px; backdrop-filter:blur(8px); box-shadow:0 14px 44px rgba(0,0,0,.35); display:flex; flex-direction:column; align-items:flex-start; gap:14px; transition:transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
        .featureCard header h3{ margin:0; font-size:22px; font-weight:900; letter-spacing:.2px; }
        .featureCard header p{ margin:4px 0 0 0; opacity:.9; }
        .featureCard:hover{ transform: translateY(-4px); box-shadow:0 18px 56px rgba(0,0,0,.45); }
        .featureCard.text{ border-color:rgba(255,110,167,.22); }
        .featureCard.video{ border-color:rgba(255,110,167,.18); }
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

        .status{ font-weight:800; color:#fff; animation:blink 1s infinite; }
        @keyframes blink{0%{opacity:.3}50%{opacity:1}100%{opacity:.3}}

        /* ===== Mobile fixes ===== */
        @media(max-width:1024px){
          :root{ --brandH: 160px; --bottomH: 60px; }
          .frame{ left:12px; right:12px; }
          .brandBlock{ top:118px; }
          .heroBrand{ font-size:96px; }
        }
        @media(max-width:860px){
          :root{ --brandH: 150px; --bottomH: 70px; }
          .sidebar{display:none;}
          .frame{ left:12px; right:12px; }
          .heroWrap{ margin-left:0; }
          .featuresGrid{ width:min(980px, calc(100vw - 48px)); grid-template-columns:1fr 1fr; }
        }
        @media(max-width:560px){
          :root{ --brandH: 0px; --bottomH: 80px; }  /* small safe space for bottom shadow */
          html,body{ overflow:auto; }                /* enable scroll on mobile */
          .brandBlock{
            position:static; transform:none; top:auto; margin:16px 0 4px;
            pointer-events:none; text-align:center;
          }
          .heroBrand{ font-size:64px; }
          .brandTagline{ font-size:15px; }
          .heroWrap{
            padding: 8px 12px var(--bottomH);
            justify-content:flex-start; gap:14px;
          }
          .featuresGrid{ grid-template-columns:1fr; width:min(980px, calc(100vw - 28px)); }
          .cta{ width:100%; }
          .miniGreeting{ padding:0 6px; }
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
