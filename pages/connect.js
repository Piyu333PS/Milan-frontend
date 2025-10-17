"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import io from "socket.io-client";

export default function ConnectPage() {
  // -----------------------------
  // UI state
  // -----------------------------
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Profile (localStorage)
  const [profile, setProfile] = useState({
    name: "",
    contact: "",
    photoDataUrls: [], // up to 3
    interests: [], // array of strings
    age: "",
    city: "",
    language: "",
    bio: "",
  });

  const [editProfile, setEditProfile] = useState(null);

  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");

  const [statusMessage, setStatusMessage] = useState(
    "❤️ जहाँ दिल मिले, वहीं होती है शुरुआत Milan की…"
  );
  const [modeText, setModeText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [showModeButtons, setShowModeButtons] = useState(true);

  // Love Calculator state
  const [showLoveCalc, setShowLoveCalc] = useState(false);
  const [lcNameA, setLcNameA] = useState("");
  const [lcNameB, setLcNameB] = useState("");
  const [lcAgeA, setLcAgeA] = useState("");
  const [lcAgeB, setLcAgeB] = useState("");
  const [lcInterests, setLcInterests] = useState(""); // comma separated
  const [lcScore, setLcScore] = useState(null);
  const [lcMsg, setLcMsg] = useState("");
  const [lcHearts, setLcHearts] = useState([]);
  const [incomingLove, setIncomingLove] = useState(null);

  // Diwali add-ons
  const [showBanner, setShowBanner] = useState(true);
  const [showWish, setShowWish] = useState(false);
  const [wishDone, setWishDone] = useState(false);
  const [wish, setWish] = useState("");
  const [countdown, setCountdown] = useState("");
  const offerEndsAt = new Date("2025-10-31T23:59:59+05:30").getTime();

  // Fireworks ref
  const fwRef = useRef({ raf: null, burst: () => {}, cleanup: null });

  const QUOTES = [
    "❤️ जहाँ दिल मिले, वहीं होती है शुरुआत Milan की…",
    "✨ हर chat के पीछे छुपी है एक नई कहानी…",
    "💬 शब्द कम हों या ज़्यादा, connection सच्चा होना चाहिए।",
    "🎥 नज़रें कह देती हैं जो लफ़्ज़ नहीं कह पाते।",
    "🌸 प्यार मिल जाए, तो सफ़र आसान लगने लगता है।",
  ];
  const [quoteIndex, setQuoteIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setQuoteIndex((i) => (i + 1) % QUOTES.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const socketRef = useRef(null);
  const partnerRef = useRef(null);
  const connectingRef = useRef(false);

  const backendUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com";
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("milan_profile");
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.photoDataUrls = Array.isArray(parsed.photoDataUrls) ? parsed.photoDataUrls : [];
        parsed.interests = Array.isArray(parsed.interests) ? parsed.interests : [];
        setProfile((p) => ({ ...p, ...parsed }));
      } else {
        const registeredName = localStorage.getItem("registered_name") || "";
        const registeredContact = localStorage.getItem("registered_contact") || "";
        setProfile((p) => ({ ...p, name: registeredName, contact: registeredContact }));
      }
    } catch (e) {
      console.warn("Error reading profile from localStorage", e);
    }
  }, []);

  // Prefill love calc nameA when profile loads
  useEffect(() => {
    if (profile && profile.name) {
      setLcNameA(profile.name);
    }
  }, [profile.name]);

  // hearts canvas (already present)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = document.getElementById("heartCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let hearts = [];
    let rafId = null;
    let cssW = window.innerWidth;
    let cssH = window.innerHeight;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    function resizeCanvas() {
      cssW = window.innerWidth;
      cssH = window.innerHeight;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function createHeart() {
      const smallMode = cssW < 760;
      const size = smallMode ? Math.random() * 14 + 6 : Math.random() * 18 + 8;
      return {
        x: Math.random() * cssW,
        y: cssH + (smallMode ? 30 : 50),
        size,
        speed: smallMode ? Math.random() * 0.9 + 0.3 : Math.random() * 1.4 + 0.4,
        color: smallMode
          ? ["#ff7a9a", "#ff6b81", "#ff9fb0"][Math.floor(Math.random() * 3)]
          : ["#ff4d6d", "#ff1c68", "#ff6b81", "#e6005c"][Math.floor(Math.random() * 4)],
        rot: Math.random() * Math.PI * 2,
      };
    }

    function drawHearts() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      hearts.forEach((h) => {
        ctx.save();
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

        h.x += Math.sin(h.y / 40) * 0.5;
        h.y -= h.speed;
      });

      hearts = hearts.filter((h) => h.y + h.size > -20);

      const smallMode = cssW < 760;
      const spawnProb = smallMode ? 0.045 : 0.09;
      if (Math.random() < spawnProb) hearts.push(createHeart());

      if (smallMode && hearts.length > 70) hearts = hearts.slice(-70);
      if (!smallMode && hearts.length > 220) hearts = hearts.slice(-220);

      rafId = requestAnimationFrame(drawHearts);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    drawHearts();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resizeCanvas);
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } catch (e) {}
    };
  }, []);

  // Fireworks canvas (new)
  useEffect(() => {
    startFireworks();
    const t = setInterval(() => {
      const diff = offerEndsAt - Date.now();
      if (diff <= 0) {
        setCountdown("Offer ended");
        clearInterval(t);
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff / 3600000) % 24);
      const m = Math.floor((diff / 60000) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setCountdown(`${d}d : ${h}h : ${m}m : ${s}s`);
    }, 1000);

    return () => {
      stopFireworks();
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startFireworks() {
    const cvs = document.getElementById("fxCanvas");
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    let W, H, ents = [];

    function resize() {
      W = cvs.width = window.innerWidth;
      H = cvs.height = window.innerHeight;
    }
    window.addEventListener("resize", resize);
    resize();

    function rand(a, b) { return a + Math.random() * (b - a); }
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
          x, y,
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
      ctx.fillStyle = "rgba(15,10,20,0.22)";
      ctx.fillRect(0, 0, W, H);
      if (Math.random() < 0.01) burst(rand(W * 0.1, W * 0.9), rand(H * 0.15, H * 0.55));
      ents = ents.filter((p) => ((p.age += 0.016), p.age < p.life));
      for (const p of ents) {
        p.vy += 0.5 * 0.016;
        p.x += p.vx; p.y += p.vy;
        const a = 1 - p.age / p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace("rgb", "rgba").replace(")", `,${a.toFixed(2)})`);
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

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        try {
          socketRef.current.removeAllListeners && socketRef.current.removeAllListeners();
          socketRef.current.disconnect && socketRef.current.disconnect();
        } catch (e) {}
        socketRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      // <-- keep your redirect protection
      if (typeof window !== "undefined" && window.__milan_redirecting) return;

      if (
        document.visibilityState === "hidden" &&
        socketRef.current &&
        isSearching
      ) {
        try {
          socketRef.current.emit && socketRef.current.emit("disconnectByUser");
          socketRef.current.disconnect && socketRef.current.disconnect();
        } catch {}
        socketRef.current = null;
        setIsSearching(false);
        setShowLoader(false);
        setShowModeButtons(true);
        setModeText("");
        setStatusMessage("❤️ जहाँ दिल मिले, वहीं होती है शुरुआत Milan की…");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isSearching]);

  function openProfilePanel() {
    setEditProfile({ ...profile, interests: [...(profile.interests || [])], photoDataUrls: [...(profile.photoDataUrls || [])] });
    setShowProfile(true);
    setShowSecurity(false);
    setShowLogoutConfirm(false);
  }
  function openSecurityPanel() {
    setShowSecurity(true);
    setShowProfile(false);
    setShowLogoutConfirm(false);
  }
  function openLogoutConfirm() {
    setShowLogoutConfirm(true);
    setShowProfile(false);
    setShowSecurity(false);
  }

  function saveProfile(updated) {
    const newProfile = { ...profile, ...updated };
    setProfile(newProfile);
    if (typeof window !== "undefined") {
      localStorage.setItem("milan_profile", JSON.stringify(newProfile));
    }
  }

  async function handleAddPhoto(e, options = { overlayMode: false }) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = function (ev) {
      const dataUrl = ev.target.result;
      if (options.overlayMode && editProfile) {
        const next = [...(editProfile.photoDataUrls || [])];
        if (next.length >= 3) {
          alert("Maximum 3 photos allowed. Remove one to add a new.");
          return;
        }
        next.push(dataUrl);
        setEditProfile({ ...editProfile, photoDataUrls: next });
      } else {
        const next = [...(profile.photoDataUrls || [])];
        if (next.length >= 3) {
          alert("Maximum 3 photos allowed. Remove one to add a new.");
          return;
        }
        next.push(dataUrl);
        saveProfile({ photoDataUrls: next });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function removePhoto(index, options = { overlayMode: false }) {
    if (options.overlayMode && editProfile) {
      const next = [...(editProfile.photoDataUrls || [])];
      next.splice(index, 1);
      setEditProfile({ ...editProfile, photoDataUrls: next });
    } else {
      const next = [...(profile.photoDataUrls || [])];
      next.splice(index, 1);
      saveProfile({ photoDataUrls: next });
    }
  }

  function saveNewPassword(e) {
    e && e.preventDefault && e.preventDefault();
    if (typeof window === "undefined") return;
    const savedPwd = localStorage.getItem("milan_password") || "";
    if (savedPwd && savedPwd !== currentPasswordInput) {
      alert("Current password is incorrect.");
      return;
    }
    if (!newPasswordInput || newPasswordInput.length < 4) {
      alert("New password should be at least 4 characters.");
      return;
    }
    localStorage.setItem("milan_password", newPasswordInput);
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setShowSecurity(false);
    alert("Password updated (frontend only).");
  }

  function handleLogoutConfirmYes() {
    if (typeof window === "undefined") return;
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/";
  }

  function startSearch(type) {
    if (isSearching || connectingRef.current) return;
    connectingRef.current = true;

    setIsSearching(true);
    setShowLoader(true);
    setShowModeButtons(false);
    setModeText(
      type === "video" ? "Video Chat" : type === "game" ? "Play & Chat" : "Text Chat"
    );
    setStatusMessage(
      type === "video"
        ? "🎥 Searching for a Video Chat partner..."
        : type === "game"
        ? "🎮 Finding a playful partner for Tic-Tac-Toe..."
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
        (typeof window !== "undefined" &&
          localStorage.getItem("token")) ||
        "";

      socketRef.current.off && socketRef.current.off("partnerFound");
      socketRef.current.off && socketRef.current.off("partnerDisconnected");
      socketRef.current.off && socketRef.current.off("connect_error");
      socketRef.current.off && socketRef.current.off("partnerSharedLoveCalc");

      socketRef.current.emit("lookingForPartner", { type, token });

      // ---------- partnerFound handler ----------
      socketRef.current.on("partnerFound", (data) => {
        try {
          partnerRef.current = data?.partner || {};
          const roomCode = (data && data.roomCode) || "";

          if (!roomCode) {
            console.warn("[connect] partnerFound but no roomCode", data);
            setStatusMessage("Partner found but room creation failed. Trying again...");
            setTimeout(() => stopSearch(), 800);
            return;
          }

          if (typeof window !== "undefined") {
            try {
              sessionStorage.setItem("partnerData", JSON.stringify(partnerRef.current));
              sessionStorage.setItem("roomCode", roomCode);
              localStorage.setItem("lastRoomCode", roomCode);
            } catch (e) {}
          }

          setStatusMessage("💖 Milan Successful!");
          if (typeof window !== "undefined") {
            try {
              window.__milan_redirecting = true;
              setTimeout(() => { try { window.__milan_redirecting = false; } catch {} }, 2000);
            } catch (e) {}
          }

          setTimeout(() => {
            try {
              const safePath =
                type === "video"
                  ? "/video"
                  : type === "game"
                  ? `/game?room=${encodeURIComponent(roomCode)}`
                  : "/chat";
              if (typeof window !== "undefined") window.location.href = safePath;
            } catch (e) {
              console.error("[connect] redirect failed", e);
              if (typeof window !== "undefined") {
                window.location.href = type === "game" ? "/game" : type === "video" ? "/video" : "/chat";
              }
            }
          }, 120);
        } catch (e) {
          console.error("[connect] partnerFound handler error", e);
          setTimeout(() => stopSearch(), 500);
        }
      });

      socketRef.current.on("partnerDisconnected", () => {
        if (typeof window !== "undefined" && window.__milan_redirecting) return;
        alert("Partner disconnected.");
        stopSearch();
      });

      socketRef.current.on("partnerSharedLoveCalc", (payload) => {
        try {
          setIncomingLove(payload || null);
          if (payload && payload.payload) {
            const p = payload.payload;
            setLcNameA(p.nameA || "");
            setLcNameB(p.nameB || "");
            setLcAgeA(p.ageA || "");
            setLcAgeB(p.ageB || "");
            setLcInterests(Array.isArray(p.interests) ? p.interests.join(", ") : (p.interests || ""));
            setLcScore(p.score || null);
            setLcMsg(p.message || "");
            triggerHearts(p.score || 60);
            setShowLoveCalc(true);
          } else {
            alert(`${payload?.fromName || "Partner"} shared a LoveCalc result.`);
          }
        } catch (e) {
          console.warn("Error handling partnerSharedLoveCalc", e);
        }
      });

      socketRef.current.on("connect_error", (err) => {
        console.warn("Socket connect_error:", err?.message || err);
        alert("Connection error. Please try again.");
        stopSearch();
      });
    } catch (e) {
      console.error("Socket error:", e);
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
        socketRef.current.emit && socketRef.current.emit("disconnectByUser");
        socketRef.current.disconnect && socketRef.current.disconnect();
      } catch {}
      try {
        socketRef.current.removeAllListeners && socketRef.current.removeAllListeners();
      } catch {}
      socketRef.current = null;
    }
    setIsSearching(false);
    setShowLoader(false);
    setShowModeButtons(true);
    setModeText("");
    setStatusMessage("❤️ जहाँ दिल मिले, वहीं होती है शुरुआत Milan की…");
  }

  // Love Calculator helpers
  function sanitize(s) { return (s||"").toString().trim().toLowerCase(); }
  function calcLoveScore(nameA, nameB, ageA, ageB, interestsArr){
    const letters = (sanitize(nameA)+sanitize(nameB)).replace(/[^a-z]/g,'');
    let sum = 0;
    for (let i=0;i<letters.length;i++) sum += (letters.charCodeAt(i) - 96);
    let partLetters = (sum % 51);
    let ageBonus = 0;
    if (ageA && ageB) {
      const gap = Math.abs(Number(ageA) - Number(ageB));
      ageBonus = Math.max(0, 20 - gap);
    }
    let interestBonus = 0;
    if (interestsArr && interestsArr.length){
      const uniq = [...new Set(interestsArr.map(s=>s.trim().toLowerCase()).filter(Boolean))];
      interestBonus = Math.min(uniq.length * 8, 24);
    }
    const setA = new Set(sanitize(nameA).replace(/[^a-z]/g,'').split(''));
    const setB = new Set(sanitize(nameB).replace(/[^a-z]/g,'').split(''));
    let common = 0; setA.forEach(ch => { if (setB.has(ch)) common++; });
    const nameHarmony = Math.min(common * 2, 6);
    let raw = partLetters + ageBonus + interestBonus + nameHarmony;
    raw = Math.max(3, Math.min(98, Math.round(raw)));
    const rndSeed = (sanitize(nameA)+sanitize(nameB)).split('').reduce((a,c)=>a+c.charCodeAt(0),0);
    const tiny = (rndSeed % 7) - 3;
    const finalScore = Math.max(5, Math.min(99, raw + tiny));
    return finalScore;
  }
  function friendlyMessage(score){
    if (score >= 90) return "Soulmates alert! 🔥 Be gentle, you're on fire.";
    if (score >= 75) return "Strong vibes — go say hi with confidence 😊";
    if (score >= 55) return "Good match — give it a try, make conversation light.";
    if (score >= 35) return "Could grow — try common interests & patience.";
    return "Awww — maybe friendship first? Keep it genuine.";
  }
  function triggerHearts(score){
    const count = Math.max(4, Math.min(10, Math.round((score||50)/10)));
    const arr = new Array(count).fill(0).map((_,i)=>({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2,6)}`,
      left: 8 + i*12 + Math.random()*40,
      size: 18 + Math.random()*14,
      delay: i * 120
    }));
    setLcHearts(arr);
    setTimeout(()=> setLcHearts([]), 2600);
  }
  function onCalculateLove(e){
    e && e.preventDefault && e.preventDefault();
    if (!lcNameA || !lcNameB) {
      alert("Dono names daaldo — masti shuru!");
      return;
    }
    const interestsArr = (lcInterests || "").split(",").map(s=>s.trim()).filter(Boolean);
    const score = calcLoveScore(lcNameA, lcNameB, lcAgeA, lcAgeB, interestsArr);
    setLcScore(score);
    setLcMsg(friendlyMessage(score));
    triggerHearts(score);
    const payload = { nameA: lcNameA, nameB: lcNameB, ageA: lcAgeA, ageB: lcAgeB, interests: interestsArr, score, message: friendlyMessage(score), time: Date.now() };
    try {
      const hist = JSON.parse(localStorage.getItem("lovecalc_history")||"[]");
      hist.unshift(payload);
      localStorage.setItem("lovecalc_history", JSON.stringify(hist.slice(0,50)));
    } catch (e) {}
    localStorage.setItem("lastLoveCalc", JSON.stringify(payload));
  }
  function onShareLoveCalc(){
    const last = JSON.parse(localStorage.getItem("lastLoveCalc") || "null");
    if (!last) {
      alert("Pehle calculate karo phir share karna 😉");
      return;
    }
    try {
      if (socketRef.current && socketRef.current.connected && partnerRef.current && partnerRef.current.id) {
        socketRef.current.emit("shareLoveCalc", { fromName: profile.name || "Someone", to: partnerRef.current.id, payload: last });
        alert("Result sent to partner ✨");
      } else {
        const text = `LoveCalc: ${last.nameA} + ${last.nameB} = ${last.score}% — ${last.message}`;
        navigator.clipboard?.writeText(text).then(()=> alert('Copied result to clipboard — share manually!')).catch(()=> alert('Could not copy — but result saved locally.'));
      }
    } catch (e) {
      console.warn(e);
      alert('Sharing failed, but result saved locally.');
    }
  }

  const [interestInput, setInterestInput] = useState("");
  function handleAddInterestFromInput() {
    const raw = (interestInput || "").trim();
    if (!raw) return setInterestInput("");
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return setInterestInput("");
    if (editProfile) {
      const next = Array.from(new Set([...(editProfile.interests || []), ...parts])).slice(0, 12);
      setEditProfile({ ...editProfile, interests: next });
    } else {
      const next = Array.from(new Set([...(profile.interests || []), ...parts])).slice(0, 12);
      saveProfile({ interests: next });
    }
    setInterestInput("");
  }
  function removeInterest(idx, options = { overlayMode: false }) {
    if (options.overlayMode && editProfile) {
      const next = [...(editProfile.interests || [])];
      next.splice(idx, 1);
      setEditProfile({ ...editProfile, interests: next });
    } else {
      const next = [...(profile.interests || [])];
      next.splice(idx, 1);
      saveProfile({ interests: next });
    }
  }

  function calcCompleteness(p = profile) {
    let score = 0;
    if (p.name && p.name.trim()) score += 18;
    if (p.contact && p.contact.trim()) score += 12;
    if (p.age && String(p.age).trim()) score += 10;
    if (p.city && p.city.trim()) score += 10;
    if (p.language && p.language.trim()) score += 10;
    if (p.bio && p.bio.trim()) score += 15;
    if (Array.isArray(p.interests) && p.interests.length) score += 15;
    if (Array.isArray(p.photoDataUrls) && p.photoDataUrls.length) {
      score += Math.min(10, p.photoDataUrls.length * Math.ceil(10 / 3));
    }
    return Math.min(100, Math.round(score));
  }

  const completeness = calcCompleteness(profile);
  const editCompleteness = editProfile ? calcCompleteness(editProfile) : completeness;

  // --- Diwali actions
  function celebrate() {
    const audio = document.getElementById("celeAudio");
    try { audio.currentTime = 0; audio.play(); } catch {}
    const { burst } = fwRef.current;
    const x = window.innerWidth / 2, y = window.innerHeight * 0.3;
    for (let i = 0; i < 4; i++)
      setTimeout(() => burst(x + (Math.random()*160 - 80), y + (Math.random()*80 - 40)), i * 140);
  }
  function lightDiya() {
    setWish("");
    setWishDone(false);
    setShowWish(true);
  }
  function submitWish() {
    setWishDone(true);
    const { burst } = fwRef.current;
    burst && burst(window.innerWidth * 0.5, window.innerHeight * 0.32);
  }
  function ripple(e) {
    const btn = e.currentTarget;
    const r = btn.getBoundingClientRect();
    const s = document.createElement("span");
    const d = Math.max(r.width, r.height);
    s.style.width = s.style.height = d + "px";
    s.style.left = e.clientX - r.left - d / 2 + "px";
    s.style.top = e.clientY - r.top - d / 2 + "px";
    s.className = "ripple";
    const old = btn.querySelector(".ripple");
    old && old.remove();
    btn.appendChild(s);
    setTimeout(() => s.remove(), 700);
  }

  return (
    <>
      {/* Backgrounds */}
      <canvas id="heartCanvas" aria-hidden />
      <canvas id="fxCanvas" aria-hidden />

      {/* Audio */}
      <audio id="celeAudio" preload="auto">
        <source src="https://cdn.pixabay.com/download/audio/2022/03/15/audio_4c76d6de8a.mp3?filename=soft-bell-ambient-10473.mp3" type="audio/mpeg" />
      </audio>

      {/* Mobile menu */}
      <button
        type="button"
        className="hamburger"
        aria-label="Toggle menu"
        onClick={() => setSidebarOpen((s) => !s)}
      >
        ☰
      </button>

      {/* Sidebar */}
      <aside
        className={`sidebar ${sidebarOpen ? "open" : ""}`}
        aria-hidden={false}
      >
        <div className="sidebar-top">
          <div className="profile-pic-wrapper">
            <Avatar />
          </div>
          <div className="username">{profile.name || "My Name"}</div>

          <div className="completeness-mini" title={`${completeness}% complete`} style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.95)", fontWeight: 700 }}>
              Profile: {completeness}%
            </div>
            <div className="mini-progress" aria-hidden>
              <div className="mini-progress-bar" style={{ width: `${completeness}%` }} />
            </div>
          </div>

          {profile.interests && profile.interests.length ? (
            <div className="interests-preview" title={profile.interests.join(", ")} style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.9)", textAlign: "center", maxWidth: 200 }}>
              {profile.interests.slice(0, 4).join(", ")}{profile.interests.length > 4 ? "…" : ""}
            </div>
          ) : null}

          <div style={{ marginTop: 8 }}>
            <label htmlFor="photoInput" className="photo-label" style={{ cursor: "pointer" }}>
              Change / Add Photo
            </label>
            <input
              id="photoInput"
              type="file"
              accept="image/*"
              onChange={(e) => handleAddPhoto(e, { overlayMode: false })}
              style={{ display: "none" }}
            />
          </div>
        </div>

        <ul className="sidebar-list">
          <li role="button" onClick={openProfilePanel} className="sidebar-item">
            <span className="sidebar-ic">👤</span>
            <span className="sidebar-txt">Profile Info</span>
          </li>
          <li role="button" onClick={openSecurityPanel} className="sidebar-item">
            <span className="sidebar-ic">🔒</span>
            <span className="sidebar-txt">Security</span>
          </li>
          <li role="button" onClick={() => setShowLoveCalc(true)} className="sidebar-item">
            <span className="sidebar-ic">💘</span>
            <span className="sidebar-txt">Love Calculator</span>
          </li>
          <li role="button" onClick={openLogoutConfirm} className="sidebar-item">
            <span className="sidebar-ic">🚪</span>
            <span className="sidebar-txt">Logout</span>
          </li>
        </ul>
      </aside>

      <main className="content-wrap" role="main">
        {/* Festive banner */}
        {showBanner && (
          <div className="banner">
            <div className="b-left">
              <span className="tag">🪔 Diwali Special</span>
              <h1>Happy Diwali!</h1>
              <p className="sub">“Where hearts meet, that’s where Milan begins…”</p>
            </div>
            <div className="b-right">
              <button className="btn gold" onClick={(e)=>{ripple(e);celebrate();}}>🎉 Celebrate</button>
              <button className="btn ghost" onClick={(e)=>{ripple(e);lightDiya();}}>🪔 Make a Wish</button>
              <span className="count">⏳ Offer ends: <b>{countdown}</b></span>
              <button className="btn x" aria-label="Close banner" onClick={()=>setShowBanner(false)}>✕</button>
            </div>
          </div>
        )}

        <div className="glass-card">
          <div className="center-box">
            <div className="center-top">
              <h2>Select Milan Mode</h2>
              <div className="mode-text" id="modeText">
                {modeText}
              </div>
            </div>

            <div className="mode-options" aria-live="polite">
              {showModeButtons && (
                <div
                  className="mode-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => startSearch("video")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") startSearch("video");
                  }}
                  id="videoBtn"
                  aria-label="Start Video Chat"
                >
                  <button className="mode-btn" type="button">
                    Start Video Chat
                  </button>
                  <p className="mode-desc">
                    Meet face-to-face instantly in Milan’s romantic video room.
                  </p>
                </div>
              )}

              {showModeButtons && (
                <div
                  className="mode-card disabled-card"
                  id="gameBtn"
                  aria-label="Play & Chat Coming Soon"
                >
                  <button className="mode-btn disabled" type="button" disabled>
                    Play & Chat
                  </button>
                  <p className="mode-desc">Tic-Tac-Toe while you chat.</p>
                  <div className="disabled-note">🚧 Coming Soon</div>
                </div>
              )}

              {showModeButtons && (
                <div
                  className="mode-card disabled-card"
                  id="textBtn"
                  aria-label="Text Chat Coming Soon"
                >
                  <button className="mode-btn disabled" type="button" disabled>
                    Text Chat
                  </button>
                  <p className="mode-desc">Express your feelings with messages.</p>
                  <div className="disabled-note">💌 Coming Soon</div>
                </div>
              )}
            </div>

            <div className="quote-box" id="quoteBox">
              {QUOTES[quoteIndex]}
              <span
                style={{
                  display: "block",
                  fontSize: 14,
                  marginTop: 6,
                  opacity: 0.95,
                }}
              >
                (Where hearts meet, that’s where Milan begins…)
              </span>
            </div>

            {showLoader && (
              <div id="loader" className="loader" aria-live="assertive">
                <div id="statusMessage" className="heart-loader">
                  {statusMessage}
                </div>
              </div>
            )}

            {isSearching && (
              <button
                id="stopBtn"
                className="stop-btn"
                onClick={stopSearch}
                type="button"
              >
                Stop Searching
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Wish modal */}
      {showWish && (
        <div className="modal-back" role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target.classList.contains('modal-back')) setShowWish(false); }}>
          <div className="modal-card">
            <header className="modal-head">
              <h3>🪔 Light a Diya & Make a Wish</h3>
              <button className="close" onClick={() => setShowWish(false)} aria-label="Close">✕</button>
            </header>
            <div className="modal-body">
              {!wishDone ? (
                <>
                  <p className="m-desc">Close your eyes, type your wish, then light the diya. May it come true ✨</p>
                  <textarea
                    value={wish}
                    onChange={(e)=>setWish(e.target.value)}
                    placeholder="Type your Diwali wish..."
                    style={{width:'100%',minHeight:100,marginTop:8,padding:'10px 12px',borderRadius:10,border:'1px solid #e6e6e9'}}
                  />
                  <div className="modal-actions">
                    <button className="btn-ghost" onClick={()=>setShowWish(false)}>Cancel</button>
                    <button className="btn-primary" onClick={submitWish}>Light the Diya</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="m-desc">Diya is lit 🔥 Your wish is released to the universe. Ab connection sachha mile! 💖</p>
                  <div className="modal-actions">
                    <button className="btn-primary" onClick={()=>setShowWish(false)}>Close</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Love Calculator Modal (unchanged core) */}
      {showLoveCalc && (
        <div className="modal-back" role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target.classList && e.target.classList.contains('modal-back')) setShowLoveCalc(false); }}>
          <div className="modal-card love-card">
            <header className="modal-head">
              <h3>Love Calculator 💘</h3>
              <button className="close" onClick={() => setShowLoveCalc(false)} aria-label="Close">✕</button>
            </header>

            <div className="modal-body">
              <div style={{display:'flex', gap:8, marginBottom:8}}>
                <input placeholder="Your name" value={lcNameA} onChange={(e)=>setLcNameA(e.target.value)} />
                <input placeholder="Their name" value={lcNameB} onChange={(e)=>setLcNameB(e.target.value)} />
              </div>

              <div style={{display:'flex', gap:8, marginBottom:8}}>
                <input type="number" min="13" placeholder="Your age (optional)" value={lcAgeA} onChange={(e)=>setLcAgeA(e.target.value)} />
                <input type="number" min="13" placeholder="Their age (optional)" value={lcAgeB} onChange={(e)=>setLcAgeB(e.target.value)} />
              </div>

              <div style={{marginBottom:10}}>
                <input placeholder="Common interests (comma separated) - optional" value={lcInterests} onChange={(e)=>setLcInterests(e.target.value)} />
              </div>

              <div style={{display:'flex', gap:8, justifyContent:'space-between', alignItems:'center'}}>
                <button className="btn-primary" onClick={onCalculateLove}>Calculate 🔍</button>
                <div style={{display:'flex', gap:8}}>
                  <button className="btn-ghost" onClick={onShareLoveCalc}>Share</button>
                  <button className="btn-ghost" onClick={() => {
                    const h = JSON.parse(localStorage.getItem('lovecalc_history')||'[]');
                    const msg = h && h.length ? `Last: ${h[0].nameA}+${h[0].nameB} = ${h[0].score}%` : 'No history';
                    alert(msg);
                  }}>History</button>
                </div>
              </div>

              <div style={{marginTop:12, textAlign:'center'}}>
                <div style={{fontSize:36, fontWeight:900}}>{lcScore !== null ? `${lcScore}%` : "—%"}</div>
                <div style={{marginTop:8, fontSize:14, color:'#444'}}>{lcMsg || (lcScore===null ? "Result will appear here." : "")}</div>
              </div>

              <div className="lc-hearts" style={{height:60, position:'relative', marginTop:12}}>
                {lcHearts.map(h => (
                  <div key={h.id} className="lc-heart" style={{ left: h.left, fontSize: h.size, animationDelay: `${h.delay}ms` }}>💖</div>
                ))}
              </div>

              <small className="muted">Algorithm: name letters + age gap + shared interests (for fun only 😉)</small>
            </div>
          </div>
        </div>
      )}

      {/* Bottom diyas */}
      <footer className="foot">
        <div className="diyas">
          <div className="diya"><div className="bowl"></div><div className="oil"></div><div className="flame"></div></div>
          <div className="diya"><div className="bowl"></div><div className="oil"></div><div className="flame" style={{ animationDuration: "1.2s" }}></div></div>
          <div className="diya"><div className="bowl"></div><div className="oil"></div><div className="flame" style={{ animationDuration: "1.6s" }}></div></div>
          <div className="diya"><div className="bowl"></div><div className="oil"></div><div className="flame" style={{ animationDuration: "1.3s" }}></div></div>
        </div>
      </footer>

      {/* Styles */}
      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
          font-family: "Poppins", sans-serif;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          overflow: auto;
        }
        canvas {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 0;
          image-rendering: -webkit-optimize-contrast;
        }

        /* Fireworks canvas above hearts but below UI */
        #fxCanvas { z-index: 1; }
        #heartCanvas { z-index: 0; }

        .hamburger {
          display: none;
          position: fixed;
          top: env(safe-area-inset-top, 12px);
          left: 12px;
          font-size: 24px;
          color: white;
          z-index: 50;
          background: rgba(0, 0, 0, 0.25);
          padding: 8px 10px;
          border-radius: 6px;
          cursor: pointer;
          user-select: none;
          border: 0;
        }

        .sidebar {
          position: fixed;
          top: 0;
          left: 0;
          width: 240px;
          height: 100%;
          background: rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(10px);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 38px;
          z-index: 40;
          color: white;
          transition: transform 0.28s ease;
        }
        .sidebar.open { transform: translateX(0); }
        .profile-pic-wrapper { width: 78px; height: 78px; border-radius: 50%; overflow: hidden; box-shadow: 0 6px 18px rgba(0,0,0,0.25); }
        .username {
          margin-top: 8px;
          font-size: 18px;
          font-weight: 800;
          color: #fff;
          text-align: center;
          padding: 6px 12px;
          letter-spacing: 0.2px;
        }
        .photo-label {
          font-size: 13px;
          color: #fff;
          background: linear-gradient(90deg, rgba(255,107,129,0.12), rgba(255,159,176,0.08));
          padding: 6px 12px;
          border-radius: 10px;
          cursor: pointer;
          display: inline-block;
          margin-top: 8px;
        }

        .sidebar-list { list-style: none; padding: 0; margin-top: 26px; width: 100%; }
        .sidebar-list li {
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: flex-start;
          padding: 10px 14px;
          margin: 8px 12px;
          background: linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          border-radius: 12px;
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
        }
        .sidebar-item:hover {
          transform: translateX(6px);
          box-shadow: 0 10px 28px rgba(0,0,0,0.22);
          background: linear-gradient(90deg, rgba(255,107,129,0.04), rgba(255,159,176,0.02));
        }
        .sidebar-ic { font-size: 18px; display:inline-block; width:22px; text-align:center; }
        .sidebar-txt { font-size: 17px; font-weight:800; color:#fff; }

        .content-wrap {
          margin-left: 240px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          justify-content: flex-start;
          padding: 18px;
          z-index: 10;
          position: relative;
        }

        /* Festive banner */
        .banner{
          width:min(100%, 980px);
          display:flex;gap:16px;justify-content:space-between;align-items:center;
          background:rgba(255,255,255,0.18);
          border:1px solid rgba(255,255,255,.22);
          backdrop-filter:blur(6px);
          border-radius:18px;padding:12px 14px;
          box-shadow:0 12px 48px rgba(0,0,0,.22);
        }
        .b-left h1{margin:0;font-size:28px;letter-spacing:.5px;text-shadow:0 10px 28px rgba(0,0,0,.26)}
        .b-left .tag{display:inline-block;border:1px solid rgba(255,255,255,.25);padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.08);font-size:12px;margin-bottom:6px}
        .b-left .sub{margin:4px 0 0 0;color:#fff;opacity:.92;font-weight:600;font-size:13px}
        .b-right{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
        .btn{position:relative;overflow:hidden;border:none;border-radius:12px;padding:10px 12px;font-weight:800;cursor:pointer}
        .btn.gold{background:rgba(255,209,102,.18);color:#ffe9ac;box-shadow:0 8px 28px rgba(255,209,102,.22)}
        .btn.ghost{border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);color:#fff}
        .btn.x{background:transparent;border:1px solid rgba(255,255,255,.18);padding:6px 10px}
        .count{font-size:12px;color:#fff;opacity:.95;font-weight:800}
        .ripple{position:absolute;border-radius:50%;transform:scale(0);animation:ripple .7s linear;background:rgba(255,255,255,.35);pointer-events:none}
        @keyframes ripple{to{transform:scale(4);opacity:0}}

        .glass-card {
          width: min(100%, 820px);
          background: rgba(255, 255, 255, 0.06);
          border-radius: 18px;
          backdrop-filter: blur(10px);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.20);
          display: block;
          padding: 12px;
        }

        .center-box {
          width: 100%;
          color: #fff;
          text-align: center;
          z-index: 12;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-sizing: border-box;
          padding: 6px 6px;
        }

        .center-top { margin-bottom: 2px; }
        .center-box h2 {
          font-size: 34px;
          margin: 6px 0 4px 0;
          font-weight: 800;
          text-shadow: 0 0 12px rgba(236,72,153,0.16);
        }

        .mode-text {
          color: #ffe4f1;
          font-weight: 700;
          margin-bottom: 6px;
          min-height: 20px;
        }

        .mode-options {
          display: flex;
          justify-content: center;
          gap: 10px;
          align-items: stretch;
          flex-wrap: nowrap;
          margin-top: 6px;
        }

        .mode-card,
        .disabled-card {
          flex: 1 1 260px;
          max-width: 420px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
          outline: none;
          box-sizing: border-box;
          min-height: 120px;
        }
        .mode-card:active { transform: translateY(1px); }
        .mode-card:hover { transform: translateY(-3px); box-shadow: 0 14px 36px rgba(0,0,0,0.18); }

        .mode-btn {
          width: 92%;
          padding: 10px 12px;
          border-radius: 10px;
          border: none;
          background: #fff;
          color: #ec4899;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(236,72,153,0.06);
        }

        .mode-btn.disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .mode-desc {
          color: rgba(255, 255, 255, 0.92);
          font-size: 13px;
          margin-top: 4px;
          margin-bottom: 4px;
        }

        .disabled-note {
          margin-top: 4px;
          font-size: 13px;
          color: #ffe4f1;
          font-style: italic;
        }

        .loader { margin: 6px auto; }
        .heart-loader {
          font-size: 26px;
          color: #fff;
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
          100% { opacity: 0.2; transform: scale(1); }
        }

        .stop-btn {
          margin-top: 6px;
          padding: 10px 16px;
          background: #ff4d4f;
          color: #fff;
          border: none;
          border-radius: 10px;
          cursor: pointer;
        }

        .quote-box {
          margin-top: 6px;
          font-weight: 700;
          color: #ffeff7;
          text-shadow: 0 0 6px rgba(255,136,170,0.12);
          padding: 8px 10px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          animation: quoteFade 0.35s ease;
        }
        @keyframes quoteFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

        /* PROFILE OVERLAY (glass) */
        .profile-overlay { position: fixed; inset: 0; background: rgba(2,6,23,0.55); z-index: 120; display: flex; align-items: center; justify-content: center; padding: 18px; }
        .profile-card {
          width: min(880px, 96%);
          max-width: 880px;
          background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.95));
          border-radius: 12px;
          box-shadow: 0 18px 60px rgba(0,0,0,0.35);
          overflow: hidden;
          display: flex; flex-direction: column; gap: 8px;
          max-height: calc(100vh - 80px);
        }
        .profile-head { display:flex; align-items:center; justify-content:space-between; padding: 12px 16px; background: linear-gradient(90deg, rgba(255,236,245,0.95), rgba(255,255,255,0.95)); border-bottom: 1px solid rgba(0,0,0,0.04); }
        .profile-head h3 { margin:0; font-size:18px; color:#0b1220; font-weight:900; }
        .profile-head .close { background:transparent;border:0;font-size:18px;cursor:pointer;color:#666; }
        .profile-body { padding: 12px 16px; display:flex; flex-direction:column; gap:10px; color:#222; overflow: auto; }
        .profile-body label { display:block; font-weight:700; color:#334; margin-bottom:6px; font-size:13px; }
        .profile-body input, .profile-body select, .profile-body textarea { width:100%; padding:8px 10px; border-radius:8px; border:1px solid #e6e6e9; box-sizing:border-box; font-size:14px; height: 38px; }
        .profile-body textarea { min-height:70px; resize:vertical; padding-top:8px; padding-bottom:8px; }
        .row { width:100%; }
        .two-col { display:flex; gap:8px; }
        .three-col { display:flex; gap:8px; }
        .three-col > div { flex:1; }
        .interests-input { display:flex; gap:8px; align-items:center; }
        .interests-input input { flex:1; height:36px; }
        .btn-small { background: linear-gradient(90deg,#ff6b81,#ff9fb0); color:#08121a; padding:8px 10px; border-radius:8px; border:none; font-weight:800; cursor:pointer; height:36px; }
        .chips { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
        .chip { background:#fff; padding:6px 10px; border-radius:18px; display:flex; gap:8px; align-items:center; font-weight:700; box-shadow: 0 6px 18px rgba(0,0,0,0.06); font-size:13px; }
        .chip button { background:transparent; border:0; cursor:pointer; color:#c33; font-weight:800; }
        .photo-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .photo-thumb { position:relative; width:72px; height:72px; border-radius:8px; overflow:hidden; background:#f3f3f3; display:flex; align-items:center; justify-content:center; box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
        .photo-thumb img { width:100%; height:100%; object-fit:cover; }
        .photo-thumb .remove-photo { position:absolute; top:6px; right:6px; background: rgba(0,0,0,0.36); color:#fff; border:0; padding:6px 8px; border-radius:6px; cursor:pointer; font-size:12px; }
        .photo-add { width:72px; height:72px; border-radius:8px; background:linear-gradient(90deg,#fff,#fff); display:flex; align-items:center; justify-content:center; box-shadow: 0 6px 18px rgba(0,0,0,0.04); }
        .photo-add-label { display:block; cursor:pointer; color:#ec4899; font-weight:800; }
        .progress-wrap { width:100%; height:10px; background: #f1f1f1; border-radius:8px; overflow: hidden; margin-top:6px; }
        .progress-bar { height:100%; background: linear-gradient(90deg,#ff6b81,#ff9fb0); width:0%; transition: width 260ms ease; }
        .actions { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .btn-primary { background: linear-gradient(90deg,#ff6b81,#ff9fb0); color:#08121a; padding:8px 12px; border-radius:8px; border:none; font-weight:800; cursor:pointer; height:38px; }
        .btn-ghost { background:#f3f4f6; color:#333; padding:8px 10px; border-radius:8px; border:none; cursor:pointer; height:38px; }

        .modal-back { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(2,6,23,0.45); z-index: 80; padding: 12px; }
        .modal-card { width: 96%; max-width: 520px; background: #fff; border-radius: 12px; box-shadow: 0 18px 60px rgba(0,0,0,0.35); overflow: hidden; }
        .love-card { max-width:520px; }
        .lc-hearts .lc-heart { position:absolute; bottom:6px; animation: lc-rise 2200ms linear forwards; opacity:0.95; }
        @keyframes lc-rise { 0%{ transform: translateY(0) scale(0.8); opacity:0.9 } 60%{ opacity:1; transform: translateY(-80px) scale(1.05) } 100%{ transform: translateY(-160px) scale(0.9); opacity:0 } }
        .modal-card.small { max-width: 420px; }
        .modal-head { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; background: linear-gradient(90deg,#ffeef5,#fff); }
        .modal-head h3 { margin:0; font-size:18px; color:#08121a; font-weight:800; }
        .modal-head .close { background:transparent;border:0;font-size:18px;cursor:pointer;color:#666; }
        .modal-body { padding:14px 16px 18px 16px; color:#08121a; }
        .modal-body label { display:block; font-weight:700; color:#334; margin-top:8px; }
        .modal-body input { width:100%; padding:10px 12px; margin-top:8px; border-radius:8px; border:1px solid #e6e6e9; box-sizing:border-box; }
        .m-desc{ color:#333; }
        .modal-actions { display:flex; gap:10px; justify-content:flex-end; margin-top:12px; }

        .mini-progress { width:140px; height:8px; background: rgba(255,255,255,0.08); border-radius:8px; margin-top:6px; overflow:hidden; }
        .mini-progress-bar { height:100%; background: linear-gradient(90deg,#ff6b81,#ff9fb0); width:0%; transition: width 280ms ease; }
        .export-btn { border: 1px solid #e6e6e9; padding:8px 10px; background:#fff; border-radius:8px; }

        /* Bottom diyas */
        .foot .diyas{position:fixed;left:0;right:0;bottom:12px;display:flex;gap:24px;justify-content:center;align-items:flex-end;pointer-events:none;z-index:5}
        .diya{position:relative;width:70px;height:44px;filter:drop-shadow(0 6px 14px rgba(255,128,0,.35))}
        .diya .bowl{position:absolute;inset:auto 0 0 0;height:32px;border-radius:0 0 36px 36px/0 0 24px 24px;background:radial-gradient(120% 140% at 50% -10%,#ffb86b,#8b2c03 60%);border-top:2px solid rgba(255,255,255,.25)}
        .diya .oil{position:absolute;left:8px;right:8px;bottom:18px;height:8px;border-radius:6px;background:linear-gradient(#5a1b00,#2b0a00)}
        .flame{position:absolute;left:50%;bottom:28px;width:18px;height:28px;transform:translateX(-50%);background:radial-gradient(50% 65% at 50% 60%,#fff7cc 0%,#ffd166 55%,#ff8c00 75%,rgba(255,0,0,0) 80%);border-radius:12px 12px 14px 14px/18px 18px 8px 8px;animation:flicker 1.4s infinite ease-in-out;box-shadow:0 0 18px 6px rgba(255,173,51,.45),0 0 36px 12px rgba(255,140,0,.15)}
        .flame:before{content:"";position:absolute;inset:4px;border-radius:inherit;background:radial-gradient(circle at 50% 70%,#fffbe6,rgba(255,255,255,0) 66%);filter:blur(1px)}
        @keyframes flicker{0%{transform:translateX(-50%) scale(1) rotate(-2deg);opacity:.95}40%{transform:translateX(calc(-50% + 1px)) scale(1.05) rotate(2deg);opacity:.85}70%{transform:translateX(calc(-50% - 1px)) scale(.98) rotate(-1deg);opacity:.92}100%{transform:translateX(-50%) scale(1) rotate(0deg);opacity:.95}}

        @media (max-width: 1024px) {
          .glass-card { width: min(100%, 760px); }
        }
        @media (max-width: 768px) {
          .hamburger { display: block; }
          .sidebar { transform: translateX(-100%); width: 200px; }
          .sidebar.open { transform: translateX(0); }
          .content-wrap { left: 0; padding: 10px; margin-left: 0; }
          .banner{flex-direction:column;align-items:flex-start}
          .glass-card { width: 98%; padding: 10px; border-radius: 14px; }
          .center-box h2 { font-size: 22px; margin: 4px 0 6px 0; }
          .mode-options { flex-direction: column; gap: 8px; margin-top: 6px; align-items: center; }
          .mode-card, .disabled-card { width: 96%; max-width: 96%; padding: 10px; border-radius: 12px; min-height: 100px; }
          .mode-btn { font-size: 15px; padding: 10px; }
          .mode-desc { font-size: 13px; margin-bottom: 6px; }
          .quote-box { font-size: 13px; padding: 8px; margin-bottom: 4px; }
          .profile-card { width: 96%; max-width: 680px; padding: 0; max-height: calc(100vh - 48px); }
          .three-col { flex-direction: column; }
          .two-col { flex-direction: column; }
          .profile-body { padding: 10px; gap:8px; }
          .photo-thumb { width: 56px; height: 56px; }
          .photo-add { width:56px; height:56px; }
          .btn-primary { padding:8px 10px; height:36px; }
          .btn-ghost { padding:8px 10px; height:36px; }
          .actions { gap: 8px; }
          .export-btn { display: none; }
        }
        @media (max-width: 480px) {
          .sidebar { width: 180px; }
          .profile-card { max-width: 100%; }
        }
      `}</style>
    </>
  );
}

/* Avatar component (unchanged) */
function Avatar() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      const uid = localStorage.getItem("uid");
      const token = localStorage.getItem("token");
      if (!uid || !token) return;

      try {
        const res = await fetch(`/api/profile/${uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch profile");
        const data = await res.json();
        setProfile(data);
      } catch (err) {
        console.error("Error fetching profile:", err);
      }
    }
    loadProfile();
  }, []);

  if (!profile) return <div>Loading...</div>;

  const first = (profile.name?.trim()?.charAt(0).toUpperCase()) || "M";

  return profile.avatar ? (
    <img
      src={profile.avatar}
      alt="avatar"
      style={{ width: 70, height: 70, borderRadius: "50%", objectFit: "cover" }}
    />
  ) : (
    <div
      aria-label={`avatar ${first}`}
      style={{
        width: 70, height: 70, borderRadius: "50%",
        background: "#ec4899", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 28, fontWeight: 700, color: "#fff",
      }}
    >
      {first}
    </div>
  );
}
