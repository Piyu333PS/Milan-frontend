"use client";
import { useEffect } from "react";
import io from "socket.io-client";

export default function VideoPage() {
  useEffect(() => {
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
            reveal.querySelector(".match-text").textContent = match ? "Match! 💖 +1" : "Different — Opposites attract! ✨";
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

      // ========== NEW ACTIVITIES SIGNALS ==========

      // RAPID FIRE
      socket.on("rapidFireStart", (data) => {
        try {
          log("rapidFireStart", data);
          const modal = get("rapidFireModal");
          if (!modal) return;
          rapidFireCount = 0;
          modal.querySelector(".rf-timer").textContent = "60";
          modal.querySelector(".rf-question").textContent = "Get ready...";
          modal.querySelector(".rf-counter").textContent = "0/12";
          modal.style.display = "flex";
          showToast("Rapid Fire starting!");
        } catch (e) { console.error("rapidFireStart", e); }
      });

      socket.on("rapidFireQuestion", (q) => {
        try {
          log("rapidFireQuestion", q);
          const modal = get("rapidFireModal");
          if (!modal) return;
          rapidFireCount++;
          modal.querySelector(".rf-question").textContent = q.text || "Question...";
          modal.querySelector(".rf-counter").textContent = `${rapidFireCount}/${q.total || 12}`;
        } catch (e) { console.error("rapidFireQuestion", e); }
      });

      socket.on("rapidFireTick", (data) => {
        try {
          const modal = get("rapidFireModal");
          if (!modal) return;
          modal.querySelector(".rf-timer").textContent = data.remaining || "0";
        } catch (e) {}
      });

      socket.on("rapidFireEnd", (data) => {
        try {
          log("rapidFireEnd", data);
          const modal = get("rapidFireModal");
          if (modal) modal.style.display = "none";
          showToast(`Rapid Fire Over! ${data.questionsShown || rapidFireCount} questions asked`);
        } catch (e) { console.error("rapidFireEnd", e); }
      });

      // MIRROR CHALLENGE
      socket.on("mirrorStart", (data) => {
        try {
          log("mirrorStart", data);
          const modal = get("mirrorModal");
          if (!modal) return;
          const role = data.isLeader ? "LEADER" : "FOLLOWER";
          modal.querySelector(".mirror-role").textContent = role === "LEADER" ? "👑 LEADER" : "🪞 FOLLOWER";
          modal.querySelector(".mirror-instructions").textContent = role === "LEADER" 
            ? "Do funny actions! Your partner will copy you." 
            : "Mirror your partner's movements!";
          modal.querySelector(".mirror-timer").textContent = "60";
          modal.style.display = "flex";
          showToast(`Mirror Challenge: You are ${role}`);
        } catch (e) { console.error("mirrorStart", e); }
      });

      socket.on("mirrorTick", (data) => {
        try {
          const modal = get("mirrorModal");
          if (!modal) return;
          modal.querySelector(".mirror-timer").textContent = data.remaining || "0";
        } catch (e) {}
      });

      socket.on("mirrorEnd", () => {
        try {
          log("mirrorEnd");
          const modal = get("mirrorModal");
          if (modal) modal.style.display = "none";
          showToast("Mirror Challenge Complete! 🎉");
        } catch (e) { console.error("mirrorEnd", e); }
      });

      // STARING CONTEST
      socket.on("staringStart", () => {
        try {
          log("staringStart");
          const modal = get("staringModal");
          if (!modal) return;
          modal.querySelector(".staring-timer").textContent = "0";
          modal.querySelector(".staring-status").textContent = "Stare into each other's eyes!";
          modal.style.display = "flex";
          showToast("Staring Contest Started! 👀");
        } catch (e) { console.error("staringStart", e); }
      });

      socket.on("staringTick", (data) => {
        try {
          const modal = get("staringModal");
          if (!modal) return;
          modal.querySelector(".staring-timer").textContent = data.elapsed || "0";
        } catch (e) {}
      });

      socket.on("staringEnd", (data) => {
        try {
          log("staringEnd", data);
          const modal = get("staringModal");
          if (!modal) return;
          const winner = data.winner || "Nobody";
          const duration = data.duration || "0";
          modal.querySelector(".staring-status").textContent = `Winner: ${winner} 🏆 (${duration}s)`;
          setTimeout(() => {
            if (modal) modal.style.display = "none";
          }, 3000);
        } catch (e) { console.error("staringEnd", e); }
      });

      // FINISH THE LYRICS
      socket.on("lyricsStart", (data) => {
        try {
          log("lyricsStart", data);
          const modal = get("lyricsModal");
          if (!modal) return;
          lyricsCurrentSong = data;
          modal.querySelector(".lyrics-line").textContent = data.line || "Starting line...";
          modal.querySelector(".lyrics-song-hint").textContent = `Song: ${data.songName || "Guess it!"}`;
          modal.querySelector(".lyrics-answer").style.display = "none";
          modal.querySelector(".lyrics-answer").textContent = "";
          modal.style.display = "flex";
          showToast("Finish the Lyrics! 🎤");
        } catch (e) { console.error("lyricsStart", e); }
      });

      socket.on("lyricsReveal", (data) => {
        try {
          log("lyricsReveal", data);
          const modal = get("lyricsModal");
          if (!modal) return;
          const answerDiv = modal.querySelector(".lyrics-answer");
          answerDiv.textContent = `Answer: "${data.answer || ""}"`;
          answerDiv.style.display = "block";
        } catch (e) { console.error("lyricsReveal", e); }
      });

      socket.on("lyricsEnd", () => {
        try {
          log("lyricsEnd");
          const modal = get("lyricsModal");
          if (modal) modal.style.display = "none";
          showToast("Lyrics Challenge Complete!");
        } catch (e) { console.error("lyricsEnd", e); }
      });

      // DANCE DARE
      socket.on("danceStart", (data) => {
        try {
          log("danceStart", data);
          const modal = get("danceModal");
          if (!modal) return;
          modal.querySelector(".dance-song").textContent = data.song || "Random Song";
          modal.querySelector(".dance-genre").textContent = data.genre || "Party";
          modal.querySelector(".dance-timer").textContent = "15";
          modal.style.display = "flex";
          showToast("Dance Time! 💃");
        } catch (e) { console.error("danceStart", e); }
      });

      socket.on("danceTick", (data) => {
        try {
          const modal = get("danceModal");
          if (!modal) return;
          modal.querySelector(".dance-timer").textContent = data.remaining || "0";
        } catch (e) {}
      });

      socket.on("danceEnd", () => {
        try {
          log("danceEnd");
          const modal = get("danceModal");
          if (modal) modal.style.display = "none";
          showToast("Dance Dare Complete! 🎉");
        } catch (e) { console.error("danceEnd", e); }
      });

      // UI WIRING
      setTimeout(() => {
        var micBtn = get("micBtn");
        if (micBtn) {
          micBtn.onclick = function () {
            var t = localStream && localStream.getAudioTracks ? localStream.getAudioTracks()[0] : null;
            if (!t) return;
            t.enabled = !t.enabled;
            micBtn.classList.toggle("inactive", !t.enabled);
            var i = micBtn.querySelector("i");
            if (i) i.className = t.enabled ? "fas fa-microphone" : "fas fa-microphone-slash";
            showToast(t.enabled ? "Mic On" : "Mic Off");
          };
        }

        var camBtn = get("camBtn");
        if (camBtn) {
          camBtn.onclick = function () {
            var t = localStream && localStream.getVideoTracks ? localStream.getVideoTracks()[0] : null;
            if (!t) return;
            t.enabled = !t.enabled;
            camBtn.classList.toggle("inactive", !t.enabled);
            var ii = camBtn.querySelector("i");
            if (ii) ii.className = t.enabled ? "fas fa-video" : "fas fa-video-slash";
            showToast(t.enabled ? "Camera On" : "Camera Off");
          };
        }

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
            if (inAppBrowser) {
              showToast("We detected an in-app browser. Open the link in Chrome app for screen sharing.");
              return;
            }

            if (screenBtn.dataset.sharing === "true") {
              try {
                var sender = pc.getSenders ? pc.getSenders().find(s => s && s.track && s.track.kind === "video") : null;
                var cam = cameraTrackSaved;
                if (!cam || cam.readyState === "ended") {
                  try {
                    const freshStream = await navigator.mediaDevices.getUserMedia({ video: true });
                    cam = freshStream.getVideoTracks()[0];
                    cameraTrackSaved = cam;
                    if (localStream && typeof localStream.addTrack === "function") {
                      try { localStream.addTrack(cam); } catch (e) { }
                    }
                    var lv = get("localVideo");
                    if (lv) lv.srcObject = localStream;
                  } catch (err) {
                    log("Couldn't reacquire camera after screen share ended", err);
                  }
                }
                if (sender && cam) {
                  try { await sender.replaceTrack(cam); } catch (err) { log("restore camera failed", err); }
                }
                screenBtn.dataset.sharing = 'false';
                screenBtn.classList.remove("active");
                showToast("Screen sharing stopped");
              } catch (err) {
                console.warn("Error stopping screen share", err);
                showToast("Could not stop screen share cleanly");
                screenBtn.dataset.sharing = 'false';
                screenBtn.classList.remove("active");
              }
              return;
            }

            const tryGetDisplayMedia = async () => {
              if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === "function") {
                return await navigator.mediaDevices.getDisplayMedia({ video: true });
              }
              if (typeof navigator.getDisplayMedia === "function") {
                return await navigator.getDisplayMedia({ video: true });
              }
              throw new Error("getDisplayMedia not supported");
            };

            try {
              const displayStream = await tryGetDisplayMedia();
              if (!displayStream) throw new Error("No display stream returned");
              const screenTrack = displayStream.getVideoTracks()[0];
              const sender = pc.getSenders ? pc.getSenders().find(s => s && s.track && s.track.kind === "video") : null;
              if (!sender) {
                showToast("No video sender found");
                screenTrack && screenTrack.stop && screenTrack.stop();
                return;
              }

              const savedCam = localStream && localStream.getVideoTracks ? localStream.getVideoTracks()[0] : cameraTrackSaved;
              cameraTrackSaved = savedCam || cameraTrackSaved;

              try {
                if (typeof sender.replaceTrack === "function") {
                  await sender.replaceTrack(screenTrack);
                } else {
                  try { pc.addTrack(screenTrack, displayStream); } catch (e) { log("addTrack screen failed", e); }
                }
              } catch (e) {
                log("replaceTrack/addTrack failed for screen", e);
              }

              var lv = get("localVideo");
              if (lv) lv.srcObject = displayStream;

              screenBtn.dataset.sharing = 'true';
              screenBtn.classList.add("active");
              showToast("Screen sharing active");

              screenTrack.onended = async function () {
                try {
                  var sender2 = pc.getSenders ? pc.getSenders().find(s => s && s.track && s.track.kind === "video") : null;
                  var cam = cameraTrackSaved;
                  if (!cam || cam.readyState === "ended") {
                    try {
                      const fresh = await navigator.mediaDevices.getUserMedia({ video: true });
                      cam = fresh.getVideoTracks()[0];
                      cameraTrackSaved = cam;
                      try {
                        var prev = localStream && localStream.getVideoTracks && localStream.getVideoTracks()[0];
                        if (prev && prev.stop) prev.stop();
                        if (localStream && typeof localStream.removeTrack === "function" && prev) { try { localStream.removeTrack(prev); } catch (e) {} }
                        if (localStream && typeof localStream.addTrack === "function" && cam) { try { localStream.addTrack(cam); } catch (e) {} }
                      } catch (e) { }
                    } catch (err) {
                      log("Couldn't reacquire camera after screen share ended", err);
                    }
                  }
                  if (sender2 && cam) {
                    try { await sender2.replaceTrack(cam); } catch (err) { log("restore camera via replaceTrack failed", err); }
                    showToast("Screen sharing stopped – camera restored");
                  } else {
                    showToast("Screen sharing stopped");
                  }
                } catch (err) {
                  console.error("Error restoring camera after screen end", err);
                  showToast("Stopped screen sharing");
                } finally {
                  screenBtn.dataset.sharing = 'false';
                  screenBtn.classList.remove("active");
                  try { var lv2 = get("localVideo"); if (lv2 && localStream) lv2.srcObject = localStream; } catch (e) {}
                }
              };
            } catch (err) {
              log("DisplayMedia error or not supported", err);
              const ua2 = navigator.userAgent || "";
              if (/android/i.test(ua2)) {
                showToast("Screen share not supported in this browser. Use Chrome on Android (latest) for screen sharing.");
              } else if (/iphone|ipad|ipod/i.test(ua2)) {
                showToast("iOS Safari doesn't support screen sharing for web apps. Use Android or desktop.");
              } else {
                showToast("Screen sharing not available. Try updating your browser (Chrome/Firefox).");
              }
            }
          };
        }

        var disconnectBtn = get("disconnectBtn");
        if (disconnectBtn) {
          disconnectBtn.onclick = function () {
            try { safeEmit("partnerLeft"); } catch (e) { log("emit partnerLeft err", e); }
            cleanupPeerConnection();
            showRating();
          };
        }

        var quitBtn = get("quitBtn");
        if (quitBtn) quitBtn.onclick = function () { cleanup(); window.location.href = "/"; };

        var newPartnerBtn = get("newPartnerBtn");
        if (newPartnerBtn) newPartnerBtn.onclick = function () { cleanupPeerConnection(); window.location.href = "/connect"; };

        var hearts = document.querySelectorAll("#ratingOverlay .hearts i");
        for (var hi = 0; hi < hearts.length; hi++) {
          (function (h) {
            h.addEventListener("click", function () {
              var val = parseInt(h.getAttribute("data-value"));
              for (var q = 0; q < hearts.length; q++) hearts[q].classList.remove("selected");
              for (var r = 0; r < val; r++) hearts[r].classList.add("selected");
              var container = document.querySelector("#ratingOverlay .emoji-container");
              if (container) {
                var e = document.createElement("div");
                e.className = "floating-emoji";
                e.textContent = val >= 4 ? "❤️" : "🙂";
                e.style.left = "50%";
                e.style.top = "50%";
                container.appendChild(e);
                setTimeout(() => { try { e.remove(); } catch (e) {} }, 1400);
              }
            });
          })(hearts[hi]);
        }

        // Activities button
        var activitiesBtn = get("activitiesBtn");
        if (activitiesBtn) {
          activitiesBtn.onclick = function () {
            var m = get("activitiesModal");
            if (m) m.style.display = "flex";
          };
        }

        // Activities modal close
        var actClose = get("activitiesClose");
        if (actClose) actClose.onclick = function () { var m = get("activitiesModal"); if (m) m.style.display = "none"; };

        // EXISTING ACTIVITIES
        var startTwo = get("startTwoOption");
        if (startTwo) startTwo.onclick = function () {
          safeEmit("twoOptionStart", { questionsPack: "default", count: 10 });
          var m = get("activitiesModal"); if (m) m.style.display = "none";
          showToast("Starting Two-Option Quiz...");
        };

        var startSpin = get("startSpin");
        if (startSpin) startSpin.onclick = function () {
          safeEmit("spinBottleStart", {});
          var m = get("activitiesModal"); if (m) m.style.display = "none";
          showToast("Spinning the bottle...");
        };

        var optA = get("optA");
        var optB = get("optB");
        if (optA) optA.onclick = function () { submitTwoOptionAnswer("A"); };
        if (optB) optB.onclick = function () { submitTwoOptionAnswer("B"); };

        var closeTwoRes = get("closeTwoRes");
        if (closeTwoRes) closeTwoRes.onclick = function () { var r = get("twoOptionResultModal"); if (r) r.style.display = "none"; };

        var spinDone = get("spinDone");
        var spinSkip = get("spinSkip");
        if (spinDone) spinDone.onclick = function () { var sm = get("spinModal"); if (sm) sm.style.display = "none"; safeEmit("spinBottleDone", {}); };
        if (spinSkip) spinSkip.onclick = function () { var sm = get("spinModal"); if (sm) sm.style.display = "none"; safeEmit("spinBottleSkip", {}); };

        // NEW ACTIVITIES BUTTONS
        var startRapid = get("startRapidFire");
        if (startRapid) startRapid.onclick = function () {
          safeEmit("rapidFireStart", {});
          var m = get("activitiesModal"); if (m) m.style.display = "none";
        };

        var endRapid = get("endRapidFire");
        if (endRapid) endRapid.onclick = function () {
          safeEmit("rapidFireEnd", {});
          var m = get("rapidFireModal"); if (m) m.style.display = "none";
        };

        var startMirror = get("startMirror");
        if (startMirror) startMirror.onclick = function () {
          safeEmit("mirrorStart", {});
          var m = get("activitiesModal"); if (m) m.style.display = "none";
        };

        var endMirror = get("endMirror");
        if (endMirror) endMirror.onclick = function () {
          safeEmit("mirrorEnd", {});
          var m = get("mirrorModal"); if (m) m.style.display = "none";
        };

        var startStaring = get("startStaring");
        if (startStaring) startStaring.onclick = function () {
          safeEmit("staringStart", {});
          var m = get("activitiesModal"); if (m) m.style.display = "none";
        };

        var iBlinked = get("iBlinked");
        if (iBlinked) iBlinked.onclick = function () {
          safeEmit("staringBlink", { who: "self" });
        };

        var endStaring = get("endStaring");
        if (endStaring) endStaring.onclick = function () {
          safeEmit("staringEnd", {});
          var m = get("staringModal"); if (m) m.style.display = "none";
        };

        var startLyrics = get("startLyrics");
        if (startLyrics) startLyrics.onclick = function () {
          safeEmit("lyricsStart", {});
          var m = get("activitiesModal"); if (m) m.style.display = "none";
        };

        var showLyricsAnswer = get("showLyricsAnswer");
        if (showLyricsAnswer) showLyricsAnswer.onclick = function () {
          safeEmit("lyricsReveal", {});
        };

        var nextLyrics = get("nextLyrics");
        if (nextLyrics) nextLyrics.onclick = function () {
          safeEmit("lyricsNext", {});
        };

        var endLyrics = get("endLyrics");
        if (endLyrics) endLyrics.onclick = function () {
          safeEmit("lyricsEnd", {});
          var m = get("lyricsModal"); if (m) m.style.display = "none";
        };

        var startDance = get("startDance");
        if (startDance) startDance.onclick = function () {
          safeEmit("danceStart", {});
          var m = get("activitiesModal"); if (m) m.style.display = "none";
        };

        var skipDance = get("skipDance");
        if (skipDance) skipDance.onclick = function () {
          safeEmit("danceSkip", {});
        };

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
  }, []);

  function escapeHtml(s) { return String(s).replace(/[&<>\"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]); }

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

      {/* Activities Modal - UPDATED WITH NEW ACTIVITIES */}
      <div id="activitiesModal" className="overlay-modal" style={{display:'none'}}>
        <div className="modal-card wide">
          <button id="activitiesClose" className="modal-close">×</button>
          <h3>🎮 Fun Activities</h3>
          <div className="activities-grid">
            
            <div className="act-card">
              <div className="act-icon">❓</div>
              <h4>Two-Option Quiz</h4>
              <p>Answer quick two-choice questions privately. Reveal together and get love %!</p>
              <button id="startTwoOption" className="act-btn">Start Quiz</button>
            </div>

            <div className="act-card">
              <div className="act-icon">🎯</div>
              <h4>Truth & Dare</h4>
              <p>Spin a virtual bottle. When it lands, selected person does truth or dare challenge.</p>
              <button id="startSpin" className="act-btn">Spin Bottle</button>
            </div>

            <div className="act-card">
              <div className="act-icon">⚡</div>
              <h4>Rapid Fire Questions</h4>
              <p>60 seconds of quick questions! Fast-paced and funny.</p>
              <button id="startRapidFire" className="act-btn">Start Rapid Fire</button>
            </div>

            <div className="act-card">
              <div className="act-icon">🪞</div>
              <h4>Mirror Challenge</h4>
              <p>Copy each other's movements! One leads, one follows.</p>
              <button id="startMirror" className="act-btn">Start Mirror</button>
            </div>

            <div className="act-card">
              <div className="act-icon">👀</div>
              <h4>Staring Contest</h4>
              <p>Don't blink, don't laugh! First to blink loses.</p>
              <button id="startStaring" className="act-btn">Start Staring</button>
            </div>

            <div className="act-card">
              <div className="act-icon">🎤</div>
              <h4>Finish the Lyrics</h4>
              <p>Complete the Bollywood hit! Sing together.</p>
              <button id="startLyrics" className="act-btn">Start Lyrics</button>
            </div>

            <div className="act-card">
              <div className="act-icon">💃</div>
              <h4>Dance Dare</h4>
              <p>15 seconds of fun dance moves!</p>
              <button id="startDance" className="act-btn">Start Dance</button>
            </div>

          </div>
        </div>
      </div>

      {/* EXISTING MODALS */}
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
          <div className="mirror-role big-text">👑 LEADER</div>
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
            <button id="quitBtn">Quit</button>
            <button id="newPartnerBtn">Search New Partner</button>
          </div>
          <div className="emoji-container" aria-hidden="true"></div>
        </div>
      </div>

      <div id="toast"></div>

      <style jsx global>{`
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
        #toast{position:fixed;left:50%;bottom:calc(110px + env(safe-area-inset-bottom));transform:translateX(-50%);background:#111;color:#fff;padding:10px 14px;border-radius:8px;display:none;z-index:5000;border:1px solid rgba(255,255,255,.08)}

        .watermark-badge{position:absolute;right:14px;bottom:14px;z-index:40;display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:26px;background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));color: rgba(255,255,255,0.94);font-weight:800;letter-spacing:1px;font-size:14px;transform: rotate(-12deg);box-shadow: 0 8px 30px rgba(0,0,0,0.6);backdrop-filter: blur(6px) saturate(1.1);-webkit-backdrop-filter: blur(6px) saturate(1.1);transition: transform .18s ease, opacity .18s ease;opacity: 0.95;pointer-events: none;}
        .watermark-badge.small{ font-size:12px; padding:6px 10px; right:10px; bottom:10px; transform: rotate(-10deg) scale(0.92); }
        .watermark-badge span{ display:inline-block; transform: translateY(-1px); }
        .watermark-badge .reel-dot{display:inline-block;width:10px;height:10px;border-radius:50%;background: linear-gradient(45deg,#ff6b8a,#ffd166);box-shadow:0 6px 14px rgba(255,107,138,0.14), inset 0 -2px 6px rgba(0,0,0,0.15);transform: translateY(0) rotate(0);}
        .video-box:hover .watermark-badge{ transform: translateX(-4px) rotate(-10deg); opacity:1; }
        @keyframes badge-breath { 0%{ transform: rotate(-12deg) scale(0.995) } 50%{ transform: rotate(-12deg) scale(1.01) } 100%{ transform: rotate(-12deg) scale(0.995) } }
        .watermark-badge{ animation: badge-breath 4.5s ease-in-out infinite; }

        .overlay-modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.75);z-index:4500;backdrop-filter:blur(4px)}
        .modal-card{background:linear-gradient(180deg, rgba(20,20,25,0.98), rgba(15,15,20,0.98));padding:24px;border-radius:16px;min-width:320px;max-width:90vw;color:#fff;border:1px solid rgba(255,255,255,.08);box-shadow:0 20px 60px rgba(0,0,0,.8);position:relative}
        .modal-card.small{min-width: min(520px, 92vw)}
        .modal-card.wide{min-width: min(800px, 92vw);max-width:95vw}
        .modal-close{position:absolute;right:12px;top:12px;background:rgba(255,255,255,0.05);border:none;color:#fff;font-size:24px;cursor:pointer;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;transition:background .2s}
        .modal-close:hover{background:rgba(255,255,255,0.1)}

        .activities-grid{display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:14px;margin-top:16px}
        .act-card{padding:16px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);transition:transform .2s, box-shadow .2s}
        .act-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.4)}
        .act-icon{font-size:32px;margin-bottom:8px}
        .act-card h4{font-size:16px;margin:8px 0 6px 0}
        .act-card p{font-size:13px;opacity:.8;margin-bottom:12px;line-height:1.4}
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
          .activities-grid{grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px}
          .modal-card.wide{min-width:90vw}
        }

        @media(max-width: 600px){
          .activities-grid{grid-template-columns:1fr;gap:10px}
          .big-text{font-size:18px}
          .big-timer{font-size:28px}
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
          .activities-grid{gap:8px}
        }

        .floating-emoji{position:absolute;font-size:32px;animation:float-up 1.4s ease-out forwards;pointer-events:none}
        @keyframes float-up{0%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-150%) scale(1.5)}}
      `}</style>
    </>
  );
}
