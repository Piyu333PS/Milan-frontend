"use client";
import { useEffect } from "react";
import io from "socket.io-client";

export default function VideoPage() {
  useEffect(() => {
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com";
    const ICE_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

    let socket = null;
    let socketConnected = false;
    let pc = null;
    let localStream = null;
    let hasOffered = false;
    let cameraTrackSaved = null;
    let isCleaning = false;

    // negotiation flags (Perfect Negotiation pattern)
    let makingOffer = false;
    let ignoreOffer = false;
    let polite = false;

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

    // get stored roomCode helper
    const getRoomCode = () => {
      try {
        var q = new URLSearchParams(window.location.search);
        return q.get("room") || sessionStorage.getItem("roomCode") || localStorage.getItem("lastRoomCode");
      } catch (e) {
        return sessionStorage.getItem("roomCode") || localStorage.getItem("lastRoomCode");
      }
    };

    // SAFE EMIT attaches roomCode automatically (if present)
    const safeEmit = (event, data = {}) => {
      try {
        if (!socket || !socket.connected) return log("safeEmit: socket not connected, skip", event);
        const roomCode = getRoomCode();
        const payload = (data && typeof data === "object") ? { ...data } : { data };
        if (roomCode && !payload.roomCode) payload.roomCode = roomCode;
        socket.emit(event, payload);
      } catch (e) { log("safeEmit err", e); }
    };

    // small tolerant parser for incoming candidate payload shapes
    const extractCandidate = (maybe) => {
      if (!maybe) return null;
      if (maybe.candidate || maybe.sdpMid || maybe.sdpMLineIndex !== undefined) return maybe;
      if (maybe.candidate && typeof maybe.candidate === "object") return maybe.candidate;
      if (maybe.candidate && typeof maybe.candidate === "string") return maybe;
      // wrapped: { candidate: {...}, from, roomCode }
      if (maybe.payload && maybe.payload.candidate) return maybe.payload.candidate;
      return null;
    };

    // --- cleanup PC only (keep localStream so user doesn't re-prompt camera)
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
      // remove remote video
      try { var rv = get("remoteVideo"); if (rv) rv.srcObject = null; } catch (e) {}
    }

    // full cleanup (when quitting)
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

    (async function start() {
      log("video page start");
      try {
        // get camera once
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

      // connect socket
      socket = io(BACKEND_URL, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 800,
        path: "/socket.io"
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

      // create peer connection
      const createPC = () => {
        if (pc) return;
        log("creating RTCPeerConnection");
        pc = new RTCPeerConnection(ICE_CONFIG);

        // prefer transceivers for stable behaviour
        try { if (typeof pc.addTransceiver === "function") { pc.addTransceiver("audio", { direction: "sendrecv" }); pc.addTransceiver("video", { direction: "sendrecv" }); } } catch (e) { log("addTransceiver failed", e); }

        // attach local tracks using senders/replaceTrack if possible
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
              // autoplay policy: attach muted, play, then restore mute
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
          }
        };

        pc.onnegotiationneeded = async () => {
          if (!socketConnected) { log("negotiation: socket not connected"); return; }
          if (makingOffer) { log("negotiationneeded: already makingOffer"); return; }
          try {
            makingOffer = true;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            safeEmit("offer", pc.localDescription);
            log("negotiationneeded: offer sent");
          } catch (err) {
            log("negotiationneeded error", err);
          } finally { makingOffer = false; }
        };
      };

      // SIGNALING HANDLERS ------------------------------------------------

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
              safeEmit("offer", pc.localDescription);
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
        createPC();
        try {
          const offerDesc = new RTCSessionDescription(offer);
          const readyForOffer = !makingOffer && (pc.signalingState === "stable" || pc.signalingState === "have-local-offer");
          ignoreOffer = !readyForOffer && !polite;
          if (ignoreOffer) { log("ignoring offer (not ready & not polite)"); return; }

          if (pc.signalingState !== "stable") {
            try { log("doing rollback to accept incoming offer"); await pc.setLocalDescription({ type: "rollback" }); } catch (e) { log("rollback failed", e); }
          }

          await pc.setRemoteDescription(offerDesc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          safeEmit("answer", pc.localDescription);
          log("answer created & sent");
        } catch (err) { log("handle offer error", err); }
      });

      socket.on("answer", async (answer) => {
        log("socket answer", answer && answer.type);
        try {
          if (!pc) createPC();
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            log("answer set as remoteDescription");
          } else {
            log("skipping answer set - wrong state:", pc.signalingState);
          }
        } catch (err) { log("set remote answer failed", err); }
      });

      
      // Robust candidate handler with retry/backoff queueing
      const pendingCandidates = [];
      let drainInProgress = false;
      const addCandidateWithRetry = async (cand) => {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
          console.log("[video] addIceCandidate success");
          return true;
        } catch (err) {
          // If remoteDescription isn't set yet, we'll queue and retry later.
          const msg = (err && err.name) ? err.name : String(err);
          if (msg.includes('InvalidStateError') || /remote description/i.test(String(err))) {
            console.warn("[video] addIceCandidate failed - remoteDescription not ready, queuing", cand);
            pendingCandidates.push(cand);
            scheduleDrain();
            return false;
          } else {
            console.warn("[video] addIceCandidate failed (non-queueable)", err, cand);
            return false;
          }
        }
      };

      const scheduleDrain = (() => {
        let timer = null;
        return () => {
          if (timer) return;
          timer = setTimeout(async () => {
            timer = null;
            await drainPendingCandidates();
          }, 250);
        };
      })();

      async function drainPendingCandidates() {
        if (!pc) return;
        if (drainInProgress) return;
        drainInProgress = true;
        try {
          if (!pendingCandidates || pendingCandidates.length === 0) return;
          console.log("[video] draining", pendingCandidates.length, "pending candidates");
          const list = pendingCandidates.splice(0, pendingCandidates.length);
          for (const cand of list) {
            try {
              // if remoteDescription isn't ready yet, re-queue
              if (!pc.remoteDescription || !pc.remoteDescription.type) {
                console.log("[video] drain: remoteDescription not ready yet, re-queueing candidate", cand);
                pendingCandidates.push(cand);
                continue;
              }
              await pc.addIceCandidate(new RTCIceCandidate(cand));
              console.log("[video] drained candidate success");
            } catch (e) {
              console.warn("[video] drained candidate failed", e, cand);
              // if still invalid state, requeue for later
              if (e && (e.name === 'InvalidStateError' || /remote description/i.test(String(e)))) {
                pendingCandidates.push(cand);
              }
            }
          }
          // if there are still pending candidates, schedule another attempt
          if (pendingCandidates.length) scheduleDrain();
        } catch (e) {
          console.warn("[video] drainPendingCandidates unexpected error", e);
        } finally {
          drainInProgress = false;
        }
      }

      socket.on("candidate", async (payload) => {
        try {
          console.log("[video] socket candidate payload:", payload);

          // Normalize different payload shapes
          const wrapper = (payload && (payload.candidate !== undefined || payload.sdpMid !== undefined || payload.sdpMLineIndex !== undefined))
                          ? payload
                          : (payload && payload.payload ? payload.payload : payload);

          let cand = null;

          if (!wrapper) {
            console.warn("[video] candidate: empty payload");
            return;
          }

          // wrapper.candidate is an object (ideal)
          if (typeof wrapper.candidate === "object" && wrapper.candidate !== null) {
            cand = wrapper.candidate;
          } else if (typeof wrapper.candidate === "string") {
            // wrapper has candidate string
            cand = { candidate: wrapper.candidate };
            if (wrapper.sdpMid) cand.sdpMid = wrapper.sdpMid;
            if (wrapper.sdpMLineIndex !== undefined) cand.sdpMLineIndex = wrapper.sdpMLineIndex;
          } else if (wrapper.candidate === null) {
            // explicit null -> ignore (end-of-candidates)
            console.log("[video] candidate: null (ignored)");
            return;
          } else if (typeof wrapper === "string") {
            // payload itself is raw candidate string
            cand = { candidate: wrapper };
          } else if (wrapper.sdpMid === null && wrapper.sdpMLineIndex === null) {
            // defensive: avoid constructing RTCIceCandidate with both null
            console.warn("[video] candidate has null sdpMid & sdpMLineIndex — ignoring");
            return;
          } else {
            // fallback: treat wrapper as candidate-like object
            cand = wrapper;
          }

          if (!cand) {
            console.warn("[video] could not parse candidate payload — skipping", payload);
            return;
          }

          // ensure RTCPeerConnection exists
          if (!pc) {
            console.log("[video] no RTCPeerConnection yet, creating one before adding candidate");
            if (typeof createPC === "function") createPC();
            else { console.warn("[video] createPC not found"); }
          }

          // Try to add immediately; if it fails due to remoteDescription, it will be queued by addCandidateWithRetry
          await addCandidateWithRetry(cand);
        } catch (err) {
          console.error("[video] candidate handler unexpected error", err);
        }
      });
      // ---- END CANDIDATE HANDLER ----
});

      socket.on("waitingForPeer", (d) => { log("waitingForPeer", d); showToast("Waiting for partner..."); });
      socket.on("partnerDisconnected", () => { log("partnerDisconnected"); showToast("Partner disconnected"); showRating(); cleanupPeerConnection(); });
      socket.on("partnerLeft", () => { log("partnerLeft"); showToast("Partner left"); showRating(); cleanupPeerConnection(); });
      socket.on("errorMessage", (e) => { console.warn("server errorMessage:", e); showToast(e && e.message ? e.message : "Server error"); });

      // extras: games/events handlers kept as-is...
      // (omitted here for brevity but leave your existing handlers for newQuestion, tdStarted, etc.)

      // small delay wire UI controls (existing approach)
      setTimeout(() => {
        // mic toggle
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

        // camera toggle
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

        // screen share
        var screenBtn = get("screenShareBtn");
        if (screenBtn) {
          screenBtn.onclick = async function () {
            if (!pc) return showToast("No connection");
            try {
              var screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
              var screenTrack = screen && screen.getVideoTracks ? screen.getVideoTracks()[0] : null;
              var sender = pc.getSenders ? pc.getSenders().find(s => s && s.track && s.track.kind === "video") : null;
              if (!sender) { showToast("No video sender found"); screenTrack && screenTrack.stop && screenTrack.stop(); return; }

              var saved = localStream && localStream.getVideoTracks && localStream.getVideoTracks()[0];
              cameraTrackSaved = saved || cameraTrackSaved;
              try { await sender.replaceTrack(screenTrack); } catch (e) { try { pc.addTrack(screenTrack, screen); } catch (e2) { log("replace/add screen track failed", e2); } }
              screenBtn.classList.add("active");
              showToast("Screen sharing");

              screenTrack.onended = async function () {
                try {
                  var cam = cameraTrackSaved;
                  if (!cam || cam.readyState === "ended") {
                    try {
                      var fresh = await navigator.mediaDevices.getUserMedia({ video: true });
                      cam = fresh.getVideoTracks()[0];
                      if (localStream) {
                        var prev = localStream.getVideoTracks()[0];
                        try { prev && prev.stop(); } catch (e) {}
                        try { localStream.removeTrack && localStream.removeTrack(prev); } catch (e) {}
                        try { localStream.addTrack && localStream.addTrack(cam); } catch (e) {}
                        var lv = get("localVideo");
                        if (lv) lv.srcObject = localStream;
                      }
                      cameraTrackSaved = cam;
                    } catch (err) { console.warn("Couldn't reacquire camera after screen share ended", err); }
                  }
                  if (sender && cam) { try { await sender.replaceTrack(cam); } catch (err) { log("restore camera via replaceTrack failed", err); } showToast("Screen sharing stopped — camera restored"); }
                  else { showToast("Screen sharing stopped"); }
                } catch (err) { console.error("Error restoring camera after screen end", err); showToast("Stopped screen sharing"); }
                finally { screenBtn.classList.remove("active"); }
              };
            } catch (e) { console.warn("Screen share cancelled / error", e); showToast("Screen share cancelled"); }
          };
        }

        // disconnect button — call partnerLeft with roomCode
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

        // hearts rating wiring (keep as-is)
        var hearts = document.querySelectorAll("#ratingOverlay .hearts i");
        for (var hi = 0; hi < hearts.length; hi++) {
          (function (h) {
            h.addEventListener("click", function () {
              var val = parseInt(h.getAttribute("data-value"));
              for (var q = 0; q < hearts.length; q++) hearts[q].classList.remove("selected");
              for (var r = 0; r < val; r++) hearts[r].classList.add("selected");
              // simple emoji animation
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
      }, 800);

    })();

    // on unmount
    return function () { cleanup(); };
  }, []);

  // escape helper
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]); }

  // UI (same as before) - omitted here for brevity, reuse original JSX from your file
  // But make sure video id="remoteVideo" and id="localVideo" remain.

  return (
    <>
      {/* copy the same JSX structure & styles from your file unchanged */}
      {/* For brevity in this message I kept UI identical; paste your original JSX & CSS below this line */}
      {/* --- START UI (paste from your existing file) --- */}

      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" referrerPolicy="no-referrer" />
      <div className="video-stage">
        <div className="video-panes">
          <div className="video-box">
            <video id="remoteVideo" autoPlay playsInline></video>
            <div className="label">Partner</div>
          </div>
          <div className="video-box">
            <video id="localVideo" autoPlay playsInline muted></video>
            <div className="label">You</div>
          </div>
        </div>
      </div>

      <div className="control-bar">
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

      {/* rating overlay, modals, overlays etc. — reuse from your file */}
      {/* ... paste the rest of your JSX blocks (ratingOverlay, questionOverlay, activitiesModal, tdOverlay, rpsOverlay, loveMeterOverlay, toast, styles) unchanged ... */}

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

      {/* Keep the rest of your overlays & CSS as in the original file */}
      <div id="toast"></div>

      <style jsx global>{`
        /* paste your existing global styles here (same as original file) */
        /* ... keep unchanged ... */
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{height:100%;background:#000;font-family:'Segoe UI',sans-serif;overflow:hidden}
        .video-stage{position:relative;width:100%;height:100vh;padding-bottom:110px;background:#000;}
        .video-panes{position:absolute;left:0;right:0;top:0;bottom:110px;display:flex;gap:12px;padding:12px;}
        .video-box{position:relative;flex:1 1 50%;border-radius:14px;overflow:hidden;background:#111;border:1px solid rgba(255,255,255,.08);}
        .video-box video{width:100%;height:100%;object-fit:cover;background:#000;}
        #localVideo{ transform: scaleX(-1); }
        .label{position:absolute;left:10px;bottom:10px;padding:6px 10px;font-size:12px;color:#fff;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.15);border-radius:10px;pointer-events:none;}
        .control-bar{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);display:flex;gap:18px;padding:12px 16px;background:rgba(0,0,0,.6);border-radius:16px;z-index:3000;backdrop-filter: blur(8px);}
        .control-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;background:#18181b;color:#fff;border-radius:14px;width:68px;height:68px;cursor:pointer;}
        .control-btn.inactive{opacity:0.5}.control-btn.active{box-shadow:0 6px 18px rgba(255,77,141,0.18);transform:translateY(-2px)}.control-btn.danger{background:#9b1c2a}
        .control-btn.small{width:auto;height:auto;padding:8px 10px;border-radius:8px}
        #ratingOverlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.9);color:#fff;z-index:4000;padding:40px}
        .rating-content{position:relative;min-width: min(720px, 92vw);padding:48px 56px;border-radius:24px;text-align:center;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);box-shadow:0 20px 60px rgba(0,0,0,.55);z-index:1}
        .rating-content h2{ font-size:32px;margin-bottom:18px;letter-spacing:.3px }
        .hearts{ display:flex;gap:30px;font-size:70px;margin:26px 0 8px 0;justify-content:center;z-index:2;position:relative }
        .hearts i{ color:#777;cursor:pointer;transition:transform .18s,color .18s }
        .hearts i:hover{ transform:scale(1.2);color:#ff6fa3 }
        .hearts i.selected{ color:#ff1744 }
        .rating-buttons{ display:flex;gap:26px;margin-top:32px;justify-content:center;position:relative;z-index:2 }
        .rating-buttons button{ padding:18px 32px;font-size:20px;border-radius:16px;border:none;color:#fff;cursor:pointer;background:linear-gradient(135deg,#ff4d8d,#6a5acd);box-shadow:0 10px 28px rgba(0,0,0,.45);backdrop-filter: blur(14px);transition:transform .2s ease,opacity .2s ease }
        .rating-buttons button:hover{ transform:scale(1.06);opacity:.92 }
        .emoji-container{ position:absolute;inset:-16px; pointer-events:none;z-index:0;overflow:visible }
        .floating-emoji{ position:absolute;user-select:none }
        @keyframes fallLocal{ from{transform:translateY(-40px);opacity:1} to{transform:translateY(360px);opacity:0} }
        @keyframes flyUpLocal{ from{transform:translateY(0);opacity:1} to{transform:translateY(-360px);opacity:0} }
        @keyframes orbitCW{ from{transform:rotate(0deg) translateX(var(--r)) rotate(0deg)} to{transform:rotate(360deg) translateX(var(--r)) rotate(-360deg)} }
        @keyframes orbitCCW{ from{transform:rotate(360deg) translateX(var(--r)) rotate(-360deg)} to{transform:rotate(0deg) translateX(var(--r)) rotate(360deg)} }
        @keyframes burstLocal{ 0%{transform:scale(.6) translateY(0);opacity:1} 60%{transform:scale(1.4) translateY(-80px)} 100%{transform:scale(1) translateY(-320px);opacity:0} }
        #toast{position:fixed;left:50%;bottom:110px;transform:translateX(-50%);background:#111;color:#fff;padding:10px 14px;border-radius:8px;display:none;z-index:5000;border:1px solid rgba(255,255,255,.12)}
        .act-card{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 10px;border-radius:10px;background:rgba(255,255,255,0.02);color:#fff;border:1px solid rgba(255,255,255,0.04);cursor:pointer}
        .act-card small{color:#cbd6ef;margin-top:6px;font-size:12px}
        .act-emoji{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 16px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);cursor:pointer}
        @media(max-width: 900px){.video-panes{ flex-direction:column; } .video-box{ flex:1 1 50%; min-height: 0; }}
        @media(max-width:480px){ .video-panes{ gap:8px; padding:8px; bottom:108px; } .label{ font-size:11px; padding:5px 8px; } .control-btn{ width:62px; height:62px; } .rating-content{min-width:92vw;padding:30px 20px} .hearts{font-size:46px;gap:18px} .rating-buttons{gap:16px} .rating-buttons button{padding:14px 18px;font-size:16px;border-radius:14px} }
      `}</style>
    </>
  );
}
