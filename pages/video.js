// pages/video.js - patched: safer socket options, join-room fallback, proper attach & play of streams
"use client";
import { useEffect } from "react";
import io from "socket.io-client";

export default function VideoPage() {
  useEffect(() => {
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com";
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

    const log = (...args) => {
      try { console.log("[video]", ...args); } catch {}
    };

    const cleanup = () => {
      try { socket?.removeAllListeners && socket.removeAllListeners(); } catch {}
      try { socket?.disconnect && socket.disconnect(); } catch {}
      try {
        pc?.getSenders()?.forEach((s) => s.track && s.track.stop());
      } catch (e) { /* ignore */ }
      try { pc && pc.close(); } catch {}
      pc = null;
      localStream = null;
      hasOffered = false;
    };

    (async function start() {
      try {
        // Request camera & mic (muted local video allows autoplay)
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        cameraTrackSaved = localStream?.getVideoTracks()?.[0] || null;

        const lv = get("localVideo");
        if (lv) {
          try {
            lv.muted = true; // important to allow autoplay
            lv.playsInline = true;
            lv.autoplay = true;
            lv.srcObject = localStream;
            await lv.play().catch((e) => log("Local video play error (non-fatal):", e));
          } catch (e) {
            log("local video attach/play issue:", e);
          }
        } else {
          log("localVideo element not found in DOM");
        }
      } catch (err) {
        console.error("❌ Camera/Mic error:", err);
        showToast("Camera/Mic access needed");
        return;
      }

      // socket: use websocket + polling fallback and reconnection
      socket = io(BACKEND_URL, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 800,
        path: "/socket.io",
      });

      socket.on("connect", () => {
        log("socket connected", socket.id);
        // roomCode: try URL param -> sessionStorage -> localStorage
        let roomCode = null;
        try {
          const q = new URLSearchParams(window.location.search);
          roomCode = q.get("room") || sessionStorage.getItem("roomCode") || localStorage.getItem("lastRoomCode");
        } catch (e) {
          roomCode = sessionStorage.getItem("roomCode") || localStorage.getItem("lastRoomCode");
        }
        const token = localStorage.getItem("token") || null;
        if (!roomCode) {
          log("No roomCode found on video page - redirect to connect");
          alert("Room not found. Go to Connect and start Play & Chat.");
          window.location.href = "/connect";
          return;
        }
        socket.emit("joinVideo", { token, roomCode });
        log("joinVideo emitted", { token: !!token, roomCode });
      });

      socket.on("connect_error", (err) => {
        console.warn("socket connect_error:", err);
        showToast("Connection error (socket).");
      });
      socket.on("disconnect", (reason) => {
        log("socket disconnected:", reason);
      });

      const createPC = () => {
        if (pc) return;
        pc = new RTCPeerConnection(ICE_CONFIG);
        try {
          localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream));
        } catch (e) {
          log("Error adding local tracks to pc:", e);
        }

        pc.ontrack = (e) => {
          try {
            const rv = get("remoteVideo");
            if (!rv) {
              log("remoteVideo element not found");
              return;
            }
            const stream = (e.streams && e.streams[0]) || new MediaStream([e.track]);
            rv.srcObject = stream;
            rv.playsInline = true;
            rv.autoplay = true;
            rv.muted = false;
            rv.play().catch((err) => {
              log("remoteVideo play() rejection (might be autoplay policy):", err);
            });
            log("ontrack attached remote stream", stream);
          } catch (err) {
            console.error("ontrack attach error", err);
          }
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            try {
              socket.emit("candidate", e.candidate);
            } catch (ex) { log("emit candidate err", ex); }
          }
        };

        pc.onconnectionstatechange = () => {
          log("pc connectionState:", pc.connectionState);
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
        log("socket ready -> creating PC and offering");
        createPC();
        try {
          if (!hasOffered && pc.signalingState === "stable") {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("offer", offer);
            hasOffered = true;
            log("offer sent");
          } else {
            log("skipping offer (hasOffered or signalingState not stable)", { hasOffered, signalingState: pc?.signalingState });
          }
        } catch (err) {
          console.error("Offer error:", err);
        }
      });

      socket.on("offer", async (offer) => {
        log("received offer");
        createPC();
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("answer", answer);
          log("answer sent");
        } catch (err) {
          console.error("Handling offer error:", err);
        }
      });

      socket.on("answer", async (answer) => {
        log("received answer");
        try {
          if (!pc) createPC();
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error("Setting remote answer failed:", err);
        }
      });

      socket.on("candidate", async (candidate) => {
        log("received candidate");
        try {
          if (!pc) createPC();
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("addIceCandidate error:", err);
        }
      });

      socket.on("partnerDisconnected", () => {
        log("signal: partnerDisconnected");
        showToast("Partner disconnected");
        showRating();
        const rv = get("remoteVideo");
        if (rv) rv.srcObject = null;
        cleanup();
      });

      socket.on("partnerLeft", () => {
        log("signal: partnerLeft");
        showToast("Partner left");
        showRating();
        const rv = get("remoteVideo");
        if (rv) rv.srcObject = null;
        cleanup();
      });
    })();

    // Mute / cam / screen share / disconnect UI handlers
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
                  try {
                    // removeTrack/addTrack not supported everywhere; update local stream object
                    // simple approach: replace srcObject with new stream
                    localStream.removeTrack && localStream.removeTrack(prev);
                    localStream.addTrack && localStream.addTrack(cam);
                    const lv = get("localVideo");
                    if (lv) lv.srcObject = localStream;
                  } catch (e) { log("error swapping camera track", e); }
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

    return () => cleanup();
  }, []);

  return (
    <>
      {/* Placeholders — make sure your page HTML has elements with these ids: localVideo, remoteVideo, toast, ratingOverlay etc. */}
      <div id="videoPage">
        <div style={{ display: "flex", gap: 12 }}>
          <video id="remoteVideo" style={{ width: 560, height: 420, background: "#000" }} playsInline autoPlay />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <video id="localVideo" style={{ width: 160, height: 120, background: "#000" }} muted playsInline autoPlay />
            <div id="controls">
              <button id="micBtn">Mic</button>
              <button id="camBtn">Cam</button>
              <button id="screenShareBtn">Share</button>
              <button id="disconnectBtn">Disconnect</button>
              <button id="newPartnerBtn">New Partner</button>
            </div>
          </div>
        </div>

        <div id="toast" style={{ display: "none", position: "fixed", bottom: 18, left: 18, padding: "8px 12px", background: "#fff", color: "#111", borderRadius: 8 }} />
        <div id="ratingOverlay" style={{ display: "none" }}>
          <div className="emoji-container" />
        </div>
      </div>
      <style jsx>{`
        /* minimal styling for placeholders */
        #controls button { margin-right: 8px; padding: 6px 8px; }
      `}</style>
    </>
  );
}
