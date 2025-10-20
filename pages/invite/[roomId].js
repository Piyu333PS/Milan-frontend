// pages/invite/[roomId].js
// Milan — Invite Link (Zero-DB) — Quick Direct Connect (Text + Video)
// Compatible with server events: inviteJoin, inviteChat, inviteSignal, inviteLeave
// Env: NEXT_PUBLIC_SOCKET_URL=http://localhost:5000  (or your deployed URL)

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import io from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";

export default function InviteRoom() {
  const router = useRouter();
  const { roomId } = router.query;

  const [mode, setMode] = useState("text"); // "text" | "video"
  const [status, setStatus] = useState("Loading…");
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);
  const [peerPresent, setPeerPresent] = useState(false);
  const [username, setUsername] = useState("");

  const socketRef = useRef(null);

  // Text chat
  const [messages, setMessages] = useState([]);
  const inputRef = useRef(null);

  // Video
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Build shareable URL (includes ?mode=…)
  const inviteURL = useMemo(() => {
    if (!roomId) return "";
    const base =
      typeof window !== "undefined" ? window.location.origin : "https://example.com";
    return `${base}/invite/${roomId}?mode=${mode}`;
  }, [roomId, mode]);

  // Bootstrap username from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("milan_name") || "";
      setUsername(cached);
    }
  }, []);

  // Init socket + wire up events
  useEffect(() => {
    if (!roomId) return;

    // Mode can be passed via URL (?mode=video)
    const qMode = (router.query.mode || "").toString();
    if (qMode === "video" || qMode === "text") setMode(qMode);

    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    const nameToUse =
      (typeof window !== "undefined" &&
        (localStorage.getItem("milan_name") || "").trim()) ||
      "Guest";

    // Join Zero-DB invite room
    socket.emit("inviteJoin", { roomId, mode: qMode || mode, username: nameToUse });
    setStatus("Waiting for partner to join…");

    socket.on("inviteRoomFull", () => {
      setStatus("This link already has 2 users. Create a new invite.");
    });

    socket.on("inviteJoined", ({ mode: serverMode }) => {
      if (serverMode && serverMode !== "auto") setMode(serverMode);
    });

    socket.on("inviteWaiting", () => {
      setPeerPresent(false);
      setConnected(false);
      setStatus("Waiting for partner to join…");
    });

    socket.on("invitePeerJoined", () => {
      setPeerPresent(true);
    });

    socket.on("invitePeerLeft", () => {
      setPeerPresent(false);
      setConnected(false);
      setStatus("Partner left. Waiting again…");
      teardownVideo(false);
    });

    socket.on("inviteReady", async ({ mode: m }) => {
      setPeerPresent(true);
      setConnected(true);
      setMode(m);
      setStatus(m === "video" ? "Connecting video…" : "Connected! Start chatting.");
      if (m === "video") await startVideo(socket);
    });

    // Text chat events
    socket.on("inviteChat", (payload) => {
      setMessages((m) => [...m, { ...payload, inbound: true }]);
    });
    socket.on("inviteDelivered", ({ clientId }) => {
      setMessages((m) =>
        m.map((msg) => (msg.clientId === clientId ? { ...msg, delivered: true } : msg))
      );
    });
    socket.on("inviteAck", ({ clientId }) => {
      setMessages((m) =>
        m.map((msg) => (msg.clientId === clientId ? { ...msg, ack: true } : msg))
      );
    });
    socket.on("inviteSeen", ({ clientId }) => {
      setMessages((m) =>
        m.map((msg) => (msg.clientId === clientId ? { ...msg, seen: true } : msg))
      );
    });

    // WebRTC signaling
    socket.on("inviteSignal", async ({ data }) => {
      await handleSignal(data);
    });

    return () => {
      try {
        socket.emit("inviteLeave", { roomId });
        socket.disconnect();
      } catch {}
      teardownVideo(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Copy link
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteURL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      console.error(e);
    }
  }

  // Save name → localStorage + re-emit join for presence name
  function saveName(name) {
    setUsername(name);
    if (typeof window !== "undefined") localStorage.setItem("milan_name", name);
    if (socketRef.current && roomId) {
      socketRef.current.emit("inviteJoin", { roomId, mode, username: name });
    }
  }

  // ---------- TEXT ----------
  function sendMessage() {
    if (!connected) return;
    const text = inputRef.current?.value?.trim();
    if (!text || !socketRef.current) return;
    const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const ts = Date.now();

    // optimistic UI
    setMessages((m) => [
      ...m,
      { from: "me", username, text, ts, clientId, inbound: false, delivered: false, ack: false, seen: false },
    ]);

    socketRef.current.emit("inviteChat", { roomId, text, clientId, ts });
    inputRef.current.value = "";
  }

  // Mark seen (call when chat scrolled into view / active)
  function markSeenFor(clientId) {
    if (socketRef.current && roomId) {
      socketRef.current.emit("inviteSeen", { roomId, clientId });
    }
  }

  // ---------- VIDEO ----------
  async function startVideo(socket) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      pcRef.current = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478?transport=udp" },
        ],
      });

      // Add tracks
      stream.getTracks().forEach((t) => pcRef.current.addTrack(t, stream));

      pcRef.current.ontrack = (ev) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = ev.streams[0];
      };

      pcRef.current.onicecandidate = (ev) => {
        if (ev.candidate) {
          socket.emit("inviteSignal", {
            roomId,
            data: { type: "candidate", candidate: ev.candidate },
          });
        }
      };

      // Create offer
      const offer = await pcRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pcRef.current.setLocalDescription(offer);
      socket.emit("inviteSignal", { roomId, data: { type: "offer", sdp: offer.sdp } });
    } catch (err) {
      console.error("startVideo error:", err);
      setStatus("Allow camera/mic to start video.");
    }
  }

  async function handleSignal(data) {
    // Late init if needed
    if (!pcRef.current && (data.type === "offer" || data.type === "answer" || data.type === "candidate")) {
      pcRef.current = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478?transport=udp" },
        ],
      });
      pcRef.current.ontrack = (ev) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = ev.streams[0];
      };
      pcRef.current.onicecandidate = (ev) => {
        if (ev.candidate && socketRef.current) {
          socketRef.current.emit("inviteSignal", {
            roomId,
            data: { type: "candidate", candidate: ev.candidate },
          });
        }
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        stream.getTracks().forEach((t) => pcRef.current.addTrack(t, stream));
      } catch (e) {
        console.warn("User media not granted yet:", e);
      }
    }

    if (data.type === "offer") {
      await pcRef.current.setRemoteDescription({ type: "offer", sdp: data.sdp });
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      socketRef.current.emit("inviteSignal", {
        roomId,
        data: { type: "answer", sdp: answer.sdp },
      });
    } else if (data.type === "answer") {
      await pcRef.current.setRemoteDescription({ type: "answer", sdp: data.sdp });
    } else if (data.type === "candidate" && data.candidate) {
      try {
        await pcRef.current.addIceCandidate(data.candidate);
      } catch (e) {
        console.error("ICE add failed:", e);
      }
    }
  }

  function teardownVideo(stopLocal) {
    try {
      if (pcRef.current) {
        try { pcRef.current.getSenders().forEach((s) => s.track && s.track.stop?.()); } catch {}
        pcRef.current.close();
      }
      pcRef.current = null;
    } catch {}
    if (stopLocal && localStreamRef.current) {
      try { localStreamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }

  // UI helpers
  function toggleMode(newMode) {
    setMode(newMode);
    // (URL already rebuilds in inviteURL useMemo)
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-rose-50 to-pink-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl rounded-2xl shadow-xl bg-white/80 backdrop-blur p-4 md:p-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h1 className="text-2xl md:text-3xl font-bold">💌 Milan — Quick Direct Connect</h1>
          <div className="flex gap-2">
            <button
              onClick={() => toggleMode("text")}
              className={`px-3 py-2 rounded-xl text-sm font-medium border ${mode === "text" ? "bg-rose-500 text-white border-rose-500" : "bg-white border-gray-300"}`}
              title="Text chat mode"
            >
              💬 Text
            </button>
            <button
              onClick={() => toggleMode("video")}
              className={`px-3 py-2 rounded-xl text-sm font-medium border ${mode === "video" ? "bg-rose-500 text-white border-rose-500" : "bg-white border-gray-300"}`}
              title="Video chat mode"
            >
              🎥 Video
            </button>
          </div>
        </header>

        {/* Invite Row */}
        <div className="mt-4 flex flex-col md:flex-row gap-2">
          <input
            value={inviteURL}
            readOnly
            className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
          <button onClick={copyLink} className="px-4 py-2 rounded-xl bg-black text-white text-sm">
            {copied ? "Copied ✅" : "Copy Link"}
          </button>
        </div>

        {/* Name */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-gray-600">Your name:</span>
          <input
            placeholder="Enter name"
            value={username}
            onChange={(e) => saveName(e.target.value)}
            className="rounded-xl border border-gray-300 px-3 py-1 text-sm"
            maxLength={24}
          />
        </div>

        {/* Status */}
        <div className="mt-3 text-sm">
          <span className="px-2 py-1 rounded-lg bg-rose-100 text-rose-700">{status}</span>
          {peerPresent && <span className="ml-2 text-green-700">Partner present ✅</span>}
          {connected && <span className="ml-2 text-green-700">Connected 🔗</span>}
        </div>

        {/* Content */}
        {mode === "text" ? (
          <div className="mt-6 grid grid-rows-[1fr_auto] h-[60vh] rounded-2xl border bg-white overflow-hidden">
            <div className="p-3 overflow-y-auto space-y-2">
              {messages.length === 0 && (
                <p className="text-center text-gray-400 mt-10">No messages yet. Say hi 👋</p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[75%] ${m.inbound ? "mr-auto" : "ml-auto"} rounded-2xl px-3 py-2 shadow-sm ${
                    m.inbound ? "bg-rose-50" : "bg-rose-500 text-white"
                  }`}
                  onMouseEnter={() => !m.inbound && markSeenFor(m.clientId)}
                >
                  <div className="text-[11px] opacity-80 mb-0.5">
                    {m.inbound ? m.username || "Partner" : "You"}
                  </div>
                  <div className="text-sm">{m.text}</div>
                  {!m.inbound && (
                    <div className="mt-0.5 text-[10px] opacity-80 flex items-center gap-1 justify-end">
                      <span>{m.seen ? "Seen" : m.ack ? "✓✓" : m.delivered ? "✓" : "…"}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-2 flex gap-2 border-t">
              <input
                ref={inputRef}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                className="flex-1 rounded-xl border px-3 py-2 text-sm"
                placeholder={connected ? "Type a message…" : "Wait for partner…"}
                disabled={!connected}
              />
              <button
                onClick={sendMessage}
                disabled={!connected}
                className="px-4 py-2 rounded-xl bg-rose-500 text-white text-sm disabled:opacity-60"
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl overflow-hidden bg-black aspect-video">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
            <div className="rounded-2xl overflow-hidden bg-black aspect-video">
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button
                onClick={() => {
                  const s = localStreamRef.current;
                  if (!s) return;
                  const a = s.getAudioTracks()[0];
                  if (a) a.enabled = !a.enabled;
                }}
                className="px-4 py-2 rounded-xl border"
              >
                🎙️ Mic on/off
              </button>
              <button
                onClick={() => {
                  const s = localStreamRef.current;
                  if (!s) return;
                  const v = s.getVideoTracks()[0];
                  if (v) v.enabled = !v.enabled;
                }}
                className="px-4 py-2 rounded-xl border"
              >
                📷 Camera on/off
              </button>
              <button
                onClick={() => {
                  if (localVideoRef.current) {
                    const el = localVideoRef.current;
                    el.style.filter = el.style.filter ? "" : "blur(6px)";
                  }
                }}
                className="px-4 py-2 rounded-xl border"
              >
                🎭 Blur BG (local)
              </button>
              <button
                onClick={() => {
                  teardownVideo(true);
                  setStatus("Video stopped.");
                }}
                className="px-4 py-2 rounded-xl border"
              >
                ⏹️ Stop
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 text-[12px] text-gray-500">
          Tip: Ye invite **Zero-DB** hai. Room me max 2 users. Agar partner na aaye, link dobara bhej do. 🔁
        </div>
      </div>
    </div>
  );
}
