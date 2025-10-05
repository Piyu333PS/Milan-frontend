"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import io from "socket.io-client";

/**
 * Milan Connect Page
 * - Sidebar with Profile, Security, Love Calculator, Logout
 * - Center "Select Milan Mode" (Video enabled, others coming soon)
 * - Hearts background animation
 * - Profile overlay editor with photos, interests, and completeness
 * - Love Calculator modal (fun algorithm)
 * - Robust socket partner search + safe redirects
 * - Fixed: handleSaveProfileForm defined (prevents client-side crash)
 */

export default function ConnectPage() {
  // -----------------------------
  // UI state
  // -----------------------------
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Profile (localStorage backed)
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

  const QUOTES = [
    "❤️ जहाँ दिल मिले, वहीं होती है शुरुआत Milan की…",
    "✨ हर chat के पीछे छुपी है एक नई कहानी…",
    "💬 शब्द कम हों या ज़्यादा, connection सच्चा होना चाहिए।",
    "🎥 नज़रें कह देती हैं जो लफ़्ज़ नहीं कह पाते।",
    "🌸 प्यार मिल जाए, तो सफ़र आसान लगने लगता है।",
  ];
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState(QUOTES[0]);
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

  const socketRef = useRef(null);
  const partnerRef = useRef(null);
  const connectingRef = useRef(false);

  const backendUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com";
  }, []);

  // Quote rotator
  useEffect(() => {
    const id = setInterval(() => {
      setQuoteIndex((i) => {
        const next = (i + 1) % QUOTES.length;
        setStatusMessage(QUOTES[next]);
        return next;
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Load profile from localStorage
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

  // Prefill love calc nameA
  useEffect(() => {
    if (profile && profile.name) {
      setLcNameA(profile.name);
    }
  }, [profile.name]);

  // Hearts canvas animation
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

  // Cleanup socket on unmount
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

  // Avoid disconnect on intentional redirect
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      if (typeof window !== "undefined" && window.__milan_redirecting) {
        return;
      }
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
        setStatusMessage(QUOTES[0]);
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

  // -------- FIX: handleSaveProfileForm (prevents ReferenceError & crashes) --------
  async function handleSaveProfileForm(e) {
    e && e.preventDefault && e.preventDefault();

    try {
      if (!editProfile) {
        console.warn("No editProfile available to save.");
        setShowProfile(false);
        return;
      }

      const updated = {
        ...editProfile,
        name: editProfile.name || editProfile.fullname || profile.name || "",
      };

      if (!updated.name || !updated.name.trim()) {
        alert("Please enter your name.");
        return;
      }

      // Save locally first
      saveProfile(updated);

      // Optional: attempt backend sync if token exists
      try {
        if (typeof window !== "undefined") {
          const token = localStorage.getItem("token");
          const uid = localStorage.getItem("uid");
          if (token && uid) {
            fetch(`${backendUrl}/api/profile/${uid}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(updated),
            }).then((res) => {
              if (!res.ok) {
                console.warn("Backend profile save did not succeed (non-blocking).");
              }
            }).catch((err) => {
              console.warn("Backend profile save failed (non-blocking):", err);
            });
          }
        }
      } catch (e) {
        console.warn("Optional backend sync error", e);
      }

      setShowProfile(false);
      setEditProfile(null);
      alert("Profile saved!");
    } catch (err) {
      console.error("Error in handleSaveProfileForm:", err);
      alert("Profile save failed (see console).");
    }
  }
  // -------------------------------------------------------------------------------

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

      socketRef.current.on("partnerFound", (data) => {
        try {
          partnerRef.current = data?.partner || {};
          const roomCode = (data && data.roomCode) || "";

          console.log("[connect] partnerFound payload:", data);

          if (!roomCode) {
            console.warn("[connect] partnerFound but no roomCode received", data);
            setStatusMessage("Partner found but room creation failed. Trying again shortly...");
            setTimeout(() => stopSearch(), 800);
            return;
          }

          if (typeof window !== "undefined") {
            try {
              sessionStorage.setItem("partnerData", JSON.stringify(partnerRef.current));
              sessionStorage.setItem("roomCode", roomCode);
              localStorage.setItem("lastRoomCode", roomCode);
            } catch (e) {
              console.warn("[connect] storage write failed", e);
            }
          }

          setStatusMessage("💖 Milan Successful!");

          if (typeof window !== "undefined") {
            try {
              window.__milan_redirecting = true;
              setTimeout(() => {
                try { window.__milan_redirecting = false; } catch {}
              }, 2000);
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

              if (typeof window !== "undefined") {
                window.location.href = safePath;
              }
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
        if (typeof window !== "undefined" && window.__milan_redirecting) {
          console.log("[connect] ignored partnerDisconnected due to redirect");
          return;
        }
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
    setStatusMessage(QUOTES[0]);
  }

  // Love Calculator utils
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
    let common = 0;
    setA.forEach(ch => { if (setB.has(ch)) common++; });
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
      alert("Dono names daal do — masti shuru!");
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
      alert("Pehle calculate karo phir share 😉");
      return;
    }
    try {
      if (socketRef.current && socketRef.current.connected && partnerRef.current && partnerRef.current.id) {
        socketRef.current.emit("shareLoveCalc", { fromName: profile.name || "Someone", to: partnerRef.current.id, payload: last });
        alert("Result sent to partner ✨");
      } else {
        const text = `LoveCalc: ${last.nameA} + ${last.nameB} = ${last.score}% — ${last.message}`;
        navigator.clipboard?.writeText(text).then(()=> alert('Copied result — share anywhere!')).catch(()=> alert('Could not copy — but result saved locally.'));
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

  return (
    <>
      <canvas id="heartCanvas" aria-hidden />

      <button
        type="button"
        className="hamburger"
        aria-label="Toggle menu"
        onClick={() => setSidebarOpen((s) => !s)}
      >
        ☰
      </button>

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

      {showProfile && (
        <div
          className="profile-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target && e.target.classList && e.target.classList.contains("profile-overlay")) {
              setShowProfile(false);
              setEditProfile(null);
            }
          }}
        >
          <div className="profile-card" role="region" aria-label="Edit Profile">
            <header className="profile-head">
              <h3>Edit Your Profile</h3>
              <button className="close" onClick={() => { setShowProfile(false); setEditProfile(null); }} aria-label="Close">✕</button>
            </header>

            {editProfile ? (
              <form className="profile-body" onSubmit={handleSaveProfileForm}>
                <div className="row">
                  <label>Full Name</label>
                  <input
                    name="fullname"
                    placeholder="Full Name"
                    value={editProfile.name || ""}
                    onChange={(e) => setEditProfile({ ...editProfile, name: e.target.value })}
                  />
                </div>

                <div className="row two-col">
                  <div style={{ flex: 1 }}>
                    <label>Contact (Email or Mobile)</label>
                    <input
                      name="contact"
                      placeholder="Email or Mobile"
                      value={editProfile.contact || ""}
                      onChange={(e) => setEditProfile({ ...editProfile, contact: e.target.value })}
                      className="contact-input"
                    />
                  </div>
                </div>

                <div className="row three-col">
                  <div>
                    <label>Age</label>
                    <input
                      name="age"
                      type="number"
                      min="13"
                      placeholder="Age"
                      value={editProfile.age || ""}
                      onChange={(e) => setEditProfile({ ...editProfile, age: e.target.value })}
                    />
                  </div>
                  <div>
                    <label>City</label>
                    <input
                      name="city"
                      placeholder="City"
                      value={editProfile.city || ""}
                      onChange={(e) => setEditProfile({ ...editProfile, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <label>Language</label>
                    <select
                      name="language"
                      value={editProfile.language || ""}
                      onChange={(e) => setEditProfile({ ...editProfile, language: e.target.value })}
                    >
                      <option value="">Select</option>
                      <option value="English">English</option>
                      <option value="Hindi">Hindi</option>
                      <option value="Hinglish">Hinglish</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="row">
                  <label>Short Bio (max 150 chars)</label>
                  <textarea
                    name="bio"
                    maxLength={150}
                    placeholder="A short intro about you..."
                    value={editProfile.bio || ""}
                    onChange={(e) => setEditProfile({ ...editProfile, bio: e.target.value })}
                  />
                  <div className="char-note">{(editProfile.bio || "").length}/150</div>
                </div>

                <div className="row">
                  <label>Interests / Hobbies</label>
                  <div className="interests-input">
                    <input
                      value={interestInput}
                      onChange={(e) => setInterestInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddInterestFromInput();
                        } else if (e.key === ",") {
                          e.preventDefault();
                          handleAddInterestFromInput();
                        }
                      }}
                      placeholder="Type and press Enter or comma (e.g. Music, Movies)"
                    />
                    <button type="button" className="btn-small" onClick={handleAddInterestFromInput}>Add</button>
                  </div>
                  <div className="chips">
                    {(editProfile.interests || []).map((it, idx) => (
                      <div className="chip" key={idx}>
                        {it}
                        <button type="button" aria-label={`Remove ${it}`} onClick={() => removeInterest(idx, { overlayMode: true })}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="row">
                  <label>Photos (1–3)</label>
                  <div className="photo-row">
                    {(editProfile.photoDataUrls || []).map((p, i) => (
                      <div className="photo-thumb" key={i}>
                        <img src={p} alt={`photo-${i}`} />
                        <button type="button" className="remove-photo" onClick={() => removePhoto(i, { overlayMode: true })}>Remove</button>
                      </div>
                    ))}

                    {(editProfile.photoDataUrls || []).length < 3 && (
                      <div className="photo-add">
                        <label className="photo-add-label">
                          + Add Photo
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleAddPhoto(e, { overlayMode: true })}
                            style={{ display: "none" }}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                <div className="row">
                  <label>Profile Completeness</label>
                  <div className="progress-wrap" aria-hidden>
                    <div className="progress-bar" style={{ width: `${editCompleteness}%` }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "#333" }}>{editCompleteness}% complete</div>
                </div>

                <div className="row actions">
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" className="btn-primary">Save Profile</button>
                    <button type="button" className="btn-ghost" onClick={() => { setShowProfile(false); setEditProfile(null); }}>Cancel</button>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="btn-ghost export-btn"
                      onClick={() => {
                        try {
                          const data = JSON.stringify(editProfile || profile, null, 2);
                          const blob = new Blob([data], { type: "application/json" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "milan_profile.json";
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch (e) {
                          alert("Export failed");
                        }
                      }}
                    >
                      Export
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div style={{ padding: 24, textAlign: "center" }}>Loading…</div>
            )}
          </div>
        </div>
      )}

      {showSecurity && (
        <div className="modal-back" role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target.classList.contains('modal-back')) setShowSecurity(false); }}>
          <div className="modal-card">
            <header className="modal-head">
              <h3>Security</h3>
              <button className="close" onClick={() => setShowSecurity(false)} aria-label="Close">✕</button>
            </header>
            <div className="modal-body">
              <label>Current Password</label>
              <input type="password" value={currentPasswordInput} onChange={(e)=>setCurrentPasswordInput(e.target.value)} />
              <label>New Password</label>
              <input type="password" value={newPasswordInput} onChange={(e)=>setNewPasswordInput(e.target.value)} />
              <div className="modal-actions">
                <button className="btn-primary" onClick={saveNewPassword}>Save</button>
                <button className="btn-ghost" onClick={() => setShowSecurity(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="modal-back" role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target.classList.contains('modal-back')) setShowLogoutConfirm(false); }}>
          <div className="modal-card small">
            <header className="modal-head">
              <h3>Confirm Logout</h3>
              <button className="close" onClick={() => setShowLogoutConfirm(false)} aria-label="Close">✕</button>
            </header>
            <div className="modal-body">
              <p style={{margin:0, color:'#333'}}>Are you sure you want to logout?</p>
              <div className="modal-actions" style={{marginTop:12}}>
                <button className="btn-primary" onClick={handleLogoutConfirmYes}>Yes</button>
                <button className="btn-ghost" onClick={() => setShowLogoutConfirm(false)}>No</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Love Calculator Modal */}
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

      <style jsx global>{`
        /* ====== Milan Connect Page Styles ====== */
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html,body,#__next { height: 100%; }
        body {
          font-family: "Inter", "Segoe UI", Roboto, Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          background: linear-gradient(180deg, #f9a8d4 0%, #f472b6 30%, #a78bfa 100%);
          color: #111827;
          overflow-x: hidden;
        }
        #heartCanvas {
          position: fixed;
          left: 0;
          top: 0;
          z-index: 1;
          pointer-events: none;
        }
        .hamburger {
          position: fixed;
          left: 12px;
          top: 12px;
          z-index: 40;
          background: rgba(255,255,255,0.9);
          border: 0;
          padding: 6px 8px;
          border-radius: 6px;
          box-shadow: 0 6px 18px rgba(16,24,40,0.08);
          cursor: pointer;
        }
        .sidebar {
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          width: 260px;
          padding: 22px 18px;
          background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03));
          backdrop-filter: blur(8px) saturate(120%);
          border-right: 1px solid rgba(255,255,255,0.06);
          z-index: 20;
          color: #fff;
          box-shadow: 8px 0 24px rgba(0,0,0,0.08);
        }
        .sidebar.open { transform: translateX(0); }
        .sidebar-top { text-align: center; margin-bottom: 16px; }
        .profile-pic-wrapper { margin: 0 auto 8px; width: 70px; height: 70px; border-radius: 50%; overflow: hidden; display:flex; align-items:center; justify-content:center; background: linear-gradient(90deg,#ff8ab3,#ff5a9e); box-shadow: 0 6px 18px rgba(0,0,0,0.12);}
        .profile-pic-wrapper img { width:100%; height:100%; object-fit:cover; }
        .username { margin-top: 8px; font-weight: 800; color: #fff; font-size: 16px; text-shadow: 0 2px 8px rgba(0,0,0,0.18); }
        .completeness-mini { margin-top: 6px; }
        .mini-progress { width: 100%; height: 8px; background: rgba(255,255,255,0.08); border-radius: 8px; margin-top: 6px; overflow:hidden;}
        .mini-progress-bar { height:100%; background: linear-gradient(90deg,#ff6b81,#ff3b9b); border-radius:8px; width:40%; }
        .sidebar-list { list-style: none; margin-top: 18px; padding-left: 0; text-align: left; }
        .sidebar-item {
          display:flex;
          align-items:center;
          gap: 10px;
          padding: 12px;
          border-radius: 10px;
          margin-bottom: 10px;
          color: #fff;
          cursor: pointer;
          transition: transform .12s ease, background .12s ease;
          user-select:none;
        }
        .sidebar-item:hover { transform: translateX(6px); background: rgba(255,255,255,0.03); }
        .sidebar-ic { font-size: 18px; }
        .sidebar-txt { font-weight: 700; font-size: 15px; color: #fff; text-shadow: 0 1px 0 rgba(0,0,0,0.12); }
        .content-wrap {
          margin-left: 260px;
          padding: 55px 30px;
          min-height: 100vh;
          z-index: 10;
          position: relative;
        }
        .glass-card {
          max-width: 880px;
          margin: 40px auto;
          background: linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06));
          border-radius: 16px;
          padding: 36px;
          box-shadow: 0 14px 40px rgba(12, 20, 60, 0.12);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(8px) saturate(120%);
        }
        .center-box { text-align: center; color: #fff; padding: 8px 12px; }
        .center-top h2 { font-size: 36px; font-weight: 900; margin-bottom: 6px; letter-spacing: 0.3px; }
        .mode-text { font-size: 14px; margin-top: 6px; opacity: 0.95; }
        .mode-options { display:flex; gap: 18px; justify-content: center; margin-top: 20px; flex-wrap:wrap; }
        .mode-card {
          width: 260px;
          border-radius: 12px;
          padding: 18px;
          background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
          box-shadow: 0 8px 26px rgba(2,6,23,0.12);
          color: #fff;
          text-align: left;
        }
        .mode-card.disabled-card { opacity: 0.7; filter: saturate(0.9); }
        .mode-btn {
          background: #fff;
          color: #d63384;
          border: 0;
          padding: 10px 12px;
          border-radius: 8px;
          font-weight: 800;
          cursor: pointer;
        }
        .mode-btn.disabled { background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); cursor: default; }
        .mode-desc { font-size: 13px; margin-top: 10px; opacity: 0.95; }
        .disabled-note { margin-top: 8px; font-size: 13px; opacity: 0.85; }
        .quote-box {
          margin-top: 18px;
          background: rgba(255,255,255,0.06);
          padding: 12px;
          border-radius: 10px;
          color: #fff;
          font-weight: 700;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
        }
        .loader { margin-top: 18px; }
        .heart-loader { padding: 14px; border-radius: 10px; background: rgba(0,0,0,0.05); color: #fff; display:inline-block; }
        .stop-btn { margin-top:10px; background: rgba(0,0,0,0.06); color: #fff; padding: 8px 12px; border:0; border-radius:8px; cursor:pointer; }
        .profile-overlay {
          position: fixed;
          left: 0; right: 0; top:0; bottom:0;
          background: rgba(6, 5, 17, 0.6);
          display:flex;
          align-items:center;
          justify-content:center;
          z-index: 60;
          padding: 28px;
        }
        .profile-card {
          width: 820px;
          max-width: calc(100% - 48px);
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 18px 60px rgba(2,6,23,0.22);
        }
        .profile-head {
          padding: 18px 20px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          display:flex; align-items:center; justify-content:space-between;
        }
        .profile-head h3 { font-size: 20px; font-weight:800; color:#111; }
        .profile-head .close { background: transparent; border:0; font-size:18px; cursor:pointer; }
        .profile-body { padding: 18px 20px; max-height: 75vh; overflow:auto; }
        .profile-body .row { margin-bottom: 14px; }
        .profile-body label { display:block; font-weight:700; margin-bottom:6px; color:#333; font-size:13px; }
        .profile-body input, .profile-body select, .profile-body textarea {
          width:100%; padding:10px 12px; border-radius:8px; border: 1px solid rgba(16,24,40,0.06); font-size:14px;
          background: #fff;
        }
        .profile-body textarea { min-height: 80px; resize: vertical; }
        .photo-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:6px; }
        .photo-thumb img { height:70px; width:70px; object-fit:cover; border-radius:8px; }
        .photo-add { display:flex; align-items:center; justify-content:center; width:70px; height:70px; border-radius:8px; background: linear-gradient(90deg,#ff8ab3,#ff5a9e); color:#fff; cursor:pointer; font-weight:800; }
        .chips { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
        .chip { background: #f3f4f6; padding:6px 8px; border-radius:14px; display:inline-flex; gap:8px; align-items:center; font-weight:700; }
        .progress-wrap { width:100%; height: 10px; background: #f3f4f6; border-radius: 10px; overflow:hidden; margin-top:6px; }
        .progress-bar { height:100%; background: linear-gradient(90deg,#ff6b81,#ff3b9b); width:40%; }
        .modal-back { position: fixed; inset:0; background: rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index: 60; padding: 18px; }
        .modal-card { background: #fff; border-radius: 10px; width: 520px; max-width: 100%; padding: 14px; box-shadow: 0 10px 40px rgba(2,6,23,0.12); }
        .modal-card.small { width: 360px; }
        .modal-card.love-card { width: 560px; }
        .modal-head { display:flex; align-items:center; justify-content:space-between; padding-bottom:8px; border-bottom:1px solid rgba(0,0,0,0.06); }
        .modal-head h3 { margin:0; }
        .modal-body { padding: 12px 6px; }
        .modal-actions { display:flex; gap:10px; justify-content:flex-end; margin-top:8px; }
        .btn-primary { background: linear-gradient(90deg,#ff6b81,#ff3b9b); color: #fff; padding: 10px 12px; border-radius:8px; border:0; font-weight:800; cursor:pointer; }
        .btn-ghost { background: transparent; border: 1px solid rgba(0,0,0,0.06); padding: 8px 10px; border-radius:8px; cursor:pointer; color:#333; }
        .btn-small { padding:6px 8px; border-radius:8px; border:0; cursor:pointer; }
        .lc-hearts { display:flex; gap:8px; justify-content:center; align-items:flex-end; }
        .lc-heart { animation: pop 1s ease both; position: relative; }
        @keyframes pop { 0%{ transform: translateY(20px) scale(.6); opacity:0 } 60%{ transform: translateY(-8px) scale(1.08); opacity:1 } 100%{ transform: translateY(0) scale(1); opacity:1 } }
        @media (max-width: 900px) {
          .sidebar { width: 72px; padding: 12px; }
          .content-wrap { margin-left: 72px; padding: 22px; }
          .glass-card { padding: 20px; margin-top: 24px; }
          .mode-card { width: 100%; }
        }
        [role="button"] { outline: none; }
        [role="button"]:focus { box-shadow: 0 0 0 4px rgba(99,102,241,0.12); }
        .profile-card .loading { padding: 24px; text-align:center; color:#666; }
      `}</style>
    </>
  );
}

/* Avatar component */
function Avatar() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      const uid = localStorage.getItem("uid");
      const token = localStorage.getItem("token");
      if (!uid || !token) return;

      try {
        const res = await fetch(`/api/profile/${uid}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
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

  if (!profile) return <div style={{color:"#fff"}}>Loading...</div>;

  const first = (profile.name?.trim()?.charAt(0).toUpperCase()) || "M";

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
      aria-label={`avatar ${first}`}
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
