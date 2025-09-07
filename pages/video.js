"use client";
import { useEffect } from "react";
import io from "socket.io-client";

export default function VideoPage() {
  useEffect(() => {
    const BACKEND_URL = "https://milan-j9u9.onrender.com";
    const ICE_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

    let socket = null;
    let pc = null;
    let localStream = null;
    let hasOffered = false;
    let cameraTrackSaved = null;

    const get = (id) => document.getElementById(id);
    const showToast = (msg, ms = 2000) => {
      const t = get("toast");
      if (!t) return;
      t.textContent = msg;
      t.style.display = "block";
      setTimeout(() => (t.style.display = "none"), ms);
    };

    const showRating = () => {
      const r = get("ratingOverlay");
      if (r) r.style.display = "flex";
    };

    const triggerRatingAnimation = (rating) => {
      const container = document.querySelector("#ratingOverlay .emoji-container");
      if (!container) return;
      const emojiMap = { 1: ["😐"], 2: ["🙂"], 3: ["😊"], 4: ["😍"], 5: ["😍", "🥰", "❤️"] };
      const emojis = emojiMap[rating] || ["❤️"];
      const count = rating === 5 ? 28 : 18;
      const containerRect = container.getBoundingClientRect();
      for (let i = 0; i < count; i++) {
        const e = document.createElement("div");
        e.className = "floating-emoji";
        e.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        const x = Math.random() * containerRect.width;
        const y = Math.random() * containerRect.height;
        e.style.left = `${x}px`;
        e.style.top = `${y}px`;
        e.style.fontSize = 24 + Math.random() * 26 + "px";
        container.appendChild(e);
        if (rating === 1 || rating === 2) {
          e.style.animation = `fallLocal ${2 + Math.random() * 1.8}s linear`;
        } else if (rating === 3) {
          const r = 80 + Math.random() * 120;
          const dir = Math.random() > 0.5 ? "orbitCW" : "orbitCCW";
          e.style.setProperty("--r", `${r}px`);
          e.style.animation = `${dir} ${3 + Math.random() * 2}s linear`;
        } else if (rating === 4) {
          e.style.animation = `flyUpLocal ${3 + Math.random() * 2}s ease-out`;
        } else if (rating === 5) {
          e.style.animation = `burstLocal ${3 + Math.random() * 2}s ease-in-out`;
        }
        setTimeout(() => e.remove(), 4200);
      }
    };

    const cleanup = () => {
      try { socket?.disconnect(); } catch {}
      try {
        pc?.getSenders()?.forEach((s) => s.track && s.track.stop());
        pc?.close();
      } catch {}
      pc = null;
      localStream = null;
      hasOffered = false;
    };

    (async function start() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        cameraTrackSaved = localStream?.getVideoTracks()?.[0] || null;
        const lv = get("localVideo");
        if (lv) {
          lv.srcObject = localStream;
          lv.muted = true;
          lv.play().catch((e) => console.warn("Local video play error:", e));
        }
      } catch (err) {
        console.error("❌ Camera/Mic error:", err);
        showToast("Camera/Mic access needed");
        return;
      }

      socket = io(BACKEND_URL, { transports: ["websocket"] });

      socket.on("connect", () => {
        const token = localStorage.getItem("token");
        const roomCode = sessionStorage.getItem("roomCode");
        socket.emit("joinVideo", { token, roomCode });
      });

      const createPC = () => {
        if (pc) return;
        pc = new RTCPeerConnection(ICE_CONFIG);
        localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream));

        pc.ontrack = (e) => {
          const rv = get("remoteVideo");
          if (rv && e.streams && e.streams[0]) {
            rv.srcObject = e.streams[0];
          }
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) socket.emit("candidate", e.candidate);
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
            showToast("Partner disconnected");
            showRating();
            const rv = get("remoteVideo");
            if (rv) rv.srcObject = null;
            cleanup();
          }
        };
      };

      socket.on("ready", async () => {
        createPC();
        if (!hasOffered && pc.signalingState === "stable") {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("offer", offer);
            hasOffered = true;
          } catch (err) { console.error("Offer error:", err); }
        }
      });

      socket.on("offer", async (offer) => {
        createPC();
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", answer);
      });

      socket.on("answer", async (answer) => {
        if (!pc) createPC();
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      });

      socket.on("candidate", async (candidate) => {
        if (!pc) createPC();
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (err) {
          console.error("Error adding candidate:", err);
        }
      });

      socket.on("partnerDisconnected", () => {
        showToast("Partner disconnected");
        showRating();
        const rv = get("remoteVideo");
        if (rv) rv.srcObject = null;
        cleanup();
      });

      socket.on("partnerLeft", () => {
        showToast("Partner left");
        showRating();
        const rv = get("remoteVideo");
        if (rv) rv.srcObject = null;
        cleanup();
      });
    })();

    const micBtn = get("micBtn");
    if (micBtn) {
      micBtn.onclick = () => {
        const t = localStream?.getAudioTracks()[0];
        if (!t) return;
        t.enabled = !t.enabled;
        micBtn.classList.toggle("inactive", !t.enabled);
        const i = micBtn.querySelector("i");
        if (i) i.className = t.enabled ? "fas fa-microphone" : "fas fa-microphone-slash";
        showToast(t.enabled ? "Mic On" : "Mic Off");
      };
    }

    const camBtn = get("camBtn");
    if (camBtn) {
      camBtn.onclick = () => {
        const t = localStream?.getVideoTracks()[0];
        if (!t) return;
        t.enabled = !t.enabled;
        camBtn.classList.toggle("inactive", !t.enabled);
        const i = camBtn.querySelector("i");
        if (i) i.className = t.enabled ? "fas fa-video" : "fas fa-video-slash";
        showToast(t.enabled ? "Camera On" : "Camera Off");
      };
    }

    const screenBtn = get("screenShareBtn");
    if (screenBtn) {
      screenBtn.onclick = async () => {
        if (!pc) return showToast("No connection");
        try {
          const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
          const screenTrack = screen.getVideoTracks()[0];
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
          if (!sender) { screenTrack.stop(); return showToast("No video sender found"); }
          cameraTrackSaved = localStream?.getVideoTracks()?.[0] || cameraTrackSaved;
          await sender.replaceTrack(screenTrack);
          screenBtn.classList.add("active");
          showToast("Screen sharing");
          screenTrack.onended = async () => {
            try {
              let cam = cameraTrackSaved;
              if (!cam || cam.readyState === "ended") {
                const fresh = await navigator.mediaDevices.getUserMedia({ video: true });
                cam = fresh.getVideoTracks()[0];
                if (localStream) {
                  const prev = localStream.getVideoTracks()[0];
                  prev && prev.stop();
                  localStream.removeTrack(prev);
                  localStream.addTrack(cam);
                  const lv = get("localVideo");
                  if (lv) lv.srcObject = localStream;
                }
                cameraTrackSaved = cam;
              }
              if (sender && cam) await sender.replaceTrack(cam);
              showToast("Screen sharing stopped — camera restored");
            } catch { showToast("Stopped screen sharing"); }
            finally { screenBtn.classList.remove("active"); }
          };
        } catch { showToast("Screen share cancelled"); }
      };
    }

    const disconnectBtn = get("disconnectBtn");
    if (disconnectBtn) {
      disconnectBtn.onclick = () => {
        try { socket?.emit("partnerLeft"); } catch {}
        cleanup();
        showRating();
      };
    }

    const quitBtn = get("quitBtn");
    if (quitBtn) {
      quitBtn.onclick = () => {
        cleanup();
        window.location.href = "/";
      };
    }

    const newPartnerBtn = get("newPartnerBtn");
    if (newPartnerBtn) {
      newPartnerBtn.onclick = () => {
        cleanup();
        window.location.href = "/connect";
      };
    }

    const hearts = document.querySelectorAll("#ratingOverlay .hearts i");
    if (hearts.length) {
      hearts.forEach((h) => {
        h.addEventListener("click", () => {
          const val = parseInt(h.getAttribute("data-value"));
          hearts.forEach((el) => el.classList.remove("selected"));
          for (let i = 0; i < val; i++) hearts[i].classList.add("selected");
          triggerRatingAnimation(val);
        });
      });
    }

    return () => cleanup();
  }, []);

  return (<>
    {/* React JSX rendering — make sure elements like micBtn, camBtn, etc. exist in DOM */}
  </>);
}
