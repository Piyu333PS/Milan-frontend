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

    const get = (id) => document.getElementById(id);
    const showToast = (msg, ms = 2000) => {
      const t = get("toast");
      if (!t) return;
      t.textContent = msg;
      t.style.display = "block";
      setTimeout(() => (t.style.display = "none"), ms);
    };

    const cleanup = () => {
      try { socket?.disconnect(); } catch {}
      try { pc?.getSenders()?.forEach(s => s.track && s.track.stop()); pc?.close(); } catch {}
      pc = null;
      localStream = null;
    };

    const createPC = () => {
      if (pc) return;
      pc = new RTCPeerConnection(ICE_CONFIG);

      // Add local tracks
      localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream));

      // When remote track arrives
      pc.ontrack = (e) => {
        const rv = get("remoteVideo");
        if (rv) rv.srcObject = e.streams[0];
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit("candidate", e.candidate);
      };
    };

    (async function start() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const lv = get("localVideo");
        if (lv) lv.srcObject = localStream;
      } catch {
        showToast("Camera/Mic access needed");
        return;
      }

      socket = io(BACKEND_URL, { transports: ["websocket"] });

      socket.on("connect", () => {
        const token = localStorage.getItem("token");
        const roomCode = sessionStorage.getItem("roomCode");
        socket.emit("joinVideo", { token, roomCode });
      });

      socket.on("ready", async () => {
        createPC();
        if(pc.signalingState==="stable") {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("offer", offer);
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
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      });

      socket.on("partnerDisconnected", () => { showToast("Partner disconnected"); });
      socket.on("partnerLeft", () => { showToast("Partner left"); });
    })();

  }, []);

  return (
    <>
      <div className="video-container">
        <video id="remoteVideo" autoPlay playsInline></video>
        <div id="localBox"><video id="localVideo" autoPlay playsInline muted></video></div>
      </div>
      <div id="toast"></div>
    </>
  );
}
