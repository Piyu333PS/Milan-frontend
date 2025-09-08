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
    let polite = false; // server will tell us who is polite — default false until 'ready' arrives

    const get = function (id) { return document.getElementById(id); };
    const showToast = function (msg, ms) {
      var t = get("toast");
      if (!t) return;
      t.textContent = msg;
      t.style.display = "block";
      setTimeout(function () { t.style.display = "none"; }, ms || 2000);
    };

    const showRating = function () {
      var r = get("ratingOverlay");
      if (r) r.style.display = "flex";
    };

    const log = function () {
      try { console.log.apply(console, ["[video]"].concat(Array.prototype.slice.call(arguments))); } catch (e) {}
    };

    // ---- SAFE EMIT helper (prevents emits when socket closing/closed) ----
    const safeEmit = function (event, data) {
      try {
        if (socket && socket.connected) {
          socket.emit(event, data);
        } else {
          log("safeEmit: socket not connected, skipping emit:", event);
        }
      } catch (e) {
        log("safeEmit error emitting", event, e);
      }
    };

    // Emoji animation (kept)
    const triggerRatingAnimation = function (rating) {
      var container = document.querySelector("#ratingOverlay .emoji-container");
      if (!container) return;

      var emojiMap = {
        1: ["😐"],
        2: ["🙂"],
        3: ["😊"],
        4: ["😍"],
        5: ["😍", "🥰", "❤️"]
      };

      var emojis = emojiMap[rating] || ["❤️"];
      var count = rating === 5 ? 28 : 18;
      var containerRect = container.getBoundingClientRect();

      for (var i = 0; i < count; i++) {
        var e = document.createElement("div");
        e.className = "floating-emoji";
        e.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        var x = Math.random() * containerRect.width;
        var y = Math.random() * containerRect.height;
        e.style.left = x + "px";
        e.style.top = y + "px";
        e.style.fontSize = (24 + Math.random() * 26) + "px";
        container.appendChild(e);

        if (rating === 1 || rating === 2) {
          e.style.animation = "fallLocal " + (2 + Math.random() * 1.8) + "s linear";
        } else if (rating === 3) {
          var rsize = 80 + Math.random() * 120;
          var dir = Math.random() > 0.5 ? "orbitCW" : "orbitCCW";
          e.style.setProperty("--r", rsize + "px");
          e.style.animation = dir + " " + (3 + Math.random() * 2) + "s linear";
        } else if (rating === 4) {
          e.style.animation = "flyUpLocal " + (3 + Math.random() * 2) + "s ease-out";
        } else if (rating === 5) {
          e.style.animation = "burstLocal " + (3 + Math.random() * 2) + "s ease-in-out";
        }

        (function (elem) { setTimeout(function () { try { elem.remove(); } catch (e) {} }, 4200); })(e);
      }
    };

    // cleanup
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

      try {
        if (pc) {
          try {
            var senders = pc.getSenders ? pc.getSenders() : [];
            senders.forEach(function (s) { try { s.track && s.track.stop(); } catch (e) {} });
            pc.close && pc.close();
          } catch (e) {}
          pc = null;
        }
      } catch (e) { log("pc cleanup err", e); }

      try {
        if (localStream) {
          localStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
        }
      } catch (e) {}

      localStream = null;
      hasOffered = false;
      cameraTrackSaved = null;
      makingOffer = false;
      ignoreOffer = false;
      setTimeout(function () { isCleaning = false; }, 300);
      if (opts.goToConnect) window.location.href = "/connect";
    };

    // start
    (async function start() {
      log("start video page");
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        var vtracks = (localStream && typeof localStream.getVideoTracks === "function") ? localStream.getVideoTracks() : [];
        cameraTrackSaved = (vtracks && vtracks.length) ? vtracks[0] : null;

        var lv = get("localVideo");
        if (lv) {
          try {
            lv.muted = true;
            lv.playsInline = true;
            lv.autoplay = true;
            lv.srcObject = localStream;
            await (lv.play && lv.play().catch(function (e) { log("Local video play warning:", e); }));
          } catch (e) { log("attach local video error", e); }
        } else {
          log("localVideo element not found");
        }
      } catch (err) {
        console.error("❌ Camera/Mic error:", err);
        showToast("Camera/Mic access needed");
        return;
      }

      socket = io(BACKEND_URL, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 800,
        path: "/socket.io"
      });

      socket.on("connect", function () {
        log("socket connected", socket.id);
        socketConnected = true;
        var roomCode = null;
        try {
          var q = new URLSearchParams(window.location.search);
          roomCode = q.get("room") || sessionStorage.getItem("roomCode") || localStorage.getItem("lastRoomCode");
        } catch (e) {
          roomCode = sessionStorage.getItem("roomCode") || localStorage.getItem("lastRoomCode");
        }
        if (!roomCode) {
          log("No roomCode found on video page, redirecting to /connect");
          showToast("Room not found. Redirecting...");
          cleanup({ goToConnect: true });
          return;
        }
        try { sessionStorage.setItem("roomCode", roomCode); localStorage.setItem("lastRoomCode", roomCode); } catch (e) {}
        var token = localStorage.getItem("token") || null;
        log("emitting joinVideo", { roomCode: roomCode, hasToken: !!token });
        safeEmit("joinVideo", { roomCode: roomCode, token: token });
      });

      socket.on("disconnect", function (reason) {
        log("socket disconnected:", reason);
        socketConnected = false;
      });

      socket.on("connect_error", function (err) { console.warn("socket connect_error:", err); showToast("Socket connect error"); });
      socket.on("connect_timeout", function () { socketConnected = false; log("socket connect_timeout"); });

      // create peer connection - stable transceivers + robust replaceTrack handling
      var createPC = function () {
        if (pc) return;
        log("creating RTCPeerConnection (stable transceivers)");
        pc = new RTCPeerConnection(ICE_CONFIG);

        try {
          if (typeof pc.addTransceiver === "function") {
            pc.addTransceiver("audio", { direction: "sendrecv" });
            pc.addTransceiver("video", { direction: "sendrecv" });
          }
        } catch (e) { log("addTransceiver failed", e); }

        try {
          var localVideoTrack = null;
          var localAudioTrack = null;
          if (localStream && typeof localStream.getVideoTracks === "function") {
            var vts = localStream.getVideoTracks();
            if (vts && vts.length) localVideoTrack = vts[0];
          }
          if (localStream && typeof localStream.getAudioTracks === "function") {
            var ats = localStream.getAudioTracks();
            if (ats && ats.length) localAudioTrack = ats[0];
          }

          var videoSender = null;
          if (typeof pc.getTransceivers === "function") {
            var tlist = pc.getTransceivers();
            for (var i = 0; i < tlist.length; i++) {
              try {
                var t = tlist[i];
                if (t && t.sender && t.sender.track && t.sender.track.kind === "video") { videoSender = t.sender; break; }
                if (t && t.receiver && t.receiver.track && t.receiver.track.kind === "video") { videoSender = t.sender; break; }
              } catch (e) {}
            }
          }
          if (!videoSender) {
            var sList = typeof pc.getSenders === "function" ? pc.getSenders() : [];
            for (var j = 0; j < sList.length; j++) {
              var s = sList[j];
              if (s && s.track && s.track.kind === "video") { videoSender = s; break; }
            }
          }

          if (localVideoTrack) {
            if (videoSender && typeof videoSender.replaceTrack === "function") {
              try { videoSender.replaceTrack(localVideoTrack).catch(function (e) { log("replaceTrack(video) failed:", e); }); } catch (e) { log("videoSender.replaceTrack threw", e); }
            } else {
              var sList2 = typeof pc.getSenders === "function" ? pc.getSenders() : [];
              var hasVideoSender = false;
              for (var k = 0; k < sList2.length; k++) {
                var ss = sList2[k];
                if (ss && ss.track && ss.track.kind === "video") { hasVideoSender = true; break; }
              }
              if (!hasVideoSender) {
                try { pc.addTrack(localVideoTrack, localStream); } catch (e) { log("addTrack(video) failed:", e); }
              } else { log("video sender exists but replaceTrack not available"); }
            }
          }

          // audio sender logic
          var audioSender = null;
          if (typeof pc.getTransceivers === "function") {
            var tlist2 = pc.getTransceivers();
            for (var ii = 0; ii < tlist2.length; ii++) {
              try {
                var tt = tlist2[ii];
                if (tt && tt.sender && tt.sender.track && tt.sender.track.kind === "audio") { audioSender = tt.sender; break; }
                if (tt && tt.receiver && tt.receiver.track && tt.receiver.track.kind === "audio") { audioSender = tt.sender; break; }
              } catch (e) {}
            }
          }
          if (!audioSender) {
            var sList3 = typeof pc.getSenders === "function" ? pc.getSenders() : [];
            for (var jj = 0; jj < sList3.length; jj++) {
              var s2 = sList3[jj];
              if (s2 && s2.track && s2.track.kind === "audio") { audioSender = s2; break; }
            }
          }

          if (localAudioTrack) {
            if (audioSender && typeof audioSender.replaceTrack === "function") {
              try { audioSender.replaceTrack(localAudioTrack).catch(function (e) { log("replaceTrack(audio) failed:", e); }); } catch (e) { log("audioSender.replaceTrack threw", e); }
            } else {
              var sList4 = typeof pc.getSenders === "function" ? pc.getSenders() : [];
              var hasAudioSender = false;
              for (var kk = 0; kk < sList4.length; kk++) {
                var s3 = sList4[kk];
                if (s3 && s3.track && s3.track.kind === "audio") { hasAudioSender = true; break; }
              }
              if (!hasAudioSender) {
                try { pc.addTrack(localAudioTrack, localStream); } catch (e) { log("addTrack(audio) failed:", e); }
              } else { log("audio sender exists but replaceTrack not available"); }
            }
          }
        } catch (e) { log("attach local tracks error:", e); }

        pc.ontrack = function (e) {
          try {
            log("pc.ontrack event", e);
            var rv = get("remoteVideo");
            var stream = (e && e.streams && e.streams[0]) ? e.streams[0] : new MediaStream([e.track]);
            if (rv) {
              rv.playsInline = true;
              rv.autoplay = true;
              // Temporarily mute to avoid autoplay rejection; unmute after successful play
              var previouslyMuted = rv.muted;
              try {
                rv.muted = true;
                if (rv.srcObject !== stream) {
                  rv.srcObject = stream;
                  rv.play && rv.play().then(function () {
                    // small delay before unmuting to avoid autoplay policy surprises
                    setTimeout(function () {
                      try { rv.muted = previouslyMuted; } catch (e) {}
                    }, 250);
                  }).catch(function (err) {
                    log("remoteVideo.play() rejected:", err);
                    try { rv.muted = previouslyMuted; } catch (e) {}
                  });
                  log("attached remote stream to remoteVideo");
                } else {
                  log("remote stream already set, skipping reattach");
                  try { rv.muted = previouslyMuted; } catch (e) {}
                }
              } catch (err) {
                log("remoteVideo attach/play error", err);
                try { rv.muted = previouslyMuted; } catch (e) {}
              }
            } else { log("remoteVideo element missing"); }

            try {
              var remoteTracks = stream && typeof stream.getVideoTracks === "function" ? stream.getVideoTracks() : [];
              if (remoteTracks && remoteTracks.length) {
                remoteTracks.forEach(function (vt) { vt.onended = function () { showToast("Partner stopped video"); }; });
              }
            } catch (err) {}
          } catch (err) { console.error("ontrack handler error", err); }
        };

        pc.onicecandidate = function (e) {
          if (e && e.candidate) {
            try {
              log("pc.onicecandidate -> sending candidate");
              safeEmit("candidate", e.candidate);
            } catch (ex) { log("emit candidate err", ex); }
          }
        };

        pc.onconnectionstatechange = function () {
          log("pc.connectionState:", pc.connectionState);
          if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
            showToast("Partner disconnected");
            showRating();
          }
        };

        // negotiationneeded guarded
        pc.onnegotiationneeded = async function () {
          if (!socketConnected) {
            log("onnegotiationneeded: socket not connected, skipping");
            return;
          }
          if (makingOffer) {
            log("onnegotiationneeded: already making offer, skipping");
            return;
          }
          try {
            makingOffer = true;
            var offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            safeEmit("offer", pc.localDescription);
            log("offer emitted (negotiationneeded)");
          } catch (err) {
            log("negotiation error", err);
            try {
              var name = err && err.name ? err.name : "";
              var msg = String(err || "");
              if (name === "InvalidAccessError" || /order of m-lines/i.test(msg)) {
                log("m-line order error detected — attempting gentle recovery");
                try { pc.close(); } catch (e) {}
                pc = null;
                createPC();
                try {
                  makingOffer = true;
                  var offer2 = await pc.createOffer();
                  await pc.setLocalDescription(offer2);
                  safeEmit("offer", pc.localDescription);
                } catch (e2) { log("retry offer failed:", e2); showToast("Connection hiccup. Please try reconnecting."); } finally { makingOffer = false; }
              }
            } catch (recErr) { log("recovery attempt failed:", recErr); }
          } finally { makingOffer = false; }
        };
      };

      // signaling handlers
      socket.on("ready", async function (data) {
        log("socket: ready", data);

        // read polite flag from server if provided
        try {
          if (data && typeof data.polite !== "undefined") {
            polite = !!data.polite;
            log("polite flag set by server:", polite);
          } else {
            log("no polite flag from server - polite remains:", polite);
          }
        } catch (e) {
          log("setting polite flag err", e);
        }

        createPC();
        try {
          if (!hasOffered && pc && pc.signalingState === "stable" && !makingOffer) {
            log("creating offer (ready)");
            try {
              makingOffer = true;
              var off = await pc.createOffer();
              await pc.setLocalDescription(off);
              safeEmit("offer", pc.localDescription);
              hasOffered = true;
              log("offer emitted");
            } catch (e) { log("ready-offer error", e); } finally { makingOffer = false; }
          } else {
            log("skipped offer: hasOffered or signalingState != stable", { hasOffered: hasOffered, signalingState: pc ? pc.signalingState : null, makingOffer: makingOffer });
          }
        } catch (err) { console.error("Offer error:", err); }
      });

      // OFFER handler with polite + rollback handling
      socket.on("offer", async function (offer) {
        log("socket: offer received", offer && offer.type);
        createPC();
        try {
          var offerDesc = new RTCSessionDescription(offer);

          var readyForOffer = !makingOffer && (pc.signalingState === "stable" || pc.signalingState === "have-local-offer");
          ignoreOffer = !readyForOffer && !polite;
          if (ignoreOffer) {
            log("Ignoring offer because not ready and not polite");
            return;
          }

          // If we are in a state that prevents setRemoteDescription, attempt rollback first (polite side)
          if (pc.signalingState !== "stable") {
            try {
              log("signalingState not stable, attempting rollback to accept incoming offer");
              await pc.setLocalDescription({ type: "rollback" });
              log("rollback succeeded");
            } catch (e) {
              log("rollback failed (may not be supported)", e);
            }
          }

          await pc.setRemoteDescription(offerDesc);
          var answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          safeEmit("answer", pc.localDescription);
          log("answer created & emitted");
        } catch (err) {
          log("Handling offer error:", err);
        }
      });

      // ANSWER handler - only set when we have-local-offer (guarded)
      socket.on("answer", async function (answer) {
        log("socket: answer received", answer && answer.type);
        try {
          if (!pc) createPC();
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            log("remoteDescription set (answer)");
          } else {
            log("Skipping setRemoteDescription for answer - wrong state:", pc.signalingState);
          }
        } catch (err) { console.error("Setting remote answer failed:", err); }
      });

      socket.on("candidate", async function (candidate) {
        log("socket: candidate received");
        try {
          if (!pc) createPC();
          if (candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
              log("candidate added");
            } catch (errCandidate) {
              log("addIceCandidate failed:", errCandidate);
            }
          } else { log("received null candidate"); }
        } catch (err) { console.error("addIceCandidate error:", err); }
      });

      socket.on("waitingForPeer", function (d) { log("waitingForPeer", d); showToast("Waiting for partner..."); });
      socket.on("partnerDisconnected", function () { log("socket: partnerDisconnected"); showToast("Partner disconnected"); showRating(); var rv = get("remoteVideo"); if (rv) rv.srcObject = null; });
      socket.on("partnerLeft", function () { log("socket: partnerLeft"); showToast("Partner left"); showRating(); var rv2 = get("remoteVideo"); if (rv2) rv2.srcObject = null; });
      socket.on("errorMessage", function (e) { console.warn("server errorMessage:", e); });
      socket.on("connect_error", function (err) { console.warn("socket connect_error event:", err); });
    })();

    // Controls (unchanged)
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
        try {
          var screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
          var screenTrack = screen && screen.getVideoTracks ? screen.getVideoTracks()[0] : null;
          var sender = pc.getSenders ? pc.getSenders().find(function (s) { return s && s.track && s.track.kind === "video"; }) : null;
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

    var disconnectBtn = get("disconnectBtn");
    if (disconnectBtn) {
      disconnectBtn.onclick = function () { try { safeEmit("partnerLeft"); } catch (e) {} ; cleanup(); showRating(); };
    }

    var quitBtn = get("quitBtn");
    if (quitBtn) quitBtn.onclick = function () { cleanup(); window.location.href = "/"; };

    var newPartnerBtn = get("newPartnerBtn");
    if (newPartnerBtn) newPartnerBtn.onclick = function () { cleanup(); window.location.href = "/connect"; };

    // hearts binding
    var hearts = document.querySelectorAll("#ratingOverlay .hearts i");
    for (var hi = 0; hi < hearts.length; hi++) {
      (function (h) {
        h.addEventListener("click", function () {
          var val = parseInt(h.getAttribute("data-value"));
          for (var q = 0; q < hearts.length; q++) hearts[q].classList.remove("selected");
          for (var r = 0; r < val; r++) hearts[r].classList.add("selected");
          triggerRatingAnimation(val);
        });
      })(hearts[hi]);
    }

    return function () { cleanup(); };
  }, []);

  return (
    <>
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
        <button id="disconnectBtn" className="control-btn danger" aria-label="End Call">
          <i className="fas fa-phone-slash"></i><span>End</span>
        </button>
      </div>

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
        .video-stage{position:relative;width:100%;height:100vh;padding-bottom:110px;background:#000;}
        .video-panes{position:absolute;left:0;right:0;top:0;bottom:110px;display:flex;gap:12px;padding:12px;}
        .video-box{position:relative;flex:1 1 50%;border-radius:14px;overflow:hidden;background:#111;border:1px solid rgba(255,255,255,.08);}
        .video-box video{width:100%;height:100%;object-fit:cover;background:#000;}
        #localVideo{ transform: scaleX(-1); }
        .label{position:absolute;left:10px;bottom:10px;padding:6px 10px;font-size:12px;color:#fff;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.15);border-radius:10px;pointer-events:none;}
        .control-bar{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);display:flex;gap:18px;padding:12px 16px;background:rgba(0,0,0,.6);border-radius:16px;z-index:3000;backdrop-filter: blur(8px);}
        .control-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;background:#18181b;color:#fff;border-radius:14px;width:68px;height:68px;cursor:pointer;}
        .control-btn.inactive{opacity:0.5}.control-btn.active{box-shadow:0 6px 18px rgba(255,77,141,0.18);transform:translateY(-2px)}.control-btn.danger{background:#9b1c2a}
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
        @media(max-width: 900px){.video-panes{ flex-direction:column; } .video-box{ flex:1 1 50%; min-height: 0; }}
        @media(max-width:480px){ .video-panes{ gap:8px; padding:8px; bottom:108px; } .label{ font-size:11px; padding:5px 8px; } .control-btn{ width:62px; height:62px; } .rating-content{min-width:92vw;padding:30px 20px} .hearts{font-size:46px;gap:18px} .rating-buttons{gap:16px} .rating-buttons button{padding:14px 18px;font-size:16px;border-radius:14px} }
      `}</style>
    </>
  );
}
