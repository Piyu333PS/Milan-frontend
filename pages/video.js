"use client";
// Coming Soon global flag
const COMING_SOON = true;
import { useEffect, useState } from "react"; 
import io from "socket.io-client";

export default function VideoPage() {
  // START: AUTH GUARD STATE
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // END: AUTH GUARD STATE
  
  // NEW STATE: Custom modal for disconnect confirmation
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  useEffect(() => {
    // START: AUTH GUARD LOGIC
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("token");
    if (!token) {
      // If no token, redirect to homepage (login/register page)
      window.location.href = "/";
      return;
    }
    
    // If token exists, set auth status and proceed with setup
    setIsAuthenticated(true);
    // END: AUTH GUARD LOGIC
    
    // Original setup code starts here, only runs if isAuthenticated is set (implicitly by the useEffect flow)

    const BACKEND_URL = window.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com";
    const ICE_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

    let socket = null;
    let socketConnected = false;
    let pc = null;
    let localStream = null;
    let hasOffered = false;
    let cameraTrackSaved = null;
    let isCleaning = false;

    // timer vars
    let timerInterval = null;
    let timerStartTS = null;
    let elapsedBeforePause = 0;

    // Two-Option / Spin state helpers
    let currentQuestion = null;
    let pendingAnswers = {};
    let twoOptionScore = { total: 0, matched: 0, asked: 0 };

    // NEW: Activity state helpers
    let rapidFireInterval = null;
    let rapidFireCount = 0;
    let mirrorTimer = null;
    let staringTimer = null;
    let lyricsCurrentSong = null;

    // negotiation flags
    let makingOffer = false;
    let ignoreOffer = false;
    let polite = false;

    const pendingCandidates = [];
    let draining = false;

    const get = (id) => document.getElementById(id);
    const showToast = (msg, ms) => {
      var t = get("toast");
      if (!t) return;
      t.textContent = msg;
      t.style.display = "block";
      setTimeout(() => { t.style.display = "none"; }, ms || 2000);
    };
    const showRating = () => { var r = get("ratingOverlay"); if (r) r.style.display = "flex"; };
    const log = (...args) => { try { console.log("[video]", ...args); } catch (e) {} };

    const getRoomCode = () => {
      try {
        var q = new URLSearchParams(window.location.search);
        return q.get("room") || sessionStorage.getItem("roomCode") || localStorage.getItem("lastRoomCode");
      } catch (e) {
        return sessionStorage.getItem("roomCode") || localStorage.getItem("lastRoomCode");
      }
    };

    const safeEmit = (event, data = {}) => {
      try {
        if (!socket || !socket.connected) return log("safeEmit: socket not connected, skip", event);
        const roomCode = getRoomCode();
        const payload = (data && typeof data === "object") ? { ...data } : { data };
        if (roomCode && !payload.roomCode) payload.roomCode = roomCode;
        socket.emit(event, payload);
      } catch (e) { log("safeEmit err", e); }
    };

    const drainPendingCandidates = async () => {
      if (draining) return;
      draining = true;
      try {
        if (!pendingCandidates || pendingCandidates.length === 0) return;
        log("[video] draining", pendingCandidates.length, "pending candidates");
        const copy = pendingCandidates.slice();
        pendingCandidates.length = 0;
        for (const cand of copy) {
          try {
            if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
              log("[video] drain: remoteDescription not ready yet, re-queueing candidate", cand);
              pendingCandidates.push(cand);
              continue;
            }
            await pc.addIceCandidate(new RTCIceCandidate(cand));
            log("[video] drained candidate success");
          } catch (err) {
            console.warn("[video] drained candidate failed", err, cand);
            pendingCandidates.push(cand);
          }
        }
      } catch (err) {
        console.error("[video] drainPendingCandidates unexpected error", err);
      } finally {
        draining = false;
        if (pendingCandidates && pendingCandidates.length > 0) {
          setTimeout(() => { drainPendingCandidates(); }, 250);
        }
      }
    };

    function cleanupPeerConnection() {
      try {
        if (pc) {
          try {
            var senders = pc.getSenders ? pc.getSenders() : [];
            senders.forEach((s) => { try { s.track && s.track.stop && s.track.stop(); } catch (e) {} });
          } catch (e) {}
          try { pc.close && pc.close(); } catch (e) {}
        }
      } catch (e) { log("pc cleanup error", e); }
      pc = null;
      hasOffered = false;
      makingOffer = false;
      ignoreOffer = false;
      try { var rv = get("remoteVideo"); if (rv) rv.srcObject = null; } catch (e) {}
      pendingCandidates.length = 0;
      stopTimer(true);
      // Ensure rating is shown after cleanup
      showRating(); 
    }

    var cleanup = function (opts) {
      opts = opts || {};
      if (isCleaning) return;
      isCleaning = true;
      try {
        if (socket) {
          try { socket.removeAllListeners && socket.removeAllListeners(); } catch (e) {}
          try { socket.disconnect && socket.disconnect(); } catch (e) {}
          socket = null;
        }
      } catch (e) { log("socket cleanup err", e); }

      cleanupPeerConnection(); // This now calls showRating

      try {
        if (localStream) {
          localStream.getTracks().forEach((t) => { try { t.stop(); } catch (e) {} });
        }
      } catch (e) {}

      localStream = null;
      cameraTrackSaved = null;
      setTimeout(() => { isCleaning = false; }, 300);
      // Removed direct redirection logic from general cleanup, except if room not found
      if (opts.goToConnect) window.location.href = "/connect"; 
    };

    // Timer helpers
    function formatTime(ms) {
      const total = Math.floor(ms / 1000);
      const mm = String(Math.floor(total / 60)).padStart(2, '0');
      const ss = String(total % 60).padStart(2, '0');
      return `${mm}:${ss}`;
    }
    function updateTimerDisplay() {
      const el = get('callTimer');
      if (!el) return;
      const now = Date.now();
      const elapsed = (timerStartTS ? (elapsedBeforePause + (now - timerStartTS)) : elapsedBeforePause) || 0;
      el.textContent = formatTime(elapsed);
    }
    function startTimer() {
      try {
        if (timerInterval) return;
        timerStartTS = Date.now();
        updateTimerDisplay();
        timerInterval = setInterval(updateTimerDisplay, 1000);
        log('call timer started');
      } catch (e) { console.warn('startTimer err', e); }
    }
    function stopTimer(preserve = false) {
      try {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        if (timerStartTS) {
          elapsedBeforePause = elapsedBeforePause + (Date.now() - timerStartTS);
        }
        timerStartTS = null;
        if (!preserve) {
          elapsedBeforePause = 0;
          const el = get('callTimer'); if (el) el.textContent = '00:00';
        }
        log('call timer stopped', { preserve });
      } catch (e) { console.warn('stopTimer err', e); }
    }

    (async function start() {
      log("video page start");
      
      // We assume isAuthenticated is true here because of the initial check
      if (!isAuthenticated) return; // Final guard after initial check

      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        var vtracks = (localStream && typeof localStream.getVideoTracks === "function") ? localStream.getVideoTracks() : [];
        cameraTrackSaved = (vtracks && vtracks.length) ? vtracks[0] : null;

        var lv = get("localVideo");
        if (lv) {
          lv.muted = true;
          lv.playsInline = true;
          lv.autoplay = true;
          lv.srcObject = localStream;
          try { await (lv.play && lv.play()); } catch (e) { log("local video play warning", e); }
        } else { log("localVideo element not found"); }
      } catch (err) {
        console.error("Camera/Mic error:", err);
        showToast("Camera/Mic access needed");
        return;
      }

      socket = io(BACKEND_URL, {
        transports: ['polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        path: '/socket.io'
      });

      socket.on("connect", () => {
        log("socket connected", socket.id);
        socketConnected = true;
        const roomCode = getRoomCode();
        if (!roomCode) {
          showToast("Room not found. Redirecting...");
          cleanup({ goToConnect: true });
          return;
        }
        var token = localStorage.getItem("token") || null;
        safeEmit("joinVideo", { token });
      });

      socket.on("disconnect", (reason) => { log("socket disconnected:", reason); socketConnected = false; });
      socket.on("connect_error", (err) => { log("socket connect_error:", err); showToast("Socket connect error"); });

      const createPC = () => {
        if (pc) return;
        log("creating RTCPeerConnection");
        pc = new RTCPeerConnection(ICE_CONFIG);

        // Add local tracks to senders using addTransceiver (for proper enable/disable via senders)
        try { pc.addTransceiver(localStream.getAudioTracks()[0], { direction: "sendrecv" }); } catch (e) { log("addTransceiver audio failed", e); }
        try { pc.addTransceiver(localStream.getVideoTracks()[0], { direction: "sendrecv" }); } catch (e) { log("addTransceiver video failed", e); }

        pc.ontrack = (e) => {
          try {
            log("pc.ontrack", e);
            const rv = get("remoteVideo");
            const stream = (e && e.streams && e.streams[0]) ? e.streams[0] : new MediaStream([e.track]);
            if (rv) {
              rv.playsInline = true;
              rv.autoplay = true;
              const prevMuted = rv.muted;
              rv.muted = true;
              if (rv.srcObject !== stream) {
                rv.srcObject = stream;
                rv.play && rv.play().then(() => {
                  setTimeout(() => { try { rv.muted = prevMuted; } catch (e) {} }, 250);
                }).catch((err) => { log("remote play rejected", err); try { rv.muted = prevMuted; } catch (e) {} });
              } else {
                try { rv.muted = prevMuted; } catch (e) {}
              }
            }
          } catch (err) { console.error("ontrack error", err); }
        };

        pc.onicecandidate = (e) => {
          if (e && e.candidate) {
            log("pc.onicecandidate -> emit candidate");
            safeEmit("candidate", { candidate: e.candidate });
          }
        };

        pc.onconnectionstatechange = () => {
          log("pc.connectionState:", pc.connectionState);
          if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
            showToast("Partner disconnected");
            cleanupPeerConnection(); // Triggers showRating inside
          }
        };

        pc.oniceconnectionstatechange = () => {
          log("pc.iceConnectionState:", pc.iceConnectionState);
          if (pc.iceConnectionState === "connected") {
            log("ICE connected");
            startTimer();
          } else if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed" || pc.iceConnectionState === "closed") {
            stopTimer(true);
          }
        };

        pc.onnegotiationneeded = async () => {
          if (!socketConnected) { log("negotiation: socket not connected"); return; }
          if (makingOffer) { log("negotiationneeded: already makingOffer"); return; }
          try {
            makingOffer = true;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            safeEmit("offer", { type: pc.localDescription && pc.localDescription.type, sdp: pc.localDescription && pc.localDescription.sdp });
            log("negotiationneeded: offer sent");
          } catch (err) {
            log("negotiationneeded error", err);
          } finally { makingOffer = false; }
        };
      };

      // SIGNALING HANDLERS (Omitted for brevity, kept consistent with previous versions)
      socket.on("ready", (data) => {
        log("socket ready", data);
        try { if (data && typeof data.polite !== "undefined") polite = !!data.polite; } catch (e) {}
        createPC();
        (async () => {
          try {
            if (!hasOffered && pc && pc.signalingState === "stable" && !makingOffer) {
              makingOffer = true;
              const off = await pc.createOffer();
              await pc.setLocalDescription(off);
              safeEmit("offer", { type: pc.localDescription && pc.localDescription.type, sdp: pc.localDescription && pc.localDescription.sdp });
              hasOffered = true;
              log("ready: offer emitted");
            } else {
              log("ready: skipped offer", { hasOffered, signalingState: pc ? pc.signalingState : null });
            }
          } catch (e) { log("ready-offer error", e); } finally { makingOffer = false; }
        })();
      });

      socket.on("offer", async (offer) => {
        log("socket offer", offer && offer.type);
        try {
          if (!offer || typeof offer !== "object" || !offer.type || !offer.sdp) {
            log("[video] invalid offer payload - ignoring", offer);
            return;
          }
          if (!pc) createPC();
          const offerDesc = { type: offer.type, sdp: offer.sdp };
          const readyForOffer = !makingOffer && (pc.signalingState === "stable" || pc.signalingState === "have-local-offer");
          ignoreOffer = !readyForOffer && !polite;
          if (ignoreOffer) { log("ignoring offer (not ready & not polite)"); return; }

          if (pc.signalingState !== "stable") {
            try { log("doing rollback to accept incoming offer"); await pc.setLocalDescription({ type: "rollback" }); } catch (e) { log("rollback failed", e); }
          }

          await pc.setRemoteDescription(offerDesc);
          log("[video] remoteDescription set -> draining candidates");
          try { await drainPendingCandidates(); } catch (e) { console.warn("[video] drain after offer failed", e); }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          safeEmit("answer", { type: pc.localDescription && pc.localDescription.type, sdp: pc.localDescription && pc.localDescription.sdp });
          log("answer created & sent");
        } catch (err) { log("handle offer error", err); }
      });

      socket.on("answer", async (answer) => {
        log("socket answer", answer && answer.type);
        try {
          if (!answer || typeof answer !== "object" || !answer.type || !answer.sdp) {
            log("[video] invalid answer payload - ignoring", answer);
            return;
          }
          if (!pc) createPC();
          if (pc.signalingState === "have-local-offer" || pc.signalingState === "have-remote-offer" || pc.signalingState === "stable") {
            await pc.setRemoteDescription({ type: answer.type, sdp: answer.sdp });
            log("answer set as remoteDescription");
            try { await drainPendingCandidates(); } catch (e) { console.warn("[video] drain after answer failed", e); }
          } else {
            log("skipping answer set - wrong state:", pc.signalingState);
          }
        } catch (err) { log("set remote answer failed", err); }
      });

      socket.on("candidate", async (payload) => {
        try {
          log("socket candidate payload:", payload);
          const wrapper = (payload && (payload.candidate !== undefined || payload.sdpMid !== undefined || payload.sdpMLineIndex !== undefined))
                          ? payload
                          : (payload && payload.payload ? payload.payload : payload);

          if (!wrapper) {
            console.warn("[video] candidate: empty payload");
            return;
          }

          let cand = null;

          if (typeof wrapper.candidate === "object" && wrapper.candidate !== null) {
            cand = wrapper.candidate;
          } else if (typeof wrapper.candidate === "string") {
            cand = { candidate: wrapper.candidate };
            if (wrapper.sdpMid) cand.sdpMid = wrapper.sdpMid;
            if (wrapper.sdpMLineIndex !== undefined) cand.sdpMLineIndex = wrapper.sdpMLineIndex;
          } else if (wrapper.candidate === null) {
            console.log("[video] candidate: null (ignored)");
            return;
          } else if (typeof wrapper === "string") {
            cand = { candidate: wrapper };
          } else {
            cand = wrapper;
          }

          if (!cand) {
            console.warn("[video] could not parse candidate payload – skipping", payload);
            return;
          }

          if (!pc) {
            log("[video] no RTCPeerConnection yet, creating one before adding candidate");
            if (typeof createPC === "function") createPC();
            else { console.warn("[video] createPC not found"); }
          }

          if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
            log("[video] remoteDescription not set yet – queueing candidate");
            pendingCandidates.push(cand);
            setTimeout(() => drainPendingCandidates(), 200);
            return;
          }

          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
            log("[video] addIceCandidate success");
          } catch (err) {
            console.warn("[video] addIceCandidate failed", err, cand);
            pendingCandidates.push(cand);
            setTimeout(() => drainPendingCandidates(), 250);
          }
        } catch (err) {
          console.error("[video] candidate handler unexpected error", err);
        }
      });

      socket.on("waitingForPeer", (d) => { log("waitingForPeer", d); showToast("Waiting for partner..."); });
      socket.on("partnerDisconnected", () => { log("partnerDisconnected"); showToast("Partner disconnected"); cleanupPeerConnection(); }); // showRating moved inside cleanupPC
      socket.on("partnerLeft", () => { log("partnerLeft"); showToast("Partner left"); cleanupPeerConnection(); }); // showRating moved inside cleanupPC
      socket.on("errorMessage", (e) => { console.warn("server errorMessage:", e); showToast(e && e.message ? e.message : "Server error"); });

      // ========== ACTIVITIES SIGNALS (Omitted for brevity, kept consistent with previous versions) ==========
      socket.on("twoOptionQuestion", (q) => {
        try {
          log("twoOptionQuestion", q);
          currentQuestion = q;
          pendingAnswers[q.questionId] = { self: null, revealed: false };
          const modal = get("twoOptionModal");
          if (!modal) { log("twoOptionModal missing"); return; }
          modal.querySelector(".q-text").textContent = q.text || "";
          modal.querySelector("#optA").textContent = q.optionA || "A";
          modal.querySelector("#optB").textContent = q.optionB || "B";
          modal.querySelector(".q-counter").textContent = `${q.currentIndex || 1}/${q.totalQuestions || 1}`;
          modal.style.display = "flex";
          var reveal = get("twoOptionReveal");
          if (reveal) reveal.style.display = "none";
        } catch (e) { console.error("twoOptionQuestion handler", e); }
      });

      socket.on("twoOptionReveal", (payload) => {
        try {
          log("twoOptionReveal", payload);
          if (!payload || !payload.questionId) return;
          var modal = get("twoOptionModal");
          if (!modal) return;
          var reveal = get("twoOptionReveal");
          if (reveal) {
            reveal.style.display = "block";
            reveal.querySelector(".you-choice").textContent = payload.answers.you === "A" ? modal.querySelector("#optA").textContent : modal.querySelector("#optB").textContent;
            reveal.querySelector(".other-choice").textContent = payload.answers.partner === "A" ? modal.querySelector("#optA").textContent : modal.querySelector("#optB").textContent;
            var match = payload.answers.you === payload.answers.partner;
            reveal.querySelector(".match-text").textContent = match ? "Match! 💖 +1" : "Different – Opposites attract! ✨";
            if (typeof payload.matched !== "undefined") {
              twoOptionScore.asked = payload.totalAsked || twoOptionScore.asked;
              twoOptionScore.matched = payload.matched;
              twoOptionScore.total = payload.totalAsked || twoOptionScore.asked;
            }
          }
          setTimeout(() => {
            try {
              if (modal) modal.style.display = "none";
            } catch (e) {}
          }, 2200);
        } catch (e) { console.error("twoOptionReveal err", e); }
      });

      socket.on("twoOptionResult", (res) => {
        try {
          log("twoOptionResult", res);
          var rmodal = get("twoOptionResultModal");
          if (!rmodal) return;
          rmodal.querySelector(".final-percent").textContent = `${res.percent || 0}%`;
          rmodal.querySelector(".final-text").textContent = res.text || "Here's your love score!";
          rmodal.style.display = "flex";
          var hearts = rmodal.querySelectorAll(".result-hearts i");
          var fillCount = Math.round(((res.percent || 0) / 100) * hearts.length);
          for (var i = 0; i < hearts.length; i++) hearts[i].classList.toggle("selected", i < fillCount);
        } catch (e) { console.error("twoOptionResult", e); }
      });

      socket.on("spinStarted", ({ spinId, startAt, duration } = {}) => {
        try {
          log("spinStarted", spinId, startAt, duration);
          const overlay = get("spinOverlay");
          const bottle = get("spinBottleImg");
          if (!overlay || !bottle) return;
          const now = Date.now();
          const delay = Math.max(0, (startAt || now) - now);
          overlay.style.display = "flex";
          bottle.style.transition = `transform ${duration}ms cubic-bezier(.17,.67,.83,.67)`;
          bottle.style.transform = `rotate(0deg)`;
          setTimeout(() => {
            const revolutions = 4 + Math.floor(Math.random() * 3);
            const randomOffset = Math.floor(Math.random() * 360);
            const finalDeg = revolutions * 360 + randomOffset;
            setTimeout(() => {
              bottle.style.transform = `rotate(${finalDeg}deg)`;
            }, delay);
          }, 40);
          setTimeout(() => {
            try { overlay.style.display = "none"; } catch (e) {}
          }, delay + (duration || 6000) + 6000);
        } catch (e) { console.error("spinStarted handler", e); }
      });

      socket.on("spinBottleResult", (payload) => {
        try {
          log("spinBottleResult", payload);
          var modal = get("spinModal");
          if (!modal) return;
          modal.querySelector(".spin-status").textContent = payload.prompt || (payload.questionType === "truth" ? "Truth..." : "Dare...");
          var who = payload.isYou ? "You" : (payload.partnerName || "Partner");
          modal.querySelector(".spin-who").textContent = `Bottle pointed to: ${who}`;
          modal.style.display = "flex";
          try { var overlay = get("spinOverlay"); if (overlay) overlay.style.display = "none"; } catch (e) {}
        } catch (e) { console.error("spinBottleResult err", e); }
      });

      socket.on("twoOptionPartnerAnswered", (d) => {
        try {
          var modal = get("twoOptionModal");
          if (!modal) return;
          var waiting = modal.querySelector(".waiting-text");
          if (waiting) waiting.textContent = d.partnerName ? `${d.partnerName} answered` : "Partner answered";
        } catch (e) {}
      });

      socket.on("twoOptionCancel", () => { try { var m = get("twoOptionModal"); if (m) m.style.display = "none"; } catch (e) {} });
      socket.on("spinCancel", () => { try { var sm = get("spinModal"); if (sm) sm.style.display = "none"; } catch (e) {} });

      // 3. RAPID FIRE QUESTIONS
      socket.on("newQuestion", (data) => {
        try {
          log("newQuestion (rapid fire)", data);
          const modal = get("rapidFireModal");
          if (!modal) return;
          rapidFireCount++;
          modal.querySelector(".rf-question").textContent = data.question || "Question...";
          modal.querySelector(".rf-counter").textContent = `${rapidFireCount}/10`;
          if (!modal.style.display || modal.style.display === 'none') {
            modal.querySelector(".rf-timer").textContent = data.timeout || "30";
            modal.style.display = "flex";
            showToast("Rapid Fire Started!");
          }
        } catch (e) { console.error("newQuestion", e); }
      });

      socket.on("questionResult", (data) => {
        try {
          log("questionResult", data);
          const modal = get("rapidFireModal");
          if (modal) modal.style.display = "none";
          rapidFireCount = 0;
          showToast("Rapid Fire completed!");
        } catch (e) { console.error("questionResult", e); }
      });

      // 4. MIRROR CHALLENGE
      socket.on("mirrorChallengeStarted", (data) => {
        try {
          log("mirrorChallengeStarted", data);
          const modal = get("mirrorModal");
          if (!modal) return;
          modal.querySelector(".mirror-role").textContent = "🪞 MIRROR CHALLENGE";
          modal.querySelector(".mirror-instructions").textContent = data.instruction || "Copy each other's moves!";
          modal.querySelector(".mirror-timer").textContent = Math.floor((data.duration || 30000) / 1000);
          modal.style.display = "flex";
          showToast("Mirror Challenge Started!");
          
          if (mirrorTimer) clearInterval(mirrorTimer);
          let remaining = Math.floor((data.duration || 30000) / 1000);
          mirrorTimer = setInterval(() => {
            remaining--;
            const timerEl = modal.querySelector(".mirror-timer");
            if (timerEl) timerEl.textContent = remaining;
            if (remaining <= 0) clearInterval(mirrorTimer);
          }, 1000);
        } catch (e) { console.error("mirrorChallengeStarted", e); }
      });

      socket.on("mirrorPartnerMove", (data) => {
        try {
          log("mirrorPartnerMove", data);
          showToast(`Partner: ${data.move || "moved!"}`);
        } catch (e) { console.error("mirrorPartnerMove", e); }
      });

      socket.on("mirrorChallengeEnd", (data) => {
        try {
          log("mirrorChallengeEnd", data);
          if (mirrorTimer) clearInterval(mirrorTimer);
          const modal = get("mirrorModal");
          if (modal) modal.style.display = "none";
          showToast(data.message || "Mirror Challenge Complete! 🎉");
        } catch (e) { console.error("mirrorChallengeEnd", e); }
      });

      socket.on("mirrorChallengeResult", (data) => {
        try {
          log("mirrorChallengeResult", data);
          if (data.scores && data.scores.length > 0) {
            showToast(`Scores: ${data.scores.map(s => s.score).join(" vs ")}`);
          }
        } catch (e) { console.error("mirrorChallengeResult", e); }
      });

      // 5. STARING CONTEST
      socket.on("staringContestStarted", (data) => {
        try {
          log("staringContestStarted", data);
          const modal = get("staringModal");
          if (!modal) return;
          modal.querySelector(".staring-timer").textContent = "0";
          modal.querySelector(".staring-status").textContent = data.instruction || "Stare into each other's eyes!";
          modal.style.display = "flex";
          showToast("Staring Contest Started! 👀");
          
          if (staringTimer) clearInterval(staringTimer);
          let elapsed = 0;
          staringTimer = setInterval(() => {
            elapsed++;
            const timerEl = modal.querySelector(".staring-timer");
            if (timerEl) timerEl.textContent = elapsed;
          }, 1000);
        } catch (e) { console.error("staringContestStarted", e); }
      });

      socket.on("staringPartnerLaughed", (data) => {
        try {
          log("staringPartnerLaughed", data);
          showToast("Partner laughed! 😂");
        } catch (e) {}
      });

      socket.on("staringContestEnd", (data) => {
        try {
          log("staringContestEnd", data);
          if (staringTimer) clearInterval(staringTimer);
          const modal = get("staringModal");
          if (!modal) return;
          
          let message = "Contest Over!";
          if (data.isWinner) {
            message = data.message || "You won! 🏆";
          } else if (data.winnerId) {
            message = data.message || "Partner won! 😅";
          } else {
            message = data.message || "It's a tie!";
          }
          
          modal.querySelector(".staring-status").textContent = message;
          setTimeout(() => {
            if (modal) modal.style.display = "none";
          }, 3000);
        } catch (e) { console.error("staringContestEnd", e); }
      });

      // 6. FINISH THE LYRICS
      socket.on("lyricsGameStarted", (data) => {
        try {
          log("lyricsGameStarted", data);
          const modal = get("lyricsModal");
          if (!modal) return;
          modal.querySelector(".lyrics-song-hint").textContent = data.instruction || "Complete the Bollywood lyrics!";
          modal.querySelector(".lyrics-line").textContent = "Get ready...";
          modal.querySelector(".lyrics-answer").style.display = "none";
          modal.style.display = "flex";
          showToast("Lyrics Game Started! 🎤");
        } catch (e) { console.error("lyricsGameStarted", e); }
      });

      socket.on("lyricsRound", (data) => {
        try {
          log("lyricsRound", data);
          const modal = get("lyricsModal");
          if (!modal) return;
          lyricsCurrentSong = data;
          modal.querySelector(".lyrics-line").textContent = data.lyric || "Starting line...";
          modal.querySelector(".lyrics-song-hint").textContent = `Song: ${data.song || "Guess it!"} (${data.movie || ""}) - ${data.roundNumber || 1}/${data.totalRounds || 5}`;
          modal.querySelector(".lyrics-answer").style.display = "none";
          if (!modal.style.display || modal.style.display === 'none') {
            modal.style.display = "flex";
          }
        } catch (e) { console.error("lyricsRound", e); }
      });

      socket.on("lyricsRoundResult", (data) => {
        try {
          log("lyricsRoundResult", data);
          const modal = get("lyricsModal");
          if (!modal) return;
          const answerDiv = modal.querySelector(".lyrics-answer");
          answerDiv.textContent = `Answer: "${data.correctAnswer || ""}"`;
          answerDiv.style.display = "block";
          
          if (data.results) {
            setTimeout(() => {
              const scores = data.results.map(r => `${r.isCorrect ? '✅' : '❌'} ${r.score}pts`).join(' | ');
              showToast(scores);
            }, 500);
          }
        } catch (e) { console.error("lyricsRoundResult", e); }
      });

      socket.on("lyricsGameEnd", (data) => {
        try {
          log("lyricsGameEnd", data);
          const modal = get("lyricsModal");
          if (modal) modal.style.display = "none";
          
          let message = data.message || "Lyrics Game Complete!";
          if (data.winner && data.scores) {
            const winnerScore = data.scores.find(s => s.socketId === data.winner);
            if (winnerScore) {
              message += ` 🏆 Winner: ${winnerScore.score}pts`;
            }
          }
          showToast(message);
        } catch (e) { console.error("lyricsGameEnd", e); }
      });

      // 7. DANCE DARE - FIXED
      socket.on("danceDareStarted", (data) => {
        try {
          log("danceDareStarted", data);
          const modal = get("danceModal");
          if (!modal) return;
          modal.querySelector(".dance-song").textContent = data.move || "Random Move";
          modal.querySelector(".dance-genre").textContent = data.instruction || "Show your moves!";
          modal.querySelector(".dance-timer").textContent = Math.floor((data.duration || 15000) / 1000);
          modal.style.display = "flex";
          showToast("Dance Time! 💃");
          
          if (danceInterval) clearInterval(danceInterval);
          let remaining = Math.floor((data.duration || 15000) / 1000);
          const danceInterval = setInterval(() => {
            remaining--;
            const timerEl = modal.querySelector(".dance-timer");
            if (timerEl) timerEl.textContent = remaining;
            if (remaining <= 0) clearInterval(danceInterval);
          }, 1000);
        } catch (e) { console.error("danceDareStarted", e); }
      });

      socket.on("danceDareEnd", (data) => {
        try {
          log("danceDareEnd", data);
          const modal = get("danceModal");
          if (!modal) return;
          modal.querySelector(".dance-genre").textContent = data.message || "Time to rate!";
          showToast("Rate your partner's dance!");
        } catch (e) { console.error("danceDareEnd", e); }
      });

      socket.on("danceDareResult", (data) => {
        try {
          log("danceDareResult", data);
          const modal = get("danceModal");
          if (modal) modal.style.display = "none";
          showToast(`Your Rating: ${data.yourRating || 0}/10 | Partner: ${data.partnerRating || 0}/10 ${data.message || ""}`);
        } catch (e) { console.error("danceDareResult", e); }
      });

