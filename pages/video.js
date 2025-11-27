"use client";
// Coming Soon global flag
const COMING_SOON = true;
import { useEffect, useState } from "react"; 
import io from "socket.io-client";

export default function VideoPage() {
  // START: AUTH GUARD STATE
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // END: AUTH GUARD STATE

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

    // START: IMPROVED DRAIN CANDIDATE LOGIC
    const drainPendingCandidates = async () => {
      if (draining) return;
      draining = true;
      try {
        if (!pendingCandidates || pendingCandidates.length === 0) return;
        
        // Ensure remoteDescription is set before draining. Drain only when PC is ready.
        if (!pc || !pc.remoteDescription || (pc.remoteDescription.type !== 'offer' && pc.remoteDescription.type !== 'answer')) {
            log("[video] drain: PC not ready, delaying candidates.", pendingCandidates.length);
            draining = false;
            setTimeout(() => drainPendingCandidates(), 500); // Re-attempt later
            return;
        }

        log("[video] draining", pendingCandidates.length, "pending candidates");
        const copy = pendingCandidates.slice();
        pendingCandidates.length = 0;
        
        for (const cand of copy) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
            log("[video] drained candidate success");
          } catch (err) {
            // If addIceCandidate fails due to transient error, re-queue (but log is crucial)
            if (err.name === 'OperationError' || err.name === 'InvalidStateError') {
              console.warn("[video] drained candidate failed (re-queueing)", err, cand);
              pendingCandidates.push(cand);
            } else {
              console.error("[video] drained candidate failed (dropping)", err, cand);
            }
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
    // END: IMPROVED DRAIN CANDIDATE LOGIC

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

      cleanupPeerConnection();

      try {
        if (localStream) {
          localStream.getTracks().forEach((t) => { try { t.stop(); } catch (e) {} });
        }
      } catch (e) {}

      localStream = null;
      cameraTrackSaved = null;
      setTimeout(() => { isCleaning = false; }, 300);
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

        try { if (typeof pc.addTransceiver === "function") { pc.addTransceiver("audio", { direction: "sendrecv" }); pc.addTransceiver("video", { direction: "sendrecv" }); } } catch (e) { log("addTransceiver failed", e); }

        try {
          const localVideoTrack = localStream && localStream.getVideoTracks ? localStream.getVideoTracks()[0] : null;
          const localAudioTrack = localStream && localStream.getAudioTracks ? localStream.getAudioTracks()[0] : null;

          const videoSender = pc.getSenders ? pc.getSenders().find(s => s.track && s.track.kind === "video") : null;
          const audioSender = pc.getSenders ? pc.getSenders().find(s => s.track && s.track.kind === "audio") : null;

          if (localVideoTrack) {
            if (videoSender && typeof videoSender.replaceTrack === "function") {
              try { videoSender.replaceTrack(localVideoTrack); } catch (e) { log("replace video failed", e); }
            } else {
              try { pc.addTrack(localVideoTrack, localStream); } catch (e) { log("addTrack video failed", e); }
            }
          }
          if (localAudioTrack) {
            if (audioSender && typeof audioSender.replaceTrack === "function") {
              try { audioSender.replaceTrack(localAudioTrack); } catch (e) { log("replace audio failed", e); }
            } else {
              try { pc.addTrack(localAudioTrack, localStream); } catch (e) { log("addTrack audio failed", e); }
            }
          }
        } catch (e) { log("attach local tracks error", e); }

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
            showRating();
            cleanupPeerConnection();
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

      // SIGNALING HANDLERS
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
      socket.on("partnerDisconnected", () => { log("partnerDisconnected"); showToast("Partner disconnected"); showRating(); cleanupPeerConnection(); });
      socket.on("partnerLeft", () => { log("partnerLeft"); showToast("Partner left"); showRating(); cleanupPeerConnection(); });
      socket.on("errorMessage", (e) => { console.warn("server errorMessage:", e); showToast(e && e.message ? e.message : "Server error"); });

      // ========== EXISTING ACTIVITIES SIGNALS ==========
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

      // ========== NEW ACTIVITIES SIGNALS - FIXED ==========

      // 3. RAPID FIRE QUESTIONS (Uses existing startQuestionGame backend)
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

      // 4. MIRROR CHALLENGE - FIXED
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
          
          // Start countdown
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

      // 5. STARING CONTEST - FIXED
      socket.on("staringContestStarted", (data) => {
        try {
          log("staringContestStarted", data);
          const modal = get("staringModal");
          if (!modal) return;
          modal.querySelector(".staring-timer").textContent = "0";
          modal.querySelector(".staring-status").textContent = data.instruction || "Stare into each other's eyes!";
          modal.style.display = "flex";
          showToast("Staring Contest Started! 👀");
          
          // Start timer
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

      // 6. FINISH THE LYRICS - FIXED
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

      socket.on("lyricsPartnerAnswered", (data) => {
        try {
          log("lyricsPartnerAnswered", data);
          showToast("Partner answered!");
        } catch (e) {}
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
          
          // Start countdown
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
  // Ensure we are not calling getRoomCode outside its context if it relies on URL or session,
  // but here we are calling safeEmit which handles the roomCode lookup inside its body.
  safeEmit("syncActivities", { roomCode: sessionStorage.getItem("roomCode") || localStorage.getItem("lastRoomCode") });
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
    
    // UI WIRING (Not directly relevant to the current bug, kept for completeness)
    // ... (Your existing UI WIRING code)
  
    return () => cleanup(); // Cleanup function for useEffect

  }, [isAuthenticated]); // Dependency array for the main useEffect

  // 5. AI CONNECTION FUNCTION (Same as before)
  function connectToAI(type) {
    sessionStorage.setItem("connectingToAI", "true");
    sessionStorage.setItem("aiChatType", type);
    
    const userGender = localStorage.getItem("gender") || "male";
    const userName = profile.name || localStorage.getItem("registered_name") || "Friend";
    
    const aiPartner = {
      isAI: true,
      name: userGender === "male" ? "Priya" : "Rahul",
      gender: userGender === "male" ? "female" : "male",
      age: "25",
      city: "Virtual",
      bio: "Hey! I'm your AI companion. Let's chat! 😊"
    };
    
    sessionStorage.setItem("partnerData", JSON.stringify(aiPartner));
    sessionStorage.setItem("roomCode", "AI_" + Date.now());
    
    setStatusMessage("💖 AI Partner Connected!");
    
    setTimeout(() => {
      window.location.href = type === "video" ? "/video" : "/chat";
    }, 500);
  }

  // 6. START SEARCH FUNCTION (Core Logic)
  function startSearch(type) {
    if (isSearching || connectingRef.current) return;
    connectingRef.current = true;
    searchTypeRef.current = type;
    setIsSearching(true);
    setShowLoader(true);
    setStatusMessage(
      type === "video"
        ? "🎥 Finding your video chat soulmate..."
        : "💬 Searching for a human partner..."
    );

    // Clear any existing timers
    if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
    }
    if (extendedTimerRef.current) {
        clearTimeout(extendedTimerRef.current);
        extendedTimerRef.current = null;
    }

    if (type === "video") {
        // Video Chat: Set a timeout to update the message after 20s (Extended Message)
        extendedTimerRef.current = setTimeout(() => {
            console.log("20 seconds elapsed - showing extended video message");
            setStatusMessage("Sit tight! Cupid is checking every corner of Milan for your perfect match! 🏹💖");
        }, VIDEO_EXTENDED_TIMEOUT);

        // Set a timer for the initial video chat message update (12s)
        searchTimerRef.current = setTimeout(() => {
            console.log(`${HUMAN_SEARCH_TIMEOUT / 1000} seconds elapsed - initial video check`);
            // VIDEO CHAT: Update status message after initial 12 seconds but keep searching.
            setStatusMessage("Hold on, real partners are taking a moment to connect. Searching continues... ⏳");
        }, HUMAN_SEARCH_TIMEOUT);

    } else {
        // TEXT CHAT: Set a single timer for AI fallback (12s)
        searchTimerRef.current = setTimeout(() => {
            console.log("12 seconds elapsed - text chat AI fallback");
            // TEXT CHAT: Fallback to AI
            setStatusMessage("💔 No human partner found. Connecting you with AI...");
            
            if (socketRef.current && socketRef.current.connected) {
                try {
                    // Explicitly disconnect search socket before connecting to AI
                    socketRef.current.emit("stopLookingForPartner");
                    socketRef.current.disconnect();
                } catch {}
            }
            
            setTimeout(() => {
                connectToAI(type);
            }, 1000);
        }, HUMAN_SEARCH_TIMEOUT);
    }

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
          if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
            searchTimerRef.current = null;
          }
          if (extendedTimerRef.current) {
            clearTimeout(extendedTimerRef.current);
            extendedTimerRef.current = null;
          }

          const roomCode = data && data.roomCode ? data.roomCode : "";
          partnerRef.current = data && data.partner ? data.partner : {};
          if (!roomCode) {
            setTimeout(() => stopSearch(), 800);
            return;
          }
          
          partnerRef.current.isAI = false;
          
          sessionStorage.setItem(
            "partnerData",
            JSON.stringify(partnerRef.current)
          );
          sessionStorage.setItem("roomCode", roomCode);
          localStorage.setItem("lastRoomCode", roomCode);
          setStatusMessage("💖 Human Partner Found!");
          setTimeout(() => {
            window.location.href = type === "video" ? "/video" : "/chat";
          }, 120);
        } catch {
          setTimeout(() => stopSearch(), 500);
        }
      });

      socketRef.current.on("partnerDisconnected", () => {
        if (searchTimerRef.current) {
          clearTimeout(searchTimerRef.current);
          searchTimerRef.current = null;
        }
        if (extendedTimerRef.current) {
            clearTimeout(extendedTimerRef.current);
            extendedTimerRef.current = null;
        }
        alert("Partner disconnected.");
        stopSearch();
      });

      socketRef.current.on("connect_error", () => {
        if (searchTimerRef.current) {
          clearTimeout(searchTimerRef.current);
          searchTimerRef.current = null;
        }
        if (extendedTimerRef.current) {
            clearTimeout(extendedTimerRef.current);
            extendedTimerRef.current = null;
        }
        alert("Connection error. Please try again.");
        stopSearch();
      });
    } catch {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
      if (extendedTimerRef.current) {
        clearTimeout(extendedTimerRef.current);
        extendedTimerRef.current = null;
      }
      alert("Something went wrong starting the search.");
      stopSearch();
    } finally {
      setTimeout(() => {
        connectingRef.current = false;
      }, 300);
    }
  }

  function stopSearch(shouldDisconnect = true) {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    if (extendedTimerRef.current) {
      clearTimeout(extendedTimerRef.current);
      extendedTimerRef.current = null;
    }

    if (shouldDisconnect && socketRef.current) {
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

  // 7. LOGOUT FUNCTIONS
  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}

    window.location.href = "/";
  };

  const handleStayLoggedIn = () => {
    setShowLogoutModal(false);
  };


  const handleProfileClick = () => {
    window.location.href = "/profile";
  };

  // If user is not authenticated yet, return null or a simple loader to prevent UI flicker
  if (!isAuthenticated) {
    return (
        <div style={{ 
            background: '#08060c', 
            minHeight: '100vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#fff',
            fontSize: '24px'
        }}>
            Loading Milan... ❤️
        </div>
    );
  }

  return (
    <>
      <Head>
        <title>Milan – Connect</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
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

      {/* Full Screen Welcome Popup */}
      {showWelcome && (
        <div className="welcome-fullscreen">
          <div className="welcome-content-wrapper">
            <div className="floating-hearts">
              <div className="float-heart heart-1">💕</div>
              <div className="float-heart heart-2">💖</div>
              <div className="float-heart heart-3">💗</div>
              <div className="float-heart heart-4">💓</div>
              <div className="float-heart heart-5">💘</div>
              <div className="float-heart heart-6">💞</div>
            </div>

            <div className="welcome-box">
              <div className="sparkles-top">
                <span className="sparkle">✨</span>
                <span className="sparkle big">💕</span>
                <span className="sparkle">✨</span>
              </div>
              
              <h1 className="welcome-heading">
                Welcome to Milan, <span className="user-name">{userName}</span>! 💕
              </h1>
              
              <p className="welcome-text">
                Tumhari love story yahan se shuru hoti hai. Ready? ✨
              </p>

              <div className="sparkles-bottom">
                <span className="sparkle-line">━━━━━</span>
                <span className="sparkle-heart">❤️</span>
                <span className="sparkle-line">━━━━━</span>
              </div>

              <button className="start-journey-btn" onClick={handleStartJourney}>
                <span className="btn-sparkle">✨</span>
                <span className="btn-text">Start Milan Journey</span>
                <span className="btn-sparkle">✨</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal - ADDED */}
      {showLogoutModal && (
        <div className="logout-modal-overlay" role="dialog" aria-modal="true">
          <div className="logout-modal">
            <div className="modal-content">
              <div className="heart-icon-large">💔</div>
              <h2 className="modal-heading-logout">
                Going so soon?
              </h2>
              
              <p className="modal-description-logout">
                Are you sure you want to logout?
                <br />
                We’ll miss your presence here on Milan ❤️
              </p>

              <div className="modal-actions">
                <button 
                  className="btn-stay-logged-in" 
                  onClick={handleStayLoggedIn}
                >
                  Stay Logged In
                </button>
                <button 
                  className="btn-logout-confirm" 
                  onClick={confirmLogout}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* End Logout Confirmation Modal */}

      {/* Main Connect Page */}
      {!showWelcome && (
        <>
          {/* Logout Button */}
          <button 
            className="logout-btn"
            onClick={handleLogout} // Calls the function to show modal
            aria-label="Logout"
            title="Logout"
          >
            <svg viewBox="0 0 24 24" className="logout-icon" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
          </button>

          <div className="frame" aria-hidden />

          <canvas id="heartsCanvas" />
          <canvas
            id="fxCanvas"
            style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
          />

          <div className="brandBlock">
            <div className="heroBrand">Milan</div>
            <div className="brandTagline">
              Where hearts connect <span aria-hidden>❤️</span>
            </div>
          </div>

          <main className="heroWrap">
            {/* REMOVED THE GREETING TEXT HERE AS REQUESTED */}
            
            <section
              className="featuresGrid"
              role="navigation"
              aria-label="Choose a mode"
            >
              {/* PROFILE CARD - FIRST POSITION */}
              <article className="featureCard profile-card">
                <div className="profile-icon-wrapper">
                  <div className="profile-avatar">
                    {profile.name ? (
                      <span className="profile-initial">{profile.name.charAt(0).toUpperCase()}</span>
                    ) : (
                      <svg viewBox="0 0 24 24" className="profile-icon" fill="currentColor">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                    )}
                  </div>
                  <div className="profile-pulse-ring"></div>
                </div>
                
                <header>
                  <h3>Meri Kahaani</h3>
                  <p>Apni pehchaan banao. Dikhao tum kaun ho. ✨</p>
                </header>
                
                <button className="cta profile-cta" onClick={handleProfileClick}>
                  ✍️ Apna Profile Banao
                </button>
                
                {profile.name && (
                  <div className="profile-completion-hint">
                    <span className="hint-icon">👋</span>
                    <span className="hint-text">Namaste {profile.name}!</span>
                  </div>
                )}
              </article>

              <article className="featureCard text">
                <header>
                  <h3>Text Chat</h3>
                  <p>Say hello. Trade vibes. Let the story find you.</p>
                </header>
                <button className="cta" onClick={() => startSearch("text")}>
                  💬 Start Text Chat
                </button>
              </article>

              <article className="featureCard video">
                <header>
                  <h3>Video Chat</h3>
                  <p>Face-to-face chemistry. Zero setup, all spark.</p>
                </header>
                <button className="cta" onClick={() => startSearch("video")}>
                  🎥 Start Video Chat
                </button>
              </article>

              <article className="featureCard invite coming-soon">
                <div className="coming-soon-badge">
                  <span className="badge-sparkle">✨</span>
                  <span className="badge-text">Coming Soon</span>
                  <span className="badge-sparkle">✨</span>
                </div>
                <header>
                  <h3>Invite Link (Zero-DB)</h3>
                  <p>Share a link. Partner clicks. You're connected.</p>
                </header>
                <button className="cta disabled">
                  🔗 Create Invite Link
                </button>
                <div className="hover-message">
                  💕 Patience, love! This magical feature is almost ready to bring hearts together... 💕
                </div>
              </article>

              <article className="featureCard studio">
                <header>
                  <h3>Milan AI Studio</h3>
                  <p>Create dreamy prompts & reels—love, but make it aesthetic.</p>
                </header>
                <a href="/ai" className="cta">
                  🎨 Open AI Studio
                </a>
              </article>
            </section>

            {showLoader && isSearching && (
              <div className="search-modal-overlay" role="dialog" aria-modal="true">
                <div className="search-modal">
                  <div className="modal-content">
                    <h2 className="modal-heading">
                      💖 Your Milan story is about to begin…
                    </h2>
                    
                    <div className="heart-loader-container">
                      <div className="orbiting-hearts">
                        <div className="orbit-heart heart-1">💗</div>
                        <div className="orbit-heart heart-2">💕</div>
                        <div className="orbit-heart heart-3">💖</div>
                        <div className="orbit-heart heart-4">💓</div>
                        <div className="orbit-heart heart-5">💙</div>
                        <div className="orbit-heart heart-6">💞</div>
                      </div>
                      
                      <svg className="center-heart" viewBox="0 0 24 24" aria-hidden>
                        <defs>
                          <linearGradient id="heartGrad" x1="0" x2="1" y1="0" y2="1">
                            <stop offset="0%" stopColor="#ff6ea7" />
                            <stop offset="50%" stopColor="#ff9fb0" />
                            <stop offset="100%" stopColor="#ff6ea7" />
                          </linearGradient>
                        </defs>
                        <path 
                          fill="url(#heartGrad)" 
                          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.19C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                          className="heart-pulse"
                        />
                      </svg>
                    </div>

                    <p className="modal-description">
                      We're gently nudging hearts together – finding someone who vibes with your rhythm. Hold on, cupid is working his magic! 💘
                    </p>

                    <div className="status-text">{statusMessage}</div>

                    <button className="stop-search-btn" onClick={() => stopSearch(true)}>
                      <span className="btn-icon">✕</span>
                      <span className="btn-text">Stop Searching</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </>
      )}

      <style jsx>{`
        :root { --brandH: 140px; --bottomH: 60px; }
        *, *::before, *::after { box-sizing: border-box; min-width: 0; }
        html, body { margin: 0; padding: 0; min-height: 100vh; background: #08060c; color: #f7f7fb; font-family: Poppins, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
        body { overflow-x: hidden; overflow-y: auto; }
        
        /* Profile Card Specific Styles */
        .featureCard.profile-card {
          border-color: rgba(255, 215, 0, 0.3);
          background: linear-gradient(145deg, 
            rgba(255, 215, 0, 0.08) 0%, 
            rgba(255, 110, 167, 0.08) 100%);
          position: relative;
          overflow: visible;
        }

        .featureCard.profile-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 30% 30%, 
            rgba(255, 215, 0, 0.15) 0%, 
            transparent 70%);
          pointer-events: none;
          animation: profileGlow 3s ease-in-out infinite;
        }

        @keyframes profileGlow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .featureCard.profile-card:hover {
          border-color: rgba(255, 215, 0, 0.5);
          box-shadow: 
            0 18px 56px rgba(0, 0, 0, 0.45),
            0 0 40px rgba(255, 215, 0, 0.2);
        }

        .profile-icon-wrapper {
          position: relative;
          width: 70px;
          height: 70px;
          margin: 0 auto 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .profile-avatar {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffd700 0%, #ff9fb0 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 
            0 10px 30px rgba(255, 215, 0, 0.4),
            0 0 40px rgba(255, 110, 167, 0.3),
            inset 0 2px 2px rgba(255, 255, 255, 0.3);
          position: relative;
          z-index: 2;
          transition: all 0.3s ease;
        }

        .featureCard.profile-card:hover .profile-avatar {
          transform: scale(1.1) rotate(5deg);
          box-shadow: 
            0 15px 40px rgba(255, 215, 0, 0.5),
            0 0 50px rgba(255, 110, 167, 0.4),
            inset 0 2px 2px rgba(255, 255, 255, 0.4);
        }

        .profile-initial {
          font-size: 28px;
          font-weight: 900;
          color: #fff;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .profile-icon {
          width: 32px;
          height: 32px;
          color: #fff;
          filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
        }

        .profile-pulse-ring {
          position: absolute;
          inset: -8px;
          border: 3px solid rgba(255, 215, 0, 0.5);
          border-radius: 50%;
          animation: pulsateRing 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulsateRing {
          0% {
            transform: scale(0.85);
            opacity: 1;
          }
          100% {
            transform: scale(1.15);
            opacity: 0;
          }
        }

        .profile-cta {
          background: linear-gradient(135deg, #ffd700 0%, #ff9fb0 100%);
          box-shadow: 0 10px 30px rgba(255, 215, 0, 0.35);
        }

        .profile-cta:hover {
          background: linear-gradient(135deg, #ff9fb0 0%, #ffd700 100%);
          box-shadow: 0 14px 40px rgba(255, 215, 0, 0.45);
        }

        .profile-completion-hint {
          position: absolute;
          top: -10px;
          right: -10px;
          background: linear-gradient(135deg, #ffd700, #ffed4e);
          color: #1a1a1a;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 900;
          display: flex;
          align-items: center;
          gap: 5px;
          box-shadow: 0 4px 16px rgba(255, 215, 0, 0.5);
          animation: hintBounce 2s ease-in-out infinite;
        }

        @keyframes hintBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        .hint-icon {
          font-size: 14px;
        }

        .hint-text {
          letter-spacing: 0.3px;
        }

        /* Welcome Popup Styles */
        .welcome-fullscreen {
          position: fixed;
          inset: 0;
          z-index: 99999;
          background: linear-gradient(135deg, 
            #08060c 0%, 
            #1a0d1f 25%,
            #2d1333 50%,
            #1a0d1f 75%,
            #08060c 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: welcomeBackgroundPulse 8s ease-in-out infinite;
          overflow: hidden;
        }

        @keyframes welcomeBackgroundPulse {
          0%, 100% { 
            background: linear-gradient(135deg, 
              #08060c 0%, 
              #1a0d1f 25%,
              #2d1333 50%,
              #1a0d1f 75%,
              #08060c 100%);
          }
          50% { 
            background: linear-gradient(135deg, 
              #0a0812 0%, 
              #1f1025 25%,
              #331638 50%,
              #1f1025 75%,
              #0a0812 100%);
          }
        }

        .floating-hearts {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .float-heart {
          position: absolute;
          font-size: 40px;
          opacity: 0.3;
          animation: floatUp 15s ease-in infinite;
          filter: drop-shadow(0 4px 20px rgba(255, 110, 167, 0.5));
        }

        .float-heart.heart-1 { left: 10%; animation-delay: 0s; animation-duration: 18s; }
        .float-heart.heart-2 { left: 25%; animation-delay: 3s; animation-duration: 16s; }
        .float-heart.heart-3 { left: 50%; animation-delay: 1s; animation-duration: 20s; }
        .float-heart.heart-4 { left: 65%; animation-delay: 4s; animation-duration: 17s; }
        .float-heart.heart-5 { left: 80%; animation-delay: 2s; animation-duration: 19s; }
        .float-heart.heart-6 { left: 90%; animation-delay: 5s; animation-duration: 15s; }

        @keyframes floatUp {
          0% { transform: translateY(100vh) rotate(0deg) scale(0.8); opacity: 0; }
          10% { opacity: 0.3; }
          90% { opacity: 0.3; }
          100% { transform: translateY(-100vh) rotate(360deg) scale(1.2); opacity: 0; }
        }

        .welcome-content-wrapper {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 600px;
          padding: 40px 20px;
          animation: welcomeSlideIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes welcomeSlideIn {
          from { opacity: 0; transform: scale(0.8) translateY(50px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .welcome-box {
          background: linear-gradient(145deg, 
            rgba(255, 110, 167, 0.15) 0%, 
            rgba(255, 159, 176, 0.12) 50%,
            rgba(255, 110, 167, 0.15) 100%);
          border: 3px solid rgba(255, 110, 167, 0.4);
          border-radius: 40px;
          padding: 60px 40px;
          text-align: center;
          box-shadow: 
            0 40px 100px rgba(255, 110, 167, 0.5),
            0 0 80px rgba(255, 110, 167, 0.3),
            inset 0 2px 2px rgba(255, 255, 255, 0.2);
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(20px);
        }

        .welcome-box::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 0%, 
            rgba(255, 110, 167, 0.3) 0%, 
            transparent 70%);
          animation: welcomeGlowPulse 4s ease-in-out infinite;
        }

        @keyframes welcomeGlowPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }

        .sparkles-top {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 20px;
          margin-bottom: 30px;
          z-index: 1;
        }

        .sparkle {
          font-size: 36px;
          animation: sparkleRotate 3s ease-in-out infinite;
          filter: drop-shadow(0 4px 16px rgba(255, 110, 167, 0.8));
        }

        .sparkle.big {
          font-size: 50px;
          animation: sparkleBounce 2s ease-in-out infinite;
        }

        @keyframes sparkleRotate {
          0%, 100% { transform: rotate(0deg) scale(1); opacity: 0.8; }
          50% { transform: rotate(180deg) scale(1.2); opacity: 1; }
        }

        @keyframes sparkleBounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-15px) scale(1.15); }
        }

        .welcome-heading {
          position: relative;
          z-index: 1;
          margin: 0 0 25px 0;
          font-size: clamp(28px, 5vw, 42px);
          font-weight: 900;
          line-height: 1.3;
          background: linear-gradient(135deg, 
            #fff 0%, 
            #ffd6ea 30%, 
            #ff9fb0 60%,
            #ff6ea7 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          letter-spacing: 0.5px;
          text-shadow: 0 4px 30px rgba(255, 110, 167, 0.6);
          animation: headingShimmer 3s ease-in-out infinite;
        }

        @keyframes headingShimmer {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.3); }
        }

        .user-name {
          display: inline-block;
          color: #ff9fb0;
          background: linear-gradient(135deg, #ff6ea7, #ffb6c1);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          font-weight: 900;
          animation: nameGlow 2s ease-in-out infinite;
        }

        @keyframes nameGlow {
          0%, 100% { filter: drop-shadow(0 0 10px rgba(255, 110, 167, 0.8)); }
          50% { filter: drop-shadow(0 0 20px rgba(255, 110, 167, 1)); }
        }

        .welcome-text {
          position: relative;
          z-index: 1;
          margin: 0 0 35px 0;
          font-size: clamp(18px, 3vw, 22px);
          line-height: 1.6;
          color: #ffdfe8;
          font-weight: 600;
          text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
        }

        .sparkles-bottom {
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 15px;
          margin-bottom: 40px;
        }

        .sparkle-line {
          color: rgba(255, 110, 167, 0.5);
          font-size: 20px;
          letter-spacing: 4px;
        }

        .sparkle-heart {
          font-size: 28px;
          animation: heartBeatWelcome 1.5s ease-in-out infinite;
          filter: drop-shadow(0 4px 16px rgba(255, 110, 167, 0.8));
        }

        @keyframes heartBeatWelcome {
          0%, 100% { transform: scale(1); }
          10%, 30% { transform: scale(1.2); }
          20%, 40% { transform: scale(1.1); }
        }

        .start-journey-btn {
          position: relative;
          z-index: 1;
          padding: 20px 50px;
          background: linear-gradient(135deg, #ff6ea7 0%, #ff9fb0 100%);
          color: #fff;
          border: none;
          border-radius: 60px;
          font-size: 20px;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          box-shadow: 
            0 15px 40px rgba(255, 110, 167, 0.6),
            0 0 60px rgba(255, 110, 167, 0.4),
            inset 0 2px 2px rgba(255, 255, 255, 0.3);
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          letter-spacing: 1px;
          text-transform: uppercase;
          animation: buttonPulse 3s ease-in-out infinite;
        }

        @keyframes buttonPulse {
          0%, 100% {
            box-shadow: 
              0 15px 40px rgba(255, 110, 167, 0.6),
              0 0 60px rgba(255, 110, 167, 0.4),
              inset 0 2px 2px rgba(255, 255, 255, 0.3);
          }
          50% {
            box-shadow: 
              0 20px 50px rgba(255, 110, 167, 0.8),
              0 0 80px rgba(255, 110, 167, 0.6),
              inset 0 2px 2px rgba(255, 255, 255, 0.4);
          }
        }

        .start-journey-btn:hover {
          transform: translateY(-5px) scale(1.05);
          box-shadow: 
            0 25px 60px rgba(255, 110, 167, 0.8),
            0 0 100px rgba(255, 110, 167, 0.6),
            inset 0 2px 2px rgba(255, 255, 255, 0.4);
          background: linear-gradient(135deg, #ff9fb0 0%, #ff6ea7 100%);
        }

        .start-journey-btn:active {
          transform: translateY(-2px) scale(1.02);
        }

        .btn-sparkle {
          font-size: 22px;
          animation: btnSparkleRotate 2s linear infinite;
        }

        @keyframes btnSparkleRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .btn-text {
          letter-spacing: 1.5px;
        }

        /* Main Page Styles */
        #heartsCanvas { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
        #fxCanvas { position: fixed; inset: 0; z-index: 0; pointer-events: none; }

        .logout-btn {
          position: fixed;
          top: 25px;
          right: 25px;
          z-index: 1000;
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          background: linear-gradient(135deg, rgba(255, 110, 167, 0.25), rgba(255, 159, 176, 0.25));
          border: 2px solid rgba(255, 110, 167, 0.4);
          border-radius: 50%;
          cursor: pointer;
          backdrop-filter: blur(12px);
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 
            0 4px 20px rgba(255, 110, 167, 0.3),
            0 0 30px rgba(255, 110, 167, 0.15),
            inset 0 1px 1px rgba(255, 255, 255, 0.2);
          animation: gentlePulse 3s ease-in-out infinite;
        }

        @keyframes gentlePulse {
          0%, 100% { 
            box-shadow: 
              0 4px 20px rgba(255, 110, 167, 0.3),
              0 0 30px rgba(255, 110, 167, 0.15),
              inset 0 1px 1px rgba(255, 255, 255, 0.2);
          }
          50% { 
            box-shadow: 
              0 6px 28px rgba(255, 110, 167, 0.4),
              0 0 40px rgba(255, 110, 167, 0.25),
              inset 0 1px 1px rgba(255, 255, 255, 0.3);
          }
        }

        .logout-btn:hover {
          background: linear-gradient(135deg, rgba(255, 110, 167, 0.4), rgba(255, 159, 176, 0.4));
          border-color: rgba(255, 110, 167, 0.7);
          transform: translateY(-3px) scale(1.08);
          box-shadow: 
            0 8px 32px rgba(255, 110, 167, 0.5),
            0 0 50px rgba(255, 110, 167, 0.3),
            inset 0 2px 2px rgba(255, 255, 255, 0.3);
          animation: none;
        }

        .logout-btn:active {
          transform: translateY(-1px) scale(1.02);
        }

        .logout-icon {
          width: 22px;
          height: 22px;
          color: #fff;
          filter: drop-shadow(0 2px 4px rgba(255, 110, 167, 0.6));
          transition: all 0.3s ease;
        }

        .logout-btn:hover .logout-icon {
          transform: translateX(2px);
          filter: drop-shadow(0 3px 8px rgba(255, 110, 167, 0.8));
        }

        .frame {
          position: fixed;
          top: 10px;
          bottom: 10px;
          right: 10px;
          left: 10px;
          z-index: 2;
          pointer-events: none;
        }
        
        .frame::before {
          content: '';
          position: absolute;
          inset: 0;
          padding: 2px;
          background: linear-gradient(135deg, rgba(255,110,167,0.18), rgba(255,110,167,0.08) 40%, rgba(255,182,193,0.08));
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          border-radius: 18px;
          box-shadow: 0 0 28px rgba(255,110,167,0.12), 0 0 46px rgba(255,110,167,0.06);
        }
        
        .frame::after {
          content: '';
          position: absolute;
          inset: 8px;
          border: 1px solid rgba(255,110,167,0.08);
          border-radius: 14px;
          box-shadow: 0 0 20px rgba(255,110,167,0.06) inset;
        }

        /* MODIFIED: Changed to relative to fix overlapping issue */
        .brandBlock {
          position: relative; /* Changed from fixed */
          margin: 40px auto 20px auto; /* Added margin for spacing */
          text-align: center;
          z-index: 3;
          pointer-events: none;
          width: 100%;
          padding: 0 20px;
        }

        .heroBrand {
          font-family: 'Great Vibes', cursive;
          font-size: clamp(60px, 12vw, 116px);
          line-height: 1.02;
          background: linear-gradient(180deg, #ffd6ea 0%, #ff9fb0 48%, #ff6ea7);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 0 28px rgba(255, 110, 167, 0.28), 0 0 40px rgba(255, 110, 167, 0.12);
          white-space: nowrap;
        }

        .brandTagline {
          margin-top: 6px;
          font-size: clamp(14px, 3vw, 20px);
          font-weight: 700;
          letter-spacing: 0.02em;
          background: linear-gradient(90deg, #ffd6ea, #ffb6c1);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          font-style: italic;
          position: relative;
          display: inline-block;
        }

        .brandTagline:after {
          content: "";
          display: block;
          height: 2px;
          margin: 8px auto 0;
          width: clamp(100px, 30vw, 160px);
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(255, 182, 193, 0), #ffd6ea, rgba(255, 182, 193, 0));
          box-shadow: 0 0 12px rgba(255, 110, 167, 0.15);
        }

        /* MODIFIED: Adjusted layout for responsiveness */
        .heroWrap {
          position: relative;
          z-index: 3;
          /* Removed fixed height constraint to allow natural flow */
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start; /* Changed from center to prevent push-up */
          padding: 10px 30px var(--bottomH); /* Simplified padding */
          box-sizing: border-box;
          gap: 20px;
        }

        .featuresGrid {
          width: min(920px, calc(100vw - 60px));
          display: grid;
          grid-template-columns: repeat(2, minmax(240px, 1fr));
          gap: 16px;
          padding: 0 10px;
        }

        .featureCard {
          background: rgba(16, 13, 22, 0.46);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          padding: 18px 16px;
          backdrop-filter: blur(8px);
          box-shadow: 0 14px 44px rgba(0, 0, 0, 0.35);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
          position: relative;
          min-height: 200px;
        }

        .featureCard header {
          width: 100%;
          text-align: center;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }

        .featureCard header h3 {
          margin: 0;
          font-size: 19px;
          font-weight: 900;
          letter-spacing: 0.2px;
          line-height: 1.2;
        }

        .featureCard header p {
          margin: 0;
          opacity: 0.9;
          font-size: 12px;
          line-height: 1.3;
        }

        .featureCard:hover {
          transform: translateY(-4px);
          box-shadow: 0 18px 56px rgba(0, 0, 0, 0.45);
        }

        .featureCard.text { border-color: rgba(255, 110, 167, 0.22); }
        .featureCard.video { border-color: rgba(255, 110, 167, 0.18); }
        .featureCard.invite { border-color: rgba(160, 220, 255, 0.28); }
        .featureCard.studio { border-color: rgba(140, 150, 255, 0.22); }

        .featureCard.coming-soon {
          position: relative;
          overflow: hidden;
        }

        .featureCard.coming-soon::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255, 110, 167, 0.03), rgba(255, 182, 193, 0.05));
          pointer-events: none;
        }

        .coming-soon-badge {
          position: absolute;
          top: -8px;
          right: -8px;
          background: linear-gradient(135deg, #ff6ea7, #ff9fb0);
          color: #fff;
          padding: 8px 16px;
          border-radius: 0 18px 0 18px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          box-shadow: 0 4px 16px rgba(255, 110, 167, 0.4);
          display: flex;
          align-items: center;
          gap: 6px;
          animation: badgePulse 2s ease-in-out infinite;
        }

        @keyframes badgePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        .badge-sparkle {
          font-size: 10px;
          animation: sparkle 1.5s ease-in-out infinite;
        }

        .badge-sparkle:nth-child(3) {
          animation-delay: 0.75s;
        }

        @keyframes sparkle {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }

        .badge-text {
          font-size: 11px;
        }

        .hover-message {
          position: absolute;
          bottom: -60px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, rgba(255, 110, 167, 0.95), rgba(255, 159, 176, 0.95));
          color: #fff;
          padding: 12px 20px;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 700;
          text-align: center;
          white-space: nowrap;
          box-shadow: 0 8px 24px rgba(255, 110, 167, 0.4);
          opacity: 0;
          pointer-events: none;
          transition: all 0.3s ease;
          z-index: 10;
        }

        .hover-message::before {
          content: '';
          position: absolute;
          top: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-bottom: 8px solid rgba(255, 110, 167, 0.95);
        }

        .featureCard.coming-soon:hover .hover-message {
          opacity: 1;
          bottom: -70px;
        }

        .featureCard.coming-soon header h3,
        .featureCard.coming-soon header p {
          opacity: 0.6;
        }

        .cta {
          width: 100%;
          padding: 10px 14px;
          border-radius: 12px;
          font-weight: 900;
          font-size: 13px;
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          background: linear-gradient(135deg, #ff6ea7 0%, #ff9fb0 100%);
          color: #fff;
          box-shadow: 0 10px 30px rgba(255, 110, 167, 0.3);
          transition: all 0.2s ease;
        }

        .cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 40px rgba(255, 110, 167, 0.4);
          background: linear-gradient(135deg, #ff9fb0 0%, #ff6ea7 100%);
        }

        .cta:active {
          transform: translateY(0) scale(0.98);
        }

        .cta:focus-visible {
          outline: 3px solid rgba(255, 110, 167, 0.48);
          outline-offset: 2px;
        }

        .cta.disabled {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.4);
          cursor: not-allowed;
          box-shadow: none;
        }

        .cta.disabled:hover {
          transform: none;
          box-shadow: none;
          background: rgba(255, 255, 255, 0.1);
        }

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
          from { opacity: 0; transform: translateY(30px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
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

        .heart-loader-container {
          position: relative;
          width: 180px;
          height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

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
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.3); opacity: 1; }
        }

        .orbit-heart.heart-1 { top: 0; left: 50%; transform: translateX(-50%); animation-delay: 0s; }
        .orbit-heart.heart-2 { top: 25%; right: 10%; animation-delay: 0.2s; }
        .orbit-heart.heart-3 { top: 50%; right: 0; transform: translateY(-50%); animation-delay: 0.4s; }
        .orbit-heart.heart-4 { bottom: 25%; right: 10%; animation-delay: 0.6s; }
        .orbit-heart.heart-5 { bottom: 0; left: 50%; transform: translateX(-50%); animation-delay: 0.8s; }
        .orbit-heart.heart-6 { top: 50%; left: 0; transform: translateY(-50%); animation-delay: 1s; }

        .center-heart {
          width: 80px;
          height: 80px;
          filter: drop-shadow(0 8px 24px rgba(255, 110, 167, 0.6));
          animation: heartBeat 1.2s ease-in-out infinite;
        }

        @keyframes heartBeat {
          0%, 100% { transform: scale(1); }
          10%, 30% { transform: scale(1.15); }
          20%, 40% { transform: scale(1.05); }
        }

        .heart-pulse {
          animation: fillPulse 2s ease-in-out infinite;
        }

        @keyframes fillPulse {
          0%, 100% { opacity: 1; filter: brightness(1); }
          50% { opacity: 0.85; filter: brightness(1.3); }
        }

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

        /* Logout Modal Styles - ADDED */
        .logout-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: grid;
          place-items: center;
          background: rgba(8, 6, 12, 0.95);
          backdrop-filter: blur(16px);
          animation: fadeIn 0.3s ease;
        }

        .logout-modal {
          width: min(450px, calc(100% - 32px));
          background: linear-gradient(145deg, 
            rgba(255, 110, 167, 0.2) 0%, 
            rgba(255, 159, 176, 0.15) 50%,
            rgba(255, 110, 167, 0.2) 100%);
          border: 3px solid rgba(255, 110, 167, 0.4);
          border-radius: 32px;
          padding: 40px 32px;
          text-align: center;
          box-shadow: 
            0 40px 100px rgba(255, 110, 167, 0.4),
            0 0 80px rgba(255, 110, 167, 0.25),
            inset 0 2px 2px rgba(255, 255, 255, 0.2);
          position: relative;
          overflow: hidden;
          animation: modalSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .heart-icon-large {
          font-size: 60px;
          margin-bottom: 10px;
          animation: heartBeatLogout 1.5s ease-in-out infinite;
          filter: drop-shadow(0 4px 20px rgba(255, 110, 167, 0.8));
        }

        @keyframes heartBeatLogout {
          0%, 100% { transform: scale(1); }
          10%, 30% { transform: scale(1.1); }
          20%, 40% { transform: scale(1.05); }
        }

        .modal-heading-logout {
          margin: 0 0 10px 0;
          font-size: 28px;
          font-weight: 900;
          background: linear-gradient(135deg, #fff 0%, #ffc4e1 50%, #ff9fb0 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 4px 20px rgba(255, 110, 167, 0.3);
        }

        .modal-description-logout {
          margin: 0 0 30px 0;
          font-size: 16px;
          line-height: 1.6;
          color: #ffdfe8;
          font-weight: 600;
        }

        .modal-actions {
          display: flex;
          justify-content: center;
          gap: 15px;
        }

        .btn-stay-logged-in, .btn-logout-confirm {
          padding: 14px 28px;
          border-radius: 18px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: all 0.3s ease;
          letter-spacing: 0.5px;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
        }

        .btn-stay-logged-in {
          background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
          color: #1a1a1a;
        }

        .btn-stay-logged-in:hover {
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 12px 30px rgba(255, 215, 0, 0.5);
        }

        .btn-logout-confirm {
          background: linear-gradient(135deg, #ff6ea7 0%, #ff4d6d 100%);
          color: #fff;
        }

        .btn-logout-confirm:hover {
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 12px 30px rgba(255, 79, 160, 0.5);
        }
        /* End Logout Modal Styles */

        /* Mobile Responsive Styles */
        @media (max-width: 760px) {
          .profile-icon-wrapper {
            width: 60px;
            height: 60px;
            margin-bottom: 10px;
          }

          .profile-avatar {
            width: 50px;
            height: 50px;
          }

          .profile-initial {
            font-size: 22px;
          }

          .profile-icon {
            width: 26px;
            height: 26px;
          }

          .profile-completion-hint {
            padding: 4px 8px;
            font-size: 9px;
          }

          .hint-icon {
            font-size: 11px;
          }

          .welcome-box {
            padding: 50px 30px;
            border-radius: 32px;
          }

          .welcome-heading {
            font-size: clamp(24px, 6vw, 32px);
            margin-bottom: 20px;
          }

          .welcome-text {
            font-size: clamp(16px, 4vw, 19px);
            margin-bottom: 30px;
          }

          .sparkles-top {
            gap: 15px;
            margin-bottom: 25px;
          }

          .sparkle {
            font-size: 30px;
          }

          .sparkle.big {
            font-size: 42px;
          }

          .start-journey-btn {
            padding: 16px 40px;
            font-size: 17px;
            gap: 10px;
          }

          .btn-sparkle {
            font-size: 20px;
          }

          .float-heart {
            font-size: 32px;
          }

          .logout-btn {
            top: 18px;
            right: 18px;
            width: 46px;
            height: 46px;
          }

          .logout-icon {
            width: 20px;
            height: 20px;
          }

          /* UPDATED RESPONSIVE */
          .heroWrap {
            padding: 10px 20px 30px;
          }

          .brandBlock {
            margin-top: 30px;
            margin-bottom: 15px;
          }

          .heroBrand {
            font-size: clamp(50px, 15vw, 80px);
          }

          .brandTagline {
            font-size: clamp(13px, 3.5vw, 18px);
            margin-top: 6px;
          }

          .featuresGrid {
            grid-template-columns: 1fr;
            width: 100%;
            max-width: 500px;
            gap: 12px;
            padding: 0;
          }

          .featureCard {
            padding: 14px 12px;
            min-height: 180px;
          }

          .featureCard header h3 {
            font-size: 17px;
          }

          .featureCard header p {
            font-size: 11px;
          }

          .cta {
            padding: 9px 12px;
            font-size: 12px;
          }

          .hover-message {
            white-space: normal;
            max-width: 280px;
            font-size: 12px;
          }

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

          /* Logout Modal Responsive */
          .logout-modal {
            padding: 30px 20px;
            border-radius: 28px;
          }
          .heart-icon-large {
            font-size: 50px;
          }
          .modal-heading-logout {
            font-size: 24px;
          }
          .modal-description-logout {
            font-size: 14px;
            margin-bottom: 25px;
          }
          .modal-actions {
            flex-direction: column;
            gap: 10px;
          }
          .btn-stay-logged-in, .btn-logout-confirm {
            padding: 12px;
            width: 100%;
          }
        }

        @media (max-width: 480px) {
          .profile-icon-wrapper {
            width: 55px;
            height: 55px;
            margin-bottom: 8px;
          }

          .profile-avatar {
            width: 45px;
            height: 45px;
          }

          .profile-initial {
            font-size: 20px;
          }

          .profile-icon {
            width: 24px;
            height: 24px;
          }

          .profile-pulse-ring {
            inset: -5px;
            border-width: 2px;
          }

          .welcome-box {
            padding: 40px 24px;
            border-radius: 28px;
            border-width: 2px;
          }

          .sparkles-top {
            gap: 12px;
            margin-bottom: 20px;
          }

          .sparkle {
            font-size: 26px;
          }

          .sparkle.big {
            font-size: 38px;
          }

          .welcome-heading {
            font-size: clamp(22px, 7vw, 28px);
            margin-bottom: 18px;
          }

          .welcome-text {
            font-size: clamp(15px, 4.5vw, 17px);
            margin-bottom: 28px;
          }

          .sparkles-bottom {
            gap: 10px;
            margin-bottom: 35px;
          }

          .sparkle-line {
            color: rgba(255, 110, 167, 0.5);
            font-size: 16px;
            letter-spacing: 3px;
          }

          .sparkle-heart {
            font-size: 24px;
          }

          .start-journey-btn {
            padding: 14px 32px;
            font-size: 16px;
            gap: 8px;
            border-radius: 50px;
          }

          .btn-sparkle {
            font-size: 18px;
          }

          .btn-text {
            letter-spacing: 1px;
            font-size: 15px;
          }

          .float-heart {
            font-size: 28px;
          }

          .logout-btn {
            top: 15px;
            right: 15px;
            width: 44px;
            height: 44px;
          }

          .logout-icon {
            width: 18px;
            height: 18px;
          }

          .brandBlock {
            margin-top: 40px;
          }

          .heroBrand {
            font-size: clamp(40px, 18vw, 70px);
          }

          .brandTagline {
            font-size: 14px;
          }

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

          .featureCard {
            padding: 12px 10px;
            min-height: 170px;
          }

          .heroWrap {
            padding: 10px 16px 25px;
          }
        }

        @media (min-width: 761px) and (max-width: 1024px) {
          .welcome-box {
            padding: 55px 35px;
          }

          .heroWrap {
            padding: 20px 24px var(--bottomH);
          }

          .featuresGrid {
            width: calc(100vw - 80px);
            max-width: 880px;
          }
        }

        @media (max-width: 360px) {
          .profile-icon-wrapper {
            width: 50px;
            height: 50px;
            margin-bottom: 6px;
          }

          .profile-avatar {
            width: 40px;
            height: 40px;
          }

          .profile-initial {
            font-size: 18px;
          }

          .profile-icon {
            width: 20px;
            height: 20px;
          }

          .profile-pulse-ring {
            inset: -4px;
            border-width: 2px;
          }

          .profile-completion-hint {
            padding: 3px 6px;
            font-size: 8px;
            top: -6px;
            right: -6px;
          }

          .hint-icon {
            font-size: 10px;
          }

          .featureCard {
            min-height: 160px;
            padding: 10px 8px;
          }

          .welcome-box {
            padding: 36px 20px;
          }

          .welcome-heading {
            font-size: 20px;
          }

          .welcome-text {
            font-size: 14px;
          }

          .start-journey-btn {
            padding: 12px 28px;
            font-size: 14px;
          }
        }
      `}</style>
    </>
  );
}
