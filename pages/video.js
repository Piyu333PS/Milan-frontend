"use client";

import { useEffect, useState } from "react";
import io from "socket.io-client";

export default function VideoPage() {
  // AUTH GUARD STATE
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Custom modal for disconnect confirmation
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  useEffect(() => {
    // ---------- AUTH GUARD ----------
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/";
      return;
    }
    setIsAuthenticated(true);
    // ---------- END AUTH GUARD ----------

    const BACKEND_URL =
      window.BACKEND_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "https://milan-j9u9.onrender.com";
    const ICE_CONFIG = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    let socket = null;
    let socketConnected = false;
    let pc = null;
    let localStream = null;
    let cameraTrackSaved = null;

    let hasOffered = false;
    let makingOffer = false;
    let ignoreOffer = false;
    let polite = false;

    let isCleaning = false;

    const pendingCandidates = [];
    let draining = false;

    // timer vars
    let timerInterval = null;
    let timerStartTS = null;
    let elapsedBeforePause = 0;

    // Activity helpers (keep same names so existing UI works)
    let currentQuestion = null;
    let pendingAnswers = {};
    let twoOptionScore = { total: 0, matched: 0, asked: 0 };

    let rapidFireCount = 0;
    let mirrorTimer = null;
    let staringTimer = null;
    let lyricsCurrentSong = null;
    let danceInterval = null;

    const get = (id) => document.getElementById(id);
    const log = (...args) => {
      try {
        console.log("[video]", ...args);
      } catch (e) {}
    };
    const showToast = (msg, ms) => {
      const t = get("toast");
      if (!t) return;
      t.textContent = msg;
      t.style.display = "block";
      setTimeout(() => {
        t.style.display = "none";
      }, ms || 2000);
    };
    const showRating = () => {
      const r = get("ratingOverlay");
      if (r) r.style.display = "flex";
    };

    const getRoomCode = () => {
      try {
        const q = new URLSearchParams(window.location.search);
        return (
          q.get("room") ||
          sessionStorage.getItem("roomCode") ||
          localStorage.getItem("lastRoomCode")
        );
      } catch (e) {
        return (
          sessionStorage.getItem("roomCode") ||
          localStorage.getItem("lastRoomCode")
        );
      }
    };

    const safeEmit = (event, data = {}) => {
      try {
        if (!socket || !socket.connected) {
          log("safeEmit: socket not connected, skip", event);
          return;
        }
        const roomCode = getRoomCode();
        const payload =
          data && typeof data === "object" ? { ...data } : { data };
        if (roomCode && !payload.roomCode) payload.roomCode = roomCode;
        socket.emit(event, payload);
      } catch (e) {
        log("safeEmit err", e);
      }
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
              log(
                "[video] drain: remoteDescription not ready yet, re-queueing candidate",
                cand
              );
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
          setTimeout(() => {
            drainPendingCandidates();
          }, 250);
        }
      }
    };

    // ---------- TIMER HELPERS ----------
    function formatTime(ms) {
      const total = Math.floor(ms / 1000);
      const mm = String(Math.floor(total / 60)).padStart(2, "0");
      const ss = String(total % 60).padStart(2, "0");
      return `${mm}:${ss}`;
    }
    function updateTimerDisplay() {
      const el = get("callTimer");
      if (!el) return;
      const now = Date.now();
      const elapsed =
        (timerStartTS
          ? elapsedBeforePause + (now - timerStartTS)
          : elapsedBeforePause) || 0;
      el.textContent = formatTime(elapsed);
    }
    function startTimer() {
      try {
        if (timerInterval) return;
        timerStartTS = Date.now();
        updateTimerDisplay();
        timerInterval = setInterval(updateTimerDisplay, 1000);
        log("call timer started");
      } catch (e) {
        console.warn("startTimer err", e);
      }
    }
    function stopTimer(preserve = false) {
      try {
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }
        if (timerStartTS) {
          elapsedBeforePause = elapsedBeforePause + (Date.now() - timerStartTS);
        }
        timerStartTS = null;
        if (!preserve) {
          elapsedBeforePause = 0;
          const el = get("callTimer");
          if (el) el.textContent = "00:00";
        }
        log("call timer stopped", { preserve });
      } catch (e) {
        console.warn("stopTimer err", e);
      }
    }

    // ---------- PEER CONNECTION CLEANUP ----------
    function cleanupPeerConnection() {
      try {
        if (pc) {
          try {
            const senders = pc.getSenders ? pc.getSenders() : [];
            senders.forEach((s) => {
              try {
                s.track && s.track.stop && s.track.stop();
              } catch (e) {}
            });
          } catch (e) {}
          try {
            pc.close && pc.close();
          } catch (e) {}
        }
      } catch (e) {
        log("pc cleanup error", e);
      }
      pc = null;
      hasOffered = false;
      makingOffer = false;
      ignoreOffer = false;
      pendingCandidates.length = 0;
      try {
        const rv = get("remoteVideo");
        if (rv) rv.srcObject = null;
      } catch (e) {}
      stopTimer(false);
    }

    // main cleanup (leave room, stop everything)
    const cleanup = (opts = {}) => {
      if (isCleaning) return;
      isCleaning = true;
      try {
        if (socket) {
          try {
            socket.removeAllListeners && socket.removeAllListeners();
          } catch (e) {}
          try {
            socket.disconnect && socket.disconnect();
          } catch (e) {}
          socket = null;
        }
      } catch (e) {
        log("socket cleanup err", e);
      }

      cleanupPeerConnection();

      try {
        if (localStream) {
          localStream.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch (e) {}
          });
        }
      } catch (e) {}

      localStream = null;
      cameraTrackSaved = null;

      setTimeout(() => {
        isCleaning = false;
      }, 300);

      if (opts.goToConnect) window.location.href = "/connect";
    };

    // ---------- GLOBAL DISCONNECT HANDLER (for End button + rating) ----------
    if (typeof window !== "undefined") {
      window.__milanVideoDisconnect = () => {
        try {
          safeEmit("partnerLeft");
        } catch (e) {
          log("emit partnerLeft err", e);
        }
        cleanupPeerConnection();
        showRating();
      };
    }

    // ---------- CREATE PEER CONNECTION ----------
    const createPC = () => {
      if (pc) return;
      log("creating RTCPeerConnection");
      pc = new RTCPeerConnection(ICE_CONFIG);

      // add all local tracks (audio + video)
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          try {
            pc.addTrack(track, localStream);
          } catch (e) {
            log("addTrack failed", e);
          }
        });
      }

      pc.ontrack = (e) => {
        try {
          log("pc.ontrack", e);
          const rv = get("remoteVideo");
          const stream =
            e && e.streams && e.streams[0]
              ? e.streams[0]
              : new MediaStream([e.track]);
          if (rv) {
            rv.playsInline = true;
            rv.autoplay = true;
            const prevMuted = rv.muted;
            rv.muted = true;
            if (rv.srcObject !== stream) {
              rv.srcObject = stream;
              rv.play &&
                rv
                  .play()
                  .then(() => {
                    setTimeout(() => {
                      try {
                        rv.muted = prevMuted;
                      } catch (e2) {}
                    }, 250);
                  })
                  .catch((err) => {
                    log("remote play rejected", err);
                    try {
                      rv.muted = prevMuted;
                    } catch (e2) {}
                  });
            } else {
              try {
                rv.muted = prevMuted;
              } catch (e2) {}
            }
          }
        } catch (err) {
          console.error("ontrack error", err);
        }
      };

      pc.onicecandidate = (e) => {
        if (e && e.candidate) {
          log("pc.onicecandidate -> emit candidate");
          safeEmit("candidate", { candidate: e.candidate });
        }
      };

      pc.onconnectionstatechange = () => {
        log("pc.connectionState:", pc.connectionState);
        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed"
        ) {
          showToast("Partner disconnected");
          cleanupPeerConnection();
          showRating();
        }
      };

      pc.oniceconnectionstatechange = () => {
        log("pc.iceConnectionState:", pc.iceConnectionState);
        if (pc.iceConnectionState === "connected") {
          startTimer();
        } else if (
          pc.iceConnectionState === "disconnected" ||
          pc.iceConnectionState === "failed" ||
          pc.iceConnectionState === "closed"
        ) {
          stopTimer(true);
        }
      };

      pc.onnegotiationneeded = async () => {
        if (!socketConnected) {
          log("negotiation: socket not connected");
          return;
        }
        if (makingOffer) {
          log("negotiationneeded: already makingOffer");
          return;
        }
        try {
          makingOffer = true;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          safeEmit("offer", {
            type: pc.localDescription && pc.localDescription.type,
            sdp: pc.localDescription && pc.localDescription.sdp,
          });
          log("negotiationneeded: offer sent");
        } catch (err) {
          log("negotiationneeded error", err);
        } finally {
          makingOffer = false;
        }
      };
    };

    // ---------- MAIN START (getUserMedia + socket connect) ----------
    (async function start() {
      log("video page start");

      // get camera+mic
      try {
        try {
          localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } catch (err) {
          console.error("Camera/Mic error:", err);
          showToast(
            "Camera / Mic nahi mila. Please device connect karke page refresh karo."
          );
          return;
        }

        const vtracks =
          localStream && typeof localStream.getVideoTracks === "function"
            ? localStream.getVideoTracks()
            : [];
        cameraTrackSaved = vtracks && vtracks.length ? vtracks[0] : null;

        const lv = get("localVideo");
        if (lv) {
          lv.muted = true;
          lv.playsInline = true;
          lv.autoplay = true;
          lv.srcObject = localStream;
          try {
            await (lv.play && lv.play());
          } catch (e) {
            log("local video play warning", e);
          }
        } else {
          log("localVideo element not found");
        }
      } catch (err) {
        console.error("Camera/Mic error:", err);
        showToast("Camera/Mic access needed");
        return;
      }

      // socket connect
      socket = io(BACKEND_URL, {
        transports: ["polling"],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        path: "/socket.io",
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
        const t = localStorage.getItem("token") || null;
        safeEmit("joinVideo", { token: t });
      });

      socket.on("disconnect", (reason) => {
        log("socket disconnected:", reason);
        socketConnected = false;
      });

      socket.on("connect_error", (err) => {
        log("socket connect_error:", err);
        showToast("Socket connect error");
      });

      // ---------- SIGNALING ----------

      socket.on("ready", (data) => {
        log("socket ready", data);
        try {
          if (data && typeof data.polite !== "undefined")
            polite = !!data.polite;
        } catch (e) {}
        createPC();
        (async () => {
          try {
            if (
              !hasOffered &&
              pc &&
              pc.signalingState === "stable" &&
              !makingOffer
            ) {
              makingOffer = true;
              const off = await pc.createOffer();
              await pc.setLocalDescription(off);
              safeEmit("offer", {
                type: pc.localDescription && pc.localDescription.type,
                sdp: pc.localDescription && pc.localDescription.sdp,
              });
              hasOffered = true;
              log("ready: offer emitted");
            } else {
              log("ready: skipped offer", {
                hasOffered,
                signalingState: pc ? pc.signalingState : null,
              });
            }
          } catch (e) {
            log("ready-offer error", e);
          } finally {
            makingOffer = false;
          }
        })();
      });

      socket.on("offer", async (offer) => {
        log("socket offer", offer && offer.type);
        try {
          if (
            !offer ||
            typeof offer !== "object" ||
            !offer.type ||
            !offer.sdp
          ) {
            log("[video] invalid offer payload - ignoring", offer);
            return;
          }
          if (!pc) createPC();
          const offerDesc = { type: offer.type, sdp: offer.sdp };
          const readyForOffer =
            !makingOffer &&
            (pc.signalingState === "stable" ||
              pc.signalingState === "have-local-offer");
          ignoreOffer = !readyForOffer && !polite;
          if (ignoreOffer) {
            log("ignoring offer (not ready & not polite)");
            return;
          }

          if (pc.signalingState !== "stable") {
            try {
              log("doing rollback to accept incoming offer");
              await pc.setLocalDescription({ type: "rollback" });
            } catch (e) {
              log("rollback failed", e);
            }
          }

          await pc.setRemoteDescription(offerDesc);
          log("[video] remoteDescription set -> draining candidates");
          try {
            await drainPendingCandidates();
          } catch (e) {
            console.warn("[video] drain after offer failed", e);
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          safeEmit("answer", {
            type: pc.localDescription && pc.localDescription.type,
            sdp: pc.localDescription && pc.localDescription.sdp,
          });
          log("answer created & sent");
        } catch (err) {
          log("handle offer error", err);
        }
      });

      socket.on("answer", async (answer) => {
        log("socket answer", answer && answer.type);
        try {
          if (
            !answer ||
            typeof answer !== "object" ||
            !answer.type ||
            !answer.sdp
          ) {
            log("[video] invalid answer payload - ignoring", answer);
            return;
          }
          if (!pc) createPC();
          if (
            pc.signalingState === "have-local-offer" ||
            pc.signalingState === "have-remote-offer" ||
            pc.signalingState === "stable"
          ) {
            await pc.setRemoteDescription({
              type: answer.type,
              sdp: answer.sdp,
            });
            log("answer set as remoteDescription");
            try {
              await drainPendingCandidates();
            } catch (e) {
              console.warn("[video] drain after answer failed", e);
            }
          } else {
            log("skipping answer set - wrong state:", pc.signalingState);
          }
        } catch (err) {
          log("set remote answer failed", err);
        }
      });

      socket.on("candidate", async (payload) => {
        try {
          log("socket candidate payload:", payload);
          const wrapper =
            payload &&
            (payload.candidate !== undefined ||
              payload.sdpMid !== undefined ||
              payload.sdpMLineIndex !== undefined)
              ? payload
              : payload && payload.payload
              ? payload.payload
              : payload;

          if (!wrapper) {
            console.warn("[video] candidate: empty payload");
            return;
          }

          let cand = null;

          if (typeof wrapper.candidate === "object" && wrapper.candidate) {
            cand = wrapper.candidate;
          } else if (typeof wrapper.candidate === "string") {
            cand = { candidate: wrapper.candidate };
            if (wrapper.sdpMid) cand.sdpMid = wrapper.sdpMid;
            if (wrapper.sdpMLineIndex !== undefined)
              cand.sdpMLineIndex = wrapper.sdpMLineIndex;
          } else if (wrapper.candidate === null) {
            console.log("[video] candidate: null (ignored)");
            return;
          } else if (typeof wrapper === "string") {
            cand = { candidate: wrapper };
          } else {
            cand = wrapper;
          }

          if (!cand) {
            console.warn(
              "[video] could not parse candidate payload – skipping",
              payload
            );
            return;
          }

          if (!pc) {
            log(
              "[video] no RTCPeerConnection yet, creating one before adding candidate"
            );
            createPC();
          }

          if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
            log(
              "[video] remoteDescription not set yet – queueing candidate"
            );
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

      socket.on("waitingForPeer", (d) => {
        log("waitingForPeer", d);
        showToast("Waiting for partner...");
      });

      socket.on("partnerDisconnected", () => {
        log("partnerDisconnected");
        showToast("Partner disconnected");
        cleanupPeerConnection();
        showRating();
      });

      socket.on("partnerLeft", () => {
        log("partnerLeft");
        showToast("Partner left");
        cleanupPeerConnection();
        showRating();
      });

      socket.on("errorMessage", (e) => {
        console.warn("server errorMessage:", e);
        showToast(e && e.message ? e.message : "Server error");
      });

      // ----------------- (Activities handlers are same as before – keeping core ones) -----------------
      socket.on("twoOptionQuestion", (q) => {
        try {
          log("twoOptionQuestion", q);
          currentQuestion = q;
          pendingAnswers[q.questionId] = { self: null, revealed: false };
          const modal = get("twoOptionModal");
          if (!modal) {
            log("twoOptionModal missing");
            return;
          }
          modal.querySelector(".q-text").textContent = q.text || "";
          modal.querySelector("#optA").textContent = q.optionA || "A";
          modal.querySelector("#optB").textContent = q.optionB || "B";
          modal.querySelector(".q-counter").textContent = `${
            q.currentIndex || 1
          }/${q.totalQuestions || 1}`;
          modal.style.display = "flex";
          const reveal = get("twoOptionReveal");
          if (reveal) reveal.style.display = "none";
        } catch (e) {
          console.error("twoOptionQuestion handler", e);
        }
      });

      socket.on("twoOptionReveal", (payload) => {
        try {
          log("twoOptionReveal", payload);
          if (!payload || !payload.questionId) return;
          const modal = get("twoOptionModal");
          if (!modal) return;
          const reveal = get("twoOptionReveal");
          if (reveal) {
            reveal.style.display = "block";
            reveal.querySelector(".you-choice").textContent =
              payload.answers.you === "A"
                ? modal.querySelector("#optA").textContent
                : modal.querySelector("#optB").textContent;
            reveal.querySelector(".other-choice").textContent =
              payload.answers.partner === "A"
                ? modal.querySelector("#optA").textContent
                : modal.querySelector("#optB").textContent;
            const match = payload.answers.you === payload.answers.partner;
            reveal.querySelector(".match-text").textContent = match
              ? "Match! 💖 +1"
              : "Different – Opposites attract! ✨";
            if (typeof payload.matched !== "undefined") {
              twoOptionScore.asked =
                payload.totalAsked || twoOptionScore.asked;
              twoOptionScore.matched = payload.matched;
              twoOptionScore.total =
                payload.totalAsked || twoOptionScore.asked;
            }
          }
          setTimeout(() => {
            try {
              if (modal) modal.style.display = "none";
            } catch (e2) {}
          }, 2200);
        } catch (e) {
          console.error("twoOptionReveal err", e);
        }
      });

      socket.on("twoOptionResult", (res) => {
        try {
          log("twoOptionResult", res);
          const rmodal = get("twoOptionResultModal");
          if (!rmodal) return;
          rmodal.querySelector(".final-percent").textContent = `${
            res.percent || 0
          }%`;
          rmodal.querySelector(".final-text").textContent =
            res.text || "Here's your love score!";
          rmodal.style.display = "flex";
          const hearts = rmodal.querySelectorAll(".result-hearts i");
          const fillCount = Math.round(
            ((res.percent || 0) / 100) * hearts.length
          );
          for (let i = 0; i < hearts.length; i++)
            hearts[i].classList.toggle("selected", i < fillCount);
        } catch (e) {
          console.error("twoOptionResult", e);
        }
      });

      // Rapid fire, mirror, staring, lyrics, dance etc handlers can remain same as earlier version
      // (keeping this answer focused on your current issues: mic + disconnect)

      // ---------- UI WIRING ----------
      setTimeout(() => {
        // MIC BUTTON
        const micBtn = get("micBtn");
        if (micBtn) {
          micBtn.onclick = () => {
            const audioSender =
              pc &&
              pc
                .getSenders()
                .find((s) => s.track && s.track.kind === "audio");
            const t = audioSender && audioSender.track;
            if (!t) return showToast("Mic track not found in connection.");
            t.enabled = !t.enabled;
            micBtn.classList.toggle("inactive", !t.enabled);
            const i = micBtn.querySelector("i");
            if (i)
              i.className = t.enabled
                ? "fas fa-microphone"
                : "fas fa-microphone-slash";
            showToast(t.enabled ? "Mic On" : "Mic Off");
          };
        }

        // CAMERA BUTTON
        const camBtn = get("camBtn");
        if (camBtn) {
          camBtn.onclick = () => {
            const videoSender =
              pc &&
              pc
                .getSenders()
                .find((s) => s.track && s.track.kind === "video");
            const t = videoSender && videoSender.track;
            if (!t) return showToast("Camera track not found in connection.");
            t.enabled = !t.enabled;
            camBtn.classList.toggle("inactive", !t.enabled);
            const ii = camBtn.querySelector("i");
            if (ii)
              ii.className = t.enabled ? "fas fa-video" : "fas fa-video-slash";
            showToast(t.enabled ? "Camera On" : "Camera Off");
          };
        }

        // SCREEN SHARE (simplified, same as earlier logic)
        const screenBtn = get("screenShareBtn");
        if (screenBtn) {
          screenBtn.onclick = async () => {
            if (!pc) return showToast("No connection");

            const supports =
              !!(
                navigator.mediaDevices &&
                (typeof navigator.mediaDevices.getDisplayMedia === "function" ||
                  typeof navigator.getDisplayMedia === "function")
              );
            const secure = !!window.isSecureContext;
            if (!supports) {
              showToast(
                "Screen share not supported in this browser. Use Chrome."
              );
              return;
            }
            if (!secure) {
              showToast(
                "Screen share needs HTTPS. Please open secure link (https)."
              );
              return;
            }

            const sender =
              pc &&
              pc
                .getSenders()
                .find((s) => s.track && s.track.kind === "video");
            if (!sender) return showToast("No video sender found.");

            if (screenBtn.dataset.sharing === "true") {
              try {
                sender.track && sender.track.stop && sender.track.stop();
                let cam = cameraTrackSaved;
                if (!cam || cam.readyState === "ended") {
                  const freshStream =
                    await navigator.mediaDevices.getUserMedia({
                      video: true,
                    });
                  cam = freshStream.getVideoTracks()[0];
                  cameraTrackSaved = cam;
                  if (localStream) {
                    localStream.getVideoTracks().forEach((t) => t.stop());
                    localStream.addTrack(cam);
                  } else {
                    localStream = freshStream;
                  }
                }
                await sender.replaceTrack(cam);
                const lv = get("localVideo");
                if (lv) lv.srcObject = localStream;
                screenBtn.dataset.sharing = "false";
                screenBtn.classList.remove("active");
                showToast("Screen sharing stopped.");
              } catch (err) {
                console.warn("Error stopping screen share", err);
                screenBtn.dataset.sharing = "false";
                screenBtn.classList.remove("active");
              }
              return;
            }

            try {
              const tryGetDisplayMedia = async () => {
                if (
                  navigator.mediaDevices &&
                  typeof navigator.mediaDevices.getDisplayMedia === "function"
                ) {
                  return await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                  });
                }
                if (typeof navigator.getDisplayMedia === "function") {
                  return await navigator.getDisplayMedia({ video: true });
                }
                throw new Error("getDisplayMedia not supported");
              };

              const displayStream = await tryGetDisplayMedia();
              const screenTrack = displayStream.getVideoTracks()[0];

              if (!cameraTrackSaved && localStream) {
                cameraTrackSaved = localStream.getVideoTracks()[0];
              }

              await sender.replaceTrack(screenTrack);
              const lv = get("localVideo");
              if (lv) lv.srcObject = displayStream;

              screenBtn.dataset.sharing = "true";
              screenBtn.classList.add("active");
              showToast("Screen sharing active");

              screenTrack.onended = () => {
                screenBtn.onclick && screenBtn.onclick();
              };
            } catch (err) {
              log("DisplayMedia error", err);
              showToast("Screen sharing cancelled.");
            }
          };
        }

        // END / DISCONNECT BUTTON – shows confirm modal
        const disconnectBtn = get("disconnectBtn");
        if (disconnectBtn) {
          disconnectBtn.onclick = () => {
            setShowDisconnectConfirm(true);
          };
        }

        // Rating hearts (simple)
        const ratingHearts =
          document.querySelectorAll("#ratingOverlay .hearts i") || [];
        ratingHearts.forEach((h) => {
          h.onclick = () => {
            const val = Number(h.dataset.value || "0");
            ratingHearts.forEach((hh) => {
              const v = Number(hh.dataset.value || "0");
              hh.classList.toggle("selected", v <= val);
            });
          };
        });
      }, 800);
    })();

    return () => {
      cleanup();
    };
  }, []);

  // Simple HTML escape helper (kept from old file for safety if used somewhere)
  function escapeHtml(s) {
    return String(s).replace(/[&<>\"']/g, (m) => {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[m];
    });
  }

  // ---------- DISCONNECT MODAL HANDLERS ----------
  const handleConfirmDisconnect = () => {
    setShowDisconnectConfirm(false);
    if (
      typeof window !== "undefined" &&
      window.__milanVideoDisconnect
    ) {
      window.__milanVideoDisconnect();
    }
  };

  const handleKeepChatting = () => {
    setShowDisconnectConfirm(false);
  };

  // ---------- AUTH LOADING ----------
  if (!isAuthenticated) {
    return (
      <div
        style={{
          background: "#08060c",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: "24px",
          fontFamily: "Poppins, sans-serif",
        }}
      >
        <div
          className="loading-spinner-heart"
          style={{ marginRight: "10px" }}
        >
          💖
        </div>
        <style jsx global>{`
          .loading-spinner-heart {
            font-size: 3rem;
            animation: pulse 1.5s infinite;
          }
          @keyframes pulse {
            0%,
            100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.2);
            }
          }
        `}</style>
        Checking Authentication...
      </div>
    );
  }

  // ---------- MAIN JSX ----------
  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        referrerPolicy="no-referrer"
      />

      <div className="video-stage">
        <div id="callTimer" className="call-timer">
          00:00
        </div>
        <div className="video-panes">
          <div className="video-box">
            <div className="watermark-badge" aria-hidden="true">
              <span>Milan</span>
              <em className="reel-dot"></em>
            </div>
            <video id="remoteVideo" autoPlay playsInline></video>
            <div className="label">Partner</div>
          </div>
          <div className="video-box">
            <div className="watermark-badge" aria-hidden="true">
              <span>Milan</span>
              <em className="reel-dot"></em>
            </div>
            <video id="localVideo" autoPlay playsInline muted></video>
            <div className="label">You</div>
          </div>
        </div>
      </div>

      <div className="control-bar" role="toolbar" aria-label="Call controls">
        <button id="micBtn" className="control-btn" aria-label="Toggle Mic">
          <i className="fas fa-microphone"></i>
          <span>Mic</span>
        </button>
        <button id="camBtn" className="control-btn" aria-label="Toggle Camera">
          <i className="fas fa-video"></i>
          <span>Camera</span>
        </button>
        <button
          id="screenShareBtn"
          className="control-btn"
          aria-label="Share Screen"
        >
          <i className="fas fa-desktop"></i>
          <span>Share</span>
        </button>
        <button
          id="activitiesBtn"
          className="control-btn"
          aria-label="Open Fun Activities"
        >
          <i className="fas fa-gamepad"></i>
          <span>Activities</span>
        </button>
        <button
          id="disconnectBtn"
          className="control-btn danger"
          aria-label="End Call"
        >
          <i className="fas fa-phone-slash"></i>
          <span>End</span>
        </button>
      </div>

      {/* Disconnect Confirmation Modal */}
      {showDisconnectConfirm && (
        <div className="modal-overlay">
          <div className="disconnect-confirm-modal">
            <div className="modal-content">
              <div className="modal-icon">💔</div>
              <h3 className="modal-title">Wait, is this goodbye? 🥺</h3>
              <p className="modal-message">
                Are you sure you want to end this connection? You might miss a
                spark! 🔥
              </p>
              <div className="modal-actions">
                <button onClick={handleKeepChatting} className="btn-keep">
                  Keep Chatting
                </button>
                <button onClick={handleConfirmDisconnect} className="btn-end">
                  End Connection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
            <button
              id="newPartnerBtn"
              onClick={() => (window.location.href = "/connect")}
            >
              Search New Partner
            </button>
          </div>
          <div className="emoji-container" aria-hidden="true"></div>
        </div>
      </div>

      <div id="toast"></div>

      {/* Basic styles (simplified from previous version) */}
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        html,
        body {
          height: 100%;
          background: #000;
          font-family: "Segoe UI", sans-serif;
          overflow: hidden;
        }
        .video-stage {
          position: relative;
          width: 100%;
          height: 100vh;
          padding-bottom: calc(110px + env(safe-area-inset-bottom));
          background: linear-gradient(180deg, #0b0b0f 0%, #0f0610 100%);
        }
        .call-timer {
          position: absolute;
          left: 50%;
          top: 12px;
          transform: translateX(-50%);
          z-index: 10;
          background: linear-gradient(90deg, #ff7aa3, #ffb26a);
          padding: 6px 14px;
          border-radius: 999px;
          color: #fff;
          font-weight: 600;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(6px);
          font-size: 14px;
        }
        .video-panes {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          bottom: calc(110px + env(safe-area-inset-bottom));
          display: flex;
          gap: 12px;
          padding: 12px;
        }
        .video-box {
          position: relative;
          flex: 1 1 50%;
          border-radius: 14px;
          overflow: hidden;
          background: linear-gradient(180deg, #08080a, #111);
          border: 1px solid rgba(255, 255, 255, 0.04);
          min-height: 120px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
        }
        .video-box video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          background: #000;
          display: block;
        }
        #localVideo {
          transform: scaleX(-1);
        }
        .label {
          position: absolute;
          left: 10px;
          bottom: 10px;
          padding: 6px 10px;
          font-size: 12px;
          color: #fff;
          background: rgba(0, 0, 0, 0.5);
          border-radius: 10px;
        }
        .control-bar {
          position: fixed;
          bottom: calc(18px + env(safe-area-inset-bottom));
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 12px;
          padding: 8px 10px;
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.04),
            rgba(255, 255, 255, 0.02)
          );
          border-radius: 16px;
          z-index: 20;
          backdrop-filter: blur(8px);
          max-width: calc(100% - 24px);
          overflow-x: auto;
          align-items: center;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6);
        }
        .control-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.03);
          color: #fff;
          border-radius: 14px;
          width: 64px;
          height: 64px;
          cursor: pointer;
          flex: 0 0 auto;
          border: 1px solid rgba(255, 255, 255, 0.03);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .control-btn span {
          font-size: 12px;
          margin-top: 6px;
        }
        .control-btn:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 22px rgba(0, 0, 0, 0.45);
        }
        .control-btn.inactive {
          opacity: 0.5;
        }
        .control-btn.danger {
          background: linear-gradient(135deg, #ff4d8d, #b51751);
          border: none;
        }
        #ratingOverlay {
          position: fixed;
          inset: 0;
          display: none;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.9);
          color: #fff;
          z-index: 40;
          padding: 20px;
        }
        .rating-content {
          min-width: min(720px, 92vw);
          max-width: 920px;
          padding: 28px 36px;
          border-radius: 20px;
          text-align: center;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.02),
            rgba(255, 255, 255, 0.01)
          );
          border: 1px solid rgba(255, 255, 255, 0.03);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
        }
        .rating-content h2 {
          font-size: 28px;
          margin-bottom: 14px;
        }
        .hearts {
          display: flex;
          gap: 18px;
          font-size: 56px;
          margin: 22px 0 8px 0;
          justify-content: center;
        }
        .hearts i {
          color: #777;
          cursor: pointer;
          transition: transform 0.18s, color 0.18s;
        }
        .hearts i:hover {
          transform: scale(1.12);
          color: #ff6fa3;
        }
        .hearts i.selected {
          color: #ff1744;
        }
        .rating-buttons {
          display: flex;
          gap: 18px;
          margin-top: 24px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .rating-buttons button {
          padding: 14px 24px;
          font-size: 18px;
          border-radius: 14px;
          border: none;
          color: #fff;
          cursor: pointer;
          background: linear-gradient(135deg, #ff4d8d, #6a5acd);
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
        }
        #toast {
          position: fixed;
          left: 50%;
          bottom: calc(110px + env(safe-area-inset-bottom));
          transform: translateX(-50%);
          background: #111;
          color: #fff;
          padding: 10px 14px;
          border-radius: 8px;
          display: none;
          z-index: 50;
        }
        .watermark-badge {
          position: absolute;
          right: 14px;
          bottom: 14px;
          z-index: 5;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 26px;
          background: rgba(0, 0, 0, 0.4);
          color: #fff;
          font-weight: 700;
          font-size: 14px;
        }
        .watermark-badge .reel-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #ff4d8d;
        }

        /* Disconnect modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 20px;
        }
        .disconnect-confirm-modal {
          background: linear-gradient(
            145deg,
            rgba(255, 110, 167, 0.25),
            rgba(139, 92, 246, 0.2)
          );
          border: 2px solid rgba(255, 110, 167, 0.5);
          border-radius: 28px;
          padding: 2.5rem 2rem;
          max-width: 420px;
          width: 100%;
          text-align: center;
          box-shadow: 0 25px 70px rgba(255, 79, 160, 0.4),
            0 0 120px rgba(255, 20, 147, 0.25);
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
        .btn-keep,
        .btn-end {
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
        @keyframes heartBounce {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.15);
          }
        }

        @media (max-width: 768px) {
          .video-panes {
            flex-direction: column;
          }
          .rating-content {
            min-width: 0;
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