// ======== AUTO SYNC FIX FOR FUN ACTIVITIES ========
// When connected, ask server to re-sync any missed start events
socket.on("connect", () => {
  console.log("[FunSync] Socket connected:", socket.id);
  safeEmit("syncActivities", { roomCode: getRoomCode && getRoomCode() });
});

// Confirm receipt of any fun activity start events
socket.on("mirrorChallengeStarted", (data) => {
  showToast("🪞 Mirror Challenge Started: " + (data.instruction || ""));
  console.log("[FunSync] Mirror Challenge Started", data);
});

socket.on("mirrorChallengeEnd", (data) => {
  showToast("✅ Mirror Challenge Ended: " + data.message);
  console.log("[FunSync] Mirror Challenge Ended", data);
});

socket.on("staringContestStarted", (data) => {
  showToast("👁️ Staring Contest Started!");
  console.log("[FunSync] Staring Contest Started", data);
});

socket.on("staringContestEnd", (data) => {
  showToast("👁️‍🗨️ Staring Contest Ended!");
  console.log("[FunSync] Staring Contest Ended", data);
});

socket.on("lyricsGameStarted", (data) => {
  showToast("🎤 Lyrics Game Started!");
  console.log("[FunSync] Lyrics Game Started", data);
});

socket.on("lyricsRound", (data) => {
  showToast("🎶 " + data.lyric);
  console.log("[FunSync] Lyrics Round", data);
});

