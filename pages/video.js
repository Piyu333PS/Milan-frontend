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
    let cameraTrackSaved = null;
    let isCleaning = false;

    // negotiation flags
    let makingOffer = false;
    let ignoreOffer = false;
    const polite = true; // one peer can be polite, adjust if needed

    const get = (id) => document.getElementById(id);
    const log = (...args) => { try { console.log("[video]", ...args); } catch {} };

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

    // cleanup
    const cleanup = (opts = {}) => {
      if (isCleaning) return;
      isCleaning = true;
      try { socket?.disconnect(); } catch {}
      try { pc?.close(); } catch {}
      localStream?.getTracks()?.forEach((t) => t.stop());
      socket = null;
      pc = null;
      localStream = null;
      setTimeout(() => (isCleaning = false), 300);
      if (opts.goToConnect) window.location.href = "/connect";
    };

    (async function start() {
      // local media
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        cameraTrackSaved = localStream?.getVideoTracks()?.[0] || null;
        const lv = get("localVideo");
        if (lv) {
          lv.muted = true;
          lv.autoplay = true;
          lv.playsInline = true;
          lv.srcObject = localStream;
          await lv.play().catch((e) => log("local play warn:", e));
        }
      } catch (err) {
        console.error("❌ Camera/Mic error:", err);
        showToast("Camera/Mic access needed");
        return;
      }

      socket = io(BACKEND_URL, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 800,
        path: "/socket.io",
      });

      // peer connection factory
      const createPC = () => {
        if (pc) return;
        log("creating RTCPeerConnection");
        pc = new RTCPeerConnection(ICE_CONFIG);

        localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream));

        pc.ontrack = (e) => {
          const rv = get("remoteVideo");
          const stream = e.streams?.[0];
          if (rv && stream && rv.srcObject !== stream) {
            rv.srcObject = stream;
            rv.autoplay = true;
            rv.playsInline = true;
            rv.muted = false;
            rv.play().catch((err) => log("remote play rejected:", err));
            log("remote stream attached");
          }
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) socket.emit("candidate", e.candidate);
        };

        pc.onconnectionstatechange = () => {
          log("pc state:", pc.connectionState);
          if (["failed", "disconnected"].includes(pc.connectionState)) {
            showToast("Partner disconnected");
            showRating();
            cleanup();
          }
        };

        pc.onnegotiationneeded = async () => {
          try {
            makingOffer = true;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("offer", pc.localDescription);
            log("offer emitted (negotiationneeded)");
          } catch (err) { log("negotiation error", err); }
          finally { makingOffer = false; }
        };
      };

      socket.on("connect", () => {
        log("socket connected", socket.id);
        const roomCode = sessionStorage.getItem("roomCode") || localStorage.getItem("lastRoomCode");
        if (!roomCode) {
          showToast("Room not found. Redirecting...");
          cleanup({ goToConnect: true });
          return;
        }
        sessionStorage.setItem("roomCode", roomCode);
        localStorage.setItem("lastRoomCode", roomCode);
        socket.emit("joinVideo", { roomCode });
      });

      socket.on("offer", async (offer) => {
        createPC();
        const desc = new RTCSessionDescription(offer);
        const readyForOffer = !makingOffer && (pc.signalingState === "stable" || pc.signalingState === "have-local-offer");
        ignoreOffer = !readyForOffer && !polite;
        if (ignoreOffer) { log("ignoring offer"); return; }
        await pc.setRemoteDescription(desc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", pc.localDescription);
        log("answer sent");
      });

      socket.on("answer", async (answer) => {
        if (!pc) createPC();
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          log("answer set");
        } else {
          log("skip answer, state:", pc.signalingState);
        }
      });

      socket.on("candidate", async (candidate) => {
        if (!pc) createPC();
        try {
          if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) { log("candidate error", err); }
      });

      socket.on("waitingForPeer", () => showToast("Waiting for partner..."));
      socket.on("partnerDisconnected", () => { showToast("Partner disconnected"); showRating(); get("remoteVideo").srcObject = null; });
      socket.on("partnerLeft", () => { showToast("Partner left"); showRating(); get("remoteVideo").srcObject = null; });
      socket.on("errorMessage", (e) => console.warn("server error:", e));
    })();

    // === Controls ===
    const micBtn = get("micBtn");
    if (micBtn) {
      micBtn.onclick = () => {
        const t = localStream?.getAudioTracks()[0];
        if (!t) return;
        t.enabled = !t.enabled;
        micBtn.classList.toggle("inactive", !t.enabled);
        micBtn.querySelector("i").className = t.enabled ? "fas fa-microphone" : "fas fa-microphone-slash";
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
        camBtn.querySelector("i").className = t.enabled ? "fas fa-video" : "fas fa-video-slash";
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
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (!sender) { screenTrack.stop(); return; }
          cameraTrackSaved = localStream?.getVideoTracks()?.[0] || cameraTrackSaved;
          await sender.replaceTrack(screenTrack);
          screenBtn.classList.add("active");
          showToast("Screen sharing");
          screenTrack.onended = async () => {
            let cam = cameraTrackSaved;
            if (!cam || cam.readyState === "ended") {
              const fresh = await navigator.mediaDevices.getUserMedia({ video: true });
              cam = fresh.getVideoTracks()[0];
            }
            if (sender && cam) await sender.replaceTrack(cam);
            screenBtn.classList.remove("active");
            showToast("Screen share stopped");
          };
        } catch { showToast("Screen share cancelled"); }
      };
    }

    const disconnectBtn = get("disconnectBtn");
    if (disconnectBtn) {
      disconnectBtn.onclick = () => { socket?.emit("partnerLeft"); cleanup(); showRating(); };
    }

    const quitBtn = get("quitBtn");
    if (quitBtn) quitBtn.onclick = () => { cleanup(); window.location.href = "/"; };

    const newPartnerBtn = get("newPartnerBtn");
    if (newPartnerBtn) newPartnerBtn.onclick = () => { cleanup(); window.location.href = "/connect"; };

    // hearts rating binding
    const hearts = document.querySelectorAll("#ratingOverlay .hearts i");
    hearts.forEach((h) => {
      h.addEventListener("click", () => {
        const val = parseInt(h.getAttribute("data-value"));
        hearts.forEach((el, i) => el.classList.toggle("selected", i < val));
      });
    });

    return () => cleanup();
  }, []);

  return (
    <>
      {/* Videos */}
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

      {/* Controls */}
      <div className="control-bar">
        <button id="micBtn" className="control-btn"><i className="fas fa-microphone"></i><span>Mic</span></button>
        <button id="camBtn" className="control-btn"><i className="fas fa-video"></i><span>Camera</span></button>
        <button id="screenShareBtn" className="control-btn"><i className="fas fa-desktop"></i><span>Share</span></button>
        <button id="disconnectBtn" className="control-btn danger"><i className="fas fa-phone-slash"></i><span>End</span></button>
      </div>

      {/* Rating overlay */}
      <div id="ratingOverlay">
        <div className="rating-content">
          <h2>Rate your partner ❤️</h2>
          <div className="hearts">
            <i className="far fa-heart" data-value="1"></i>
            <i className="far fa-heart" data-value="2"></i>
            <i className="far fa-heart" data-value="3"></i>
            <i className="far fa-heart" data-value="4"></i>
            <i className="far fa-heart" data-value="5"></i>
          </div>
          <div className="rating-buttons">
            <button id="quitBtn">Quit</button>
            <button id="newPartnerBtn">Search New Partner</button>
          </div>
        </div>
      </div>

      <div id="toast"></div>
    </>
  );
}