socket.on("lyricsGameEnd", (data) => {
  showToast("🎵 Lyrics Game Ended!");
  console.log("[FunSync] Lyrics Game Ended", data);
});

socket.on("danceDareStarted", (data) => {
  showToast("💃 Dance Dare Started: " + (data.instruction || ""));
  console.log("[FunSync] Dance Dare Started", data);
});

socket.on("danceDareEnd", (data) => {
  showToast("🕺 Dance Dare Ended!");
  console.log("[FunSync] Dance Dare Ended", data);
});
// ======== END AUTO SYNC FIX ========



      // UI WIRING
      setTimeout(() => {
        // --- MIC BUTTON FIX ---
        var micBtn = get("micBtn");
        if (micBtn) {
          micBtn.onclick = function () {
            // Find the audio sender and track
            const audioSender = pc ? pc.getSenders().find(s => s.track && s.track.kind === "audio") : null;
            const t = audioSender && audioSender.track;

            if (!t) return showToast("Mic track not found in connection.");
            
            t.enabled = !t.enabled; // Toggle the track's enabled state
            micBtn.classList.toggle("inactive", !t.enabled);
            
            var i = micBtn.querySelector("i");
            if (i) i.className = t.enabled ? "fas fa-microphone" : "fas fa-microphone-slash";
            showToast(t.enabled ? "Mic On" : "Mic Off");
          };
        }

        // --- CAMERA BUTTON FIX ---
        var camBtn = get("camBtn");
        if (camBtn) {
          camBtn.onclick = function () {
            // Find the video sender and track
            const videoSender = pc ? pc.getSenders().find(s => s.track && s.track.kind === "video") : null;
            const t = videoSender && videoSender.track;

            if (!t) return showToast("Camera track not found in connection.");
            
            t.enabled = !t.enabled; // Toggle the track's enabled state
            camBtn.classList.toggle("inactive", !t.enabled);
            
            var ii = camBtn.querySelector("i");
            if (ii) ii.className = t.enabled ? "fas fa-video" : "fas fa-video-slash";
            showToast(t.enabled ? "Camera On" : "Camera Off");
          };
        }

        // --- SCREEN SHARE BUTTON (Uses updated sender logic) ---
        var screenBtn = get("screenShareBtn");
        if (screenBtn) {
          screenBtn.onclick = async function () {
            if (!pc) return showToast("No connection");

            const supports = !!(navigator.mediaDevices && (typeof navigator.mediaDevices.getDisplayMedia === 'function' || typeof navigator.getDisplayMedia === 'function'));
            const secure = !!window.isSecureContext;
            const ua = navigator.userAgent || '';
            const inAppBrowser = !!(/(FBAN|FBAV|Instagram|Line|WhatsApp|wv\)|; wv;|WebView)/i.test(ua));
            console.log("[DEBUG] screenShare - supports:", supports, "secureContext:", secure, "inAppBrowser:", inAppBrowser, "UA:", ua);

            if (!supports) {
              showToast("Screen share not implemented in this browser. Open the page in Chrome (not inside WhatsApp/Telegram).");
              return;
            }
            if (!secure) {
              showToast("Screen sharing requires secure connection (HTTPS). Please use secure link.");
              return;
            }
            // Removed inAppBrowser check restriction for testing, but alerted if detected.

            const sender = pc.getSenders ? pc.getSenders().find(s => s && s.track && s.track.kind === "video") : null;
            if (!sender) {
              return showToast("No video sender found to replace.");
            }
            
            if (screenBtn.dataset.sharing === "true") {
              // --- STOP SHARING ---
              try {
                // Stop the current screen track
                sender.track && sender.track.stop && sender.track.stop();
                
                // Replace with original camera track
                var cam = cameraTrackSaved;
                if (!cam || cam.readyState === "ended") {
                  // Reacquire camera if needed
                  const freshStream = await navigator.mediaDevices.getUserMedia({ video: true });
                  cam = freshStream.getVideoTracks()[0];
                  cameraTrackSaved = cam;
                  // Update localStream reference too
                  localStream.getVideoTracks().forEach(t => t.stop());
                  localStream.removeTrack(localStream.getVideoTracks()[0]);
                  localStream.addTrack(cam);
                }
                
                await sender.replaceTrack(cam);
                
                var lv = get("localVideo");
                if (lv) lv.srcObject = localStream; // Show camera on local video
                
                screenBtn.dataset.sharing = 'false';
                screenBtn.classList.remove("active");
                showToast("Screen sharing stopped, camera restored");
              } catch (err) {
                console.warn("Error stopping screen share/restoring camera", err);
                showToast("Could not stop screen share cleanly");
                screenBtn.dataset.sharing = 'false';
                screenBtn.classList.remove("active");
              }
              return;
            }

            // --- START SHARING ---
            try {
              const tryGetDisplayMedia = async () => {
                if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === "function") {
                  return await navigator.mediaDevices.getDisplayMedia({ video: true });
                }
                if (typeof navigator.getDisplayMedia === "function") {
                  return await navigator.getDisplayMedia({ video: true });
                }
                throw new Error("getDisplayMedia not supported");
              };
              
              const displayStream = await tryGetDisplayMedia();
              const screenTrack = displayStream.getVideoTracks()[0];
              
              // Save original camera track if not already saved
              if (!cameraTrackSaved) {
                  cameraTrackSaved = localStream.getVideoTracks()[0];
              }

              // Replace track on the sender
              await sender.replaceTrack(screenTrack);
              
              // Update local display to show shared screen
              var lv = get("localVideo");
              if (lv) lv.srcObject = displayStream;

              screenBtn.dataset.sharing = 'true';
              screenBtn.classList.add("active");
              showToast("Screen sharing active");

              screenTrack.onended = function () {
                  // Auto-restore camera when user stops sharing via browser UI
                  screenBtn.onclick(); 
              };

            } catch (err) {
              log("DisplayMedia error or not supported", err);
              showToast("Screen sharing failed or cancelled.");
            }
          };
        }
        
        // --- END BUTTON LOGIC ---
        var disconnectBtn = get("disconnectBtn");
        if (disconnectBtn) {
          // Show custom confirmation modal instead of disconnecting immediately
          disconnectBtn.onclick = function () {
            setShowDisconnectConfirm(true);
          };
        }
        
        // Removed quitBtn handler, using handleConfirmDisconnect instead
        // Removed newPartnerBtn handler from here, it's used in rating overlay

      }, 800);

      function submitTwoOptionAnswer(choice) {
        try {
          if (!currentQuestion || !currentQuestion.questionId) {
            showToast("No active question");
            return;
          }
          pendingAnswers[currentQuestion.questionId] = pendingAnswers[currentQuestion.questionId] || {};
          pendingAnswers[currentQuestion.questionId].self = choice;
          var modal = get("twoOptionModal");
          if (modal) {
            modal.querySelector(".waiting-text").textContent = "Waiting for partner...";
            modal.querySelector("#optA").classList.add("disabled");
            modal.querySelector("#optB").classList.add("disabled");
          }
          safeEmit("twoOptionAnswer", { questionId: currentQuestion.questionId, choice: choice });
        } catch (e) { console.error("submitTwoOptionAnswer err", e); }
      }

      function adjustBadge() {
        try {
          const wbs = document.querySelectorAll('.watermark-badge');
          if (!wbs || !wbs.length) return;
          const small = window.innerWidth < 420;
          wbs.forEach(w => {
            w.classList.toggle('small', !!small);
          });
        } catch (e) { console.warn("adjustBadge", e); }
      }
      window.addEventListener('resize', adjustBadge);
      setTimeout(adjustBadge, 600);

    })();

    return function () { cleanup(); };
    }, []); // Run only once on mount

  function escapeHtml(s) { return String(s).replace(/[&<>\"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]); }

  // ------------------------------------------
  // NEW FUNCTIONS FOR DISCONNECT MODAL
  // ------------------------------------------
  const handleConfirmDisconnect = () => {
    // 1. Close confirmation modal
    setShowDisconnectConfirm(false);
    
    // 2. Signal disconnection to partner
    try { safeEmit("partnerLeft"); } catch (e) { log("emit partnerLeft err", e); }
    
    // 3. Clean up PC resources and show rating modal (showRating is now inside cleanupPeerConnection)
    cleanupPeerConnection(); 
    
    // Note: Redirection happens via the 'Search New Partner' button on the Rating Overlay.
  };
  
  const handleKeepChatting = () => {
    setShowDisconnectConfirm(false);
  };

  // Check isAuthenticated and show a loading screen if not authenticated yet
  if (!isAuthenticated) {
    return (
        <div style={{ 
            background: '#08060c', 
            minHeight: '100vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#fff',
            fontSize: '24px',
            fontFamily: 'Poppins, sans-serif'
        }}>
            <div className="loading-spinner-heart" style={{marginRight: '10px'}}>💖</div>
            <style jsx global>{`
                .loading-spinner-heart {
                    font-size: 3rem;
                    animation: pulse 1.5s infinite;
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.2); }
                }
            `}</style>
            Checking Authentication...
        </div>
    );
  }


  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" referrerPolicy="no-referrer" />
      <div className="video-stage">
        <div id="callTimer" className="call-timer">00:00</div>
        <div className="video-panes">
          <div className="video-box">
            <div className="watermark-badge" aria-hidden="true"><span>Milan</span><em className="reel-dot"></em></div>
            <video id="remoteVideo" autoPlay playsInline></video>
            <div className="label">Partner</div>
          </div>
          <div className="video-box">
            <div className="watermark-badge" aria-hidden="true"><span>Milan</span><em className="reel-dot"></em></div>
            <video id="localVideo" autoPlay playsInline muted></video>
            <div className="label">You</div>
          </div>
        </div>
      </div>

      <div className="control-bar" role="toolbar" aria-label="Call controls">
        <button id="micBtn" className="control-btn" aria-label="Toggle Mic">
          <i className="fas fa-microphone"></i><span>Mic</span>
        </button>
        <button id="camBtn" className="control-btn" aria-label="Toggle Camera">
          <i className="fas fa-video"></i><span>Camera</span>
        </button>
        <button id="screenShareBtn" className="control-btn" aria-label="Share Screen">
          <i className="fas fa-desktop"></i><span>Share</span>
        </button>
        <button id="activitiesBtn" className="control-btn" aria-label="Open Fun Activities">
          <i className="fas fa-gamepad"></i><span>Activities</span>
        </button>
        <button id="disconnectBtn" className="control-btn danger" aria-label="End Call">
          <i className="fas fa-phone-slash"></i><span>End</span>
        </button>
      </div>

      {/* Disconnect Confirmation Modal - ADDED */}
      {showDisconnectConfirm && (
        <div className="modal-overlay">
          <div className="disconnect-confirm-modal">
            <div className="modal-content">
              <div className="modal-icon">💔</div>
              <h3 className="modal-title">Wait, is this goodbye? 🥺</h3>
              <p className="modal-message">
                Are you sure you want to end this connection? You might miss a spark! 🔥
              </p>
              <div className="modal-actions">
                <button 
                  onClick={handleKeepChatting} 
                  className="btn-keep"
                >
                  Keep Chatting
                </button>
                <button 
                  onClick={handleConfirmDisconnect} 
                  className="btn-end"
                >
                  End Connection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* End Disconnect Confirmation Modal */}

      {/* Activities Modal - BOTTOM SHEET STYLE (Mobile Friendly) */}
      <div id="activitiesModal" className="activities-overlay" style={{display:'none'}}>
        <div className="activities-backdrop"></div>
        <div className="activities-sheet">
          <div className="sheet-handle"></div>
          <div className="sheet-header">
            <h3>🎮 Fun Activities</h3>
            <button id="activitiesClose" className="sheet-close">×</button>
          </div>
          <div className="sheet-content">
            
            <div className="act-item" id="startTwoOption">
              <div className="act-item-icon">❓</div>
              <div className="act-item-content">
                <h4>Two-Option Quiz</h4>
                <p>Quick questions, reveal together!</p>
              </div>
              <i className="fas fa-chevron-right act-item-arrow"></i>
            </div>

            <div className="act-item" id="startSpin">
              <div className="act-item-icon">🎯</div>
              <div className="act-item-content">
                <h4>Truth & Dare</h4>
                <p>Spin bottle, do challenge!</p>
              </div>
              <i className="fas fa-chevron-right act-item-arrow"></i>
            </div>

            <div className="act-item" id="startRapidFire">
              <div className="act-item-icon">⚡</div>
              <div className="act-item-content">
                <h4>Rapid Fire Questions</h4>
                <p>60 seconds of fast questions!</p>
              </div>
              <i className="fas fa-chevron-right act-item-arrow"></i>
            </div>

            <div className="act-item" id="startMirror">
              <div className="act-item-icon">🪞</div>
              <div className="act-item-content">
                <h4>Mirror Challenge</h4>
                <p>Copy each other's moves!</p>
              </div>
              <i className="fas fa-chevron-right act-item-arrow"></i>
            </div>

            <div className="act-item" id="startStaring">
              <div className="act-item-icon">👀</div>
              <div className="act-item-content">
                <h4>Staring Contest</h4>
                <p>Don't blink, don't laugh!</p>
              </div>
              <i className="fas fa-chevron-right act-item-arrow"></i>
            </div>

            <div className="act-item" id="startLyrics">
              <div className="act-item-icon">🎤</div>
              <div className="act-item-content">
                <h4>Finish the Lyrics</h4>
                <p>Complete Bollywood songs!</p>
              </div>
              <i className="fas fa-chevron-right act-item-arrow"></i>
            </div>

            <div className="act-item" id="startDance">
              <div className="act-item-icon">💃</div>
              <div className="act-item-content">
                <h4>Dance Dare</h4>
                <p>15 seconds of dance moves!</p>
              </div>
              <i className="fas fa-chevron-right act-item-arrow"></i>
            </div>

          </div>
        </div>
      </div>

      {/* EXISTING MODALS (Omitted for brevity, kept consistent with previous versions) */}
      <div id="twoOptionModal" className="overlay-modal" style={{display:'none'}}>
        <div className="modal-card small">
          <div className="q-counter" style={{textAlign:'right',opacity:.8}}>1/10</div>
          <div className="q-text" style={{fontSize:20,marginBottom:12}}>Question text</div>
          <div className="options-row">
            <button id="optA" className="opt-btn">Option A</button>
            <button id="optB" className="opt-btn">Option B</button>
          </div>
          <div className="waiting-text" style={{marginTop:12,opacity:.9}}>Choose your answer...</div>
          <div id="twoOptionReveal" className="reveal" style={{display:'none',marginTop:12}}>
            <div><strong>You:</strong> <span className="you-choice"></span></div>
            <div><strong>Partner:</strong> <span className="other-choice"></span></div>
            <div className="match-text" style={{marginTop:8}}></div>
          </div>
        </div>
      </div>

      <div id="twoOptionResultModal" className="overlay-modal" style={{display:'none'}}>
        <div className="modal-card">
          <h2 className="final-percent">0%</h2>
          <p className="final-text">Your love score</p>
          <div className="result-hearts">
            <i className="far fa-heart"></i><i className="far fa-heart"></i><i className="far fa-heart"></i><i className="far fa-heart"></i><i className="far fa-heart"></i>
          </div>
          <div style={{marginTop:14}}>
            <button id="closeTwoRes" className="act-btn">Close</button>
          </div>
        </div>
      </div>

      <div id="spinOverlay" className="overlay-modal" style={{display:'none', alignItems:'center', justifyContent:'center'}}>
        <div className="modal-card">
          <div style={{textAlign:'center'}}>
            <div style={{height:160, width:160, margin:'0 auto', position:'relative'}}>
              <img id="spinBottleImg" src="/bottle.svg" alt="bottle" style={{width:'100%',height:'100%',transformOrigin:'50% 50%'}} />
            </div>
            <div style={{marginTop:12}}>Spinning the bottle...</div>
          </div>
        </div>
      </div>

      <div id="spinModal" className="overlay-modal" style={{display:'none'}}>
        <div className="modal-card">
          <h3 className="spin-who">Bottle pointed to: —</h3>
          <p className="spin-status">Prompt / dare</p>
          <div style={{marginTop:16}}>
            <button id="spinDone" className="act-btn">Done</button>
            <button id="spinSkip" className="act-btn" style={{marginLeft:10}}>Skip</button>
          </div>
        </div>
      </div>

      {/* NEW ACTIVITY MODALS */}
      
      {/* Rapid Fire Modal */}
      <div id="rapidFireModal" className="overlay-modal" style={{display:'none'}}>
        <div className="modal-card">
          <div className="activity-header">
            <h3>⚡ Rapid Fire</h3>
            <div className="rf-timer big-timer">60</div>
          </div>
          <div className="rf-question big-text">Get ready...</div>
          <div className="rf-counter" style={{marginTop:12,opacity:.8}}>0/12</div>
          <div style={{marginTop:16}}>
            <button id="endRapidFire" className="act-btn danger-btn">End Game</button>
          </div>
        </div>
      </div>

      {/* Mirror Challenge Modal */}
      <div id="mirrorModal" className="overlay-modal" style={{display:'none'}}>
        <div className="modal-card">
          <div className="activity-header">
            <h3>🪞 Mirror Challenge</h3>
            <div className="mirror-timer big-timer">60</div>
          </div>
          <div className="mirror-role big-text">🪞 LEADER</div>
          <p className="mirror-instructions">Do funny actions! Your partner will copy you.</p>
          <div style={{marginTop:16}}>
            <button id="endMirror" className="act-btn danger-btn">End Challenge</button>
          </div>
        </div>
      </div>

      {/* Staring Contest Modal */}
      <div id="staringModal" className="overlay-modal" style={{display:'none'}}>
        <div className="modal-card">
          <div className="activity-header">
            <h3>👀 Staring Contest</h3>
            <div className="staring-timer big-timer">0</div>
          </div>
          <div className="staring-status big-text">Stare into each other's eyes!</div>
          <div style={{marginTop:16,display:'flex',gap:12,justifyContent:'center'}}>
            <button id="iBlinked" className="act-btn danger-btn">I Blinked 😭</button>
            <button id="endStaring" className="act-btn">End Contest</button>
          </div>
        </div>
      </div>

      {/* Finish the Lyrics Modal */}
      <div id="lyricsModal" className="overlay-modal" style={{display:'none'}}>
        <div className="modal-card">
          <div className="activity-header">
            <h3>🎤 Finish the Lyrics</h3>
          </div>
          <div className="lyrics-song-hint" style={{opacity:.8,marginBottom:12}}>Song: Guess it!</div>
          <div className="lyrics-line big-text">"Starting line..."</div>
          <div className="lyrics-answer" style={{display:'none',marginTop:12,padding:12,background:'rgba(255,255,255,0.05)',borderRadius:8}}>
            Answer: "..."
          </div>
          <div style={{marginTop:16,display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
            <button id="showLyricsAnswer" className="act-btn">Show Answer</button>
            <button id="nextLyrics" className="act-btn">Next Song</button>
            <button id="endLyrics" className="act-btn danger-btn">End Game</button>
          </div>
        </div>
      </div>

      {/* Dance Dare Modal */}
      <div id="danceModal" className="overlay-modal" style={{display:'none'}}>
        <div className="modal-card">
          <div className="activity-header">
            <h3>💃 Dance Dare</h3>
            <div className="dance-timer big-timer">15</div>
          </div>
          <div className="dance-song big-text">Random Song</div>
          <div className="dance-genre" style={{opacity:.8}}>Party</div>
          <div style={{marginTop:16}}>
            <button id="skipDance" className="act-btn">Skip This Dance</button>
          </div>
        </div>
      </div>

      {/* Rating Overlay */}
      <div id="ratingOverlay">
        <div className="rating-content">
          <h2>Rate your partner ❤️</h2>
          <div className="hearts">
            <i className="far fa-heart" data-value="1" aria-label="1 star"></i>
            <i className="far fa-heart" data-value="2" aria-label="2 stars"></i>
            <i className="far fa-heart" data-value="3" aria-label="3 stars"></i>
            <i className="far fa-heart" data-value="4" aria-label="4 stars"></i>
            <i className="far fa-heart" data-value="5" aria-label="5 stars"></i>
          </div>
          <div className="rating-buttons">
            {/* Quit button removed, New Partner is the new target */}
            <button id="newPartnerBtn" onClick={() => window.location.href = "/connect"}>Search New Partner</button>
          </div>
          <div className="emoji-container" aria-hidden="true"></div>
        </div>
      </div>

      <div id="toast"></div>

      <style jsx global>{`
        /* Custom Disconnect Confirmation Modal Styles */
        .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(12px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100000;
            animation: fadeIn 0.3s ease;
            padding: 20px;
        }

        .disconnect-confirm-modal {
            background: linear-gradient(145deg, rgba(255, 110, 167, 0.25), rgba(139, 92, 246, 0.2));
            border: 2px solid rgba(255, 110, 167, 0.5);
            border-radius: 28px;
            padding: 2.5rem 2rem;
            max-width: 420px;
            width: 100%;
            text-align: center;
            box-shadow: 0 25px 70px rgba(255, 79, 160, 0.4), 0 0 120px rgba(255, 20, 147, 0.25);
            animation: slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
            position: relative;
            overflow: hidden;
            color: #ffffff;
        }
        
        .modal-icon {
            font-size: 3.5rem;
            margin-bottom: 1rem;
            animation: heartBounce 1.2s ease-in-out infinite;
        }
        
        .modal-title {
            font-size: 1.6rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            color: #ffd7e0;
        }

        .modal-message {
            font-size: 1rem;
            opacity: 0.9;
            margin-bottom: 1.5rem;
        }

        .modal-actions {
            display: flex;
            gap: 1rem;
            justify-content: center;
        }

        .btn-keep, .btn-end {
            flex: 1;
            padding: 1rem 1.2rem;
            border-radius: 50px;
            border: none;
            font-size: 1rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .btn-keep {
            background: linear-gradient(135deg, #4cd964, #34c759);
            color: white;
            box-shadow: 0 5px 20px rgba(76, 217, 100, 0.5);
        }
        .btn-end {
            background: linear-gradient(135deg, #ff4fa0, #ff1493);
            color: white;
            box-shadow: 0 5px 20px rgba(255, 79, 160, 0.5);
        }
        .btn-keep:hover, .btn-end:hover {
            transform: translateY(-2px);
        }

        @keyframes heartBounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes slideUp {
          from { transform: translateY(50px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        /* End Custom Disconnect Confirmation Modal Styles */


        *{margin:0;padding:0;box-sizing:border-box}
        html,body{height:100%;background:#000;font-family:'Segoe UI',sans-serif;overflow:hidden}
        .video-stage{position:relative;width:100%;height:100vh;padding-bottom:calc(110px + env(safe-area-inset-bottom));background:linear-gradient(180deg,#0b0b0f 0%, #0f0610 100%);}
        .call-timer{position:absolute;left:50%;top:12px;transform:translateX(-50%);z-index:3500;background:linear-gradient(90deg,#ff7aa3,#ffb26a);padding:6px 14px;border-radius:999px;color:#fff;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.6);backdrop-filter: blur(6px);font-size:14px}
        .video-panes{position:absolute;left:0;right:0;top:0;bottom:calc(110px + env(safe-area-inset-bottom));display:flex;gap:12px;padding:12px;}
        .video-box{position:relative;flex:1 1 50%;border-radius:14px;overflow:hidden;background:linear-gradient(180deg,#08080a,#111);border:1px solid rgba(255,255,255,.04);min-height:120px;box-shadow:0 12px 40px rgba(0,0,0,.6)}
        .video-box video{width:100%;height:100%;object-fit:cover;background:#000;display:block; filter: contrast(1.05) saturate(1.05); -webkit-filter: contrast(1.05) saturate(1.05);}
        .video-box::after{content:"";position:absolute; inset:0;pointer-events:none;box-shadow: inset 0 80px 120px rgba(0,0,0,0.25);border-radius: inherit;z-index:16;}
        #localVideo{ transform: scaleX(-1); }
        .label{position:absolute;left:10px;bottom:10px;padding:6px 10px;font-size:12px;color:#fff;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.05);border-radius:10px;pointer-events:none}
        .control-bar{position:fixed;bottom:calc(18px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);display:flex;gap:12px;padding:8px 10px;background:linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));border-radius:16px;z-index:3000;backdrop-filter: blur(8px);max-width:calc(100% - 24px);overflow-x:auto;align-items:center;box-shadow:0 12px 30px rgba(0,0,0,.6)}
        .control-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(255,255,255,0.03);color:#fff;border-radius:14px;width:64px;height:64px;cursor:pointer;flex:0 0 auto;border:1px solid rgba(255,255,255,0.03);transition:transform .12s ease, box-shadow .12s ease}
        .control-btn:hover{ transform: translateY(-4px); box-shadow:0 10px 22px rgba(0,0,0,0.45)}
        .control-btn span{font-size:12px;margin-top:6px}
        .control-btn.inactive{opacity:0.5}.control-btn.active{box-shadow:0 6px 18px rgba(255,77,141,0.18);transform:translateY(-2px)}.control-btn.danger{background:linear-gradient(135deg,#ff4d8d,#b51751);border:none}
        #ratingOverlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.9);color:#fff;z-index:4000;padding:20px}
        .rating-content{position:relative;min-width: min(720px, 92vw);max-width:920px;max-height:80vh;padding:28px 36px;border-radius:20px;text-align:center;background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));border:1px solid rgba(255,255,255,.03);box-shadow:0 20px 60px rgba(0,0,0,.6);z-index:1;overflow:auto}
        .rating-content h2{ font-size:28px;margin-bottom:14px;letter-spacing:.3px }
        .hearts{ display:flex;gap:18px;font-size:56px;margin:22px 0 8px 0;justify-content:center;z-index:2;position:relative }
        .hearts i{ color:#777;cursor:pointer;transition:transform .18s,color .18s }
        .hearts i:hover{ transform:scale(1.12);color:#ff6fa3 }
        .hearts i.selected{ color:#ff1744 }
        .rating-buttons{ display:flex;gap:18px;margin-top:24px;justify-content:center;position:relative;z-index:2;flex-wrap:wrap }
        .rating-buttons button{ padding:14px 24px;font-size:18px;border-radius:14px;border:none;color:#fff;cursor:pointer;background:linear-gradient(135deg,#ff4d8d,#6a5acd);box-shadow:0 10px 28px rgba(0,0,0,.45);backdrop-filter: blur(14px);transition:transform .2s ease,opacity .2s ease }
        .rating-buttons button:hover{ transform: translateY(-4px); box-shadow:0 10px 22px rgba(0,0,0,0.45)}
        .rating-buttons button:active{ transform: translateY(-1px); box-shadow:0 6px 18px rgba(0,0,0,0.45)}
        #toast{position:fixed;left:50%;bottom:calc(110px + env(safe-area-inset-bottom));transform:translateX(-50%);background:#111;color:#fff;padding:10px 14px;border-radius:8px;display:none;z-index:5000;border:1px solid rgba(255,255,255,.08)}

        .watermark-badge{position:absolute;right:14px;bottom:14px;z-index:40;display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:26px;background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));color: rgba(255,255,255,0.94);font-weight:800;letter-spacing:1px;font-size:14px;transform: rotate(-12deg);box-shadow: 0 8px 30px rgba(0,0,0,0.6);backdrop-filter: blur(6px) saturate(1.1);-webkit-backdrop-filter: blur(6px) saturate(1.1);transition: transform .18s ease, opacity .18s ease;opacity: 0.95;pointer-events: none;}
        .watermark-badge.small{ font-size:12px; padding:6px 10px; right:10px; bottom:10px; transform: rotate(-10deg) scale(0.92); }
        .watermark-badge span{ display:inline-block; transform: translateY(-1px); }
        .watermark-badge .reel-dot{display:inline-block;width:10px;height:10px;border-radius:50%;background: linear-gradient(45deg,#ff6b8a,#ffd166);box-shadow:0 6px 14px rgba(255,107,138,0.14), inset 0 -2px 6px rgba(0,0,0,0.15);transform: translateY(0) rotate(0);}
        .video-box:hover .watermark-badge{ transform: translateX(-4px) rotate(-10deg); opacity:1; }
        @keyframes badge-breath { 0%{ transform: rotate(-12deg) scale(0.995) } 50%{ transform: rotate(-12deg) scale(1.01) } 100%{ transform: rotate(-12deg) scale(0.995) } }
        .watermark-badge{ animation: badge-breath 4.5s ease-in-out infinite; }

        .overlay-modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.75);z-index:4500;backdrop-filter:blur(4px)}
        .modal-card{background:linear-gradient(180deg, rgba(20,20,25,0.98), rgba(15,15,20,0.98));padding:24px;border-radius:16px;min-width:320px;max-width:90vw;color:#fff;border:1px solid rgba(255,255,255,.08);box-shadow:0 20px 60px rgba(0,0,0,.8);position:relative;max-height:80vh;overflow-y:auto}
        .modal-card.small{min-width: min(520px, 92vw)}
        .modal-card.wide{min-width: min(800px, 92vw);max-width:95vw}
        .modal-close{position:absolute;right:12px;top:12px;background:rgba(255,255,255,0.05);border:none;color:#fff;font-size:24px;cursor:pointer;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;transition:background .2s}
        .modal-close:hover{background:rgba(255,255,255,0.1)}

        /* Bottom Sheet Activities Modal */
        .activities-overlay{position:fixed;inset:0;z-index:4500;display:none}
        .activities-backdrop{position:absolute;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)}
        .activities-sheet{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(180deg, rgba(20,20,25,0.98), rgba(15,15,20,0.98));border-radius:24px 24px 0 0;max-height:85vh;transform:translateY(100%);transition:transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);border:1px solid rgba(255,255,255,0.1);border-bottom:none;box-shadow:0 -10px 60px rgba(0,0,0,0.8)}
        .activities-sheet.show{transform:translateY(0)}
        .sheet-handle{width:40px;height:4px;background:rgba(255,255,255,0.3);border-radius:2px;margin:12px auto 0 auto}
        .sheet-header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.08);position:sticky;top:0;background:linear-gradient(180deg, rgba(20,20,25,0.98), rgba(15,15,20,0.95));z-index:10;backdrop-filter:blur(8px)}
        .sheet-header h3{color:#fff;font-size:20px;margin:0}
        .sheet-close{background:rgba(255,255,255,0.08);border:none;color:#fff;font-size:28px;cursor:pointer;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:background .2s;line-height:1}
        .sheet-close:hover{background:rgba(255,255,255,0.15)}
        .sheet-content{padding:8px 0 calc(20px + env(safe-area-inset-bottom));max-height:calc(85vh - 70px);overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch}
        
        .act-item{display:flex;align-items:center;gap:14px;padding:16px 20px;cursor:pointer;transition:background .2s;border-bottom:1px solid rgba(255,255,255,0.04)}
        .act-item:hover{background:rgba(255,255,255,0.05)}
        .act-item:active{background:rgba(255,255,255,0.08)}
        .act-item-icon{font-size:32px;flex-shrink:0;width:50px;height:50px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);border-radius:12px}
        .act-item-content{flex:1}
        .act-item-content h4{color:#fff;font-size:16px;margin:0 0 4px 0;font-weight:600}
        .act-item-content p{color:rgba(255,255,255,0.7);font-size:13px;margin:0;line-height:1.4}
        .act-item-arrow{color:rgba(255,255,255,0.3);font-size:16px;flex-shrink:0}

        .act-btn{padding:10px 16px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff4d8d,#ff6fa3);color:#fff;cursor:pointer;font-size:14px;font-weight:600;transition:transform .2s,opacity .2s;width:100%}
        .act-btn:hover{transform:scale(1.02);opacity:.9}
        .act-btn.danger-btn{background:linear-gradient(135deg,#ff4d4d,#cc0000)}

        .options-row{display:flex;gap:12px}
        .opt-btn{flex:1;padding:14px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:#fff;font-size:16px;cursor:pointer;transition:background .2s}
        .opt-btn:hover{background:rgba(255,255,255,0.12)}
        .opt-btn.disabled{opacity:.4;pointer-events:none}
        .reveal{background:rgba(255,255,255,0.05);padding:12px;border-radius:10px;margin-top:8px;border:1px solid rgba(255,255,255,0.08)}
        .result-hearts i{font-size:36px;margin:6px;color:#444}
        .result-hearts i.selected{color:#ff1744}
        #spinBottleImg{ display:block; transform-origin:50% 50%; will-change:transform; }

        .activity-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08)}
        .big-timer{font-size:32px;font-weight:700;color:#ff6fa3;min-width:60px;text-align:right}
        .big-text{font-size:22px;font-weight:600;margin:12px 0;line-height:1.4}

        @media(max-width: 900px){
          .video-panes{ flex-direction:column; }
          .video-box{ flex:1 1 50%; min-height: 180px; }
          .rating-content{ padding:20px; min-width: 88vw }
          .hearts{ font-size:44px; gap:14px }
          .rating-buttons button{ font-size:16px; padding:12px 18px }
          .call-timer{ top:8px; font-size:13px; padding:6px 12px }
          .control-btn{ width:64px; height:64px }
          .control-bar{ gap:10px; padding:8px }
          .activities-sheet{max-height:90vh}
          .sheet-content{max-height:calc(90vh - 70px)}
        }

        @media(max-width: 600px){
          .big-text{font-size:18px}
          .big-timer{font-size:28px}
          .act-item{padding:14px 16px}
          .act-item-icon{font-size:28px;width:46px;height:46px}
          .act-item-content h4{font-size:15px}
          .act-item-content p{font-size:12px}
        }

        @media(max-width: 480px){
          .video-box{ border-radius:10px }
          .video-panes{ padding:8px }
          .control-bar{ left:8px; right:8px; transform:none; margin:0 auto; justify-content:center }
          .control-bar{ bottom:calc(10px + env(safe-area-inset-bottom)); }
          .control-btn span{ display:none }
          .control-btn{ width:56px; height:56px }
          .rating-content{ padding:18px; min-width:86vw }
          .hearts{ font-size:36px }
          .call-timer{ font-size:12px; padding:6px 10px }
          .modal-card{padding:18px;min-width:90vw}
          .act-item{padding:12px 14px}
          .act-item-icon{font-size:26px;width:44px;height:44px}
          .sheet-header{padding:14px 16px}
          .sheet-header h3{font-size:18px}
          .disconnect-confirm-modal { padding: 2rem 1.5rem; max-width: 340px; }
          .modal-actions { flex-direction: column; }
          .btn-keep, .btn-end { padding: 0.8rem; }
        }

        .floating-emoji{position:absolute;font-size:32px;animation:float-up 1.4s ease-out forwards;pointer-events:none}
        @keyframes float-up{0%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-150%) scale(1.5)}}
      `}</style>
    </>
  );
}


// === COMING SOON OVERRIDE ===
if (typeof document !== 'undefined') {
  const actIds = [
    "startTwoOption","startSpin","startRapidFire","startMirror","startStaring","startLyrics","startDance"
  ];
  actIds.forEach(id=>{
    const el=document.getElementById(id);
    if(el){el.onclick=(e)=>{e.preventDefault();alert("Coming Soon 🔒");};}
  });
}
// === END COMING SOON ===
