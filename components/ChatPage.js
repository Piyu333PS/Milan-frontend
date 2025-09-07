"use client";
import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const BACKEND_URL = "https://milan-j9u9.onrender.com"; // apna backend URL

export default function ChatPage() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  const [partner, setPartner] = useState(null);

  // sessionStorage ko sirf client par read karo
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("partnerData");
      if (stored) setPartner(JSON.parse(stored));
    }
  }, []);

  // socket connect
  useEffect(() => {
    if (!partner) return;

    const s = io(BACKEND_URL, { query: { userId: partner.selfId } });
    setSocket(s);

    s.on("receive-message", (msg) => {
      setMessages((prev) => [...prev, msg]);
      s.emit("message-seen", { messageId: msg.id, userId: partner.selfId });
    });

    s.on("message-status", ({ messageId, status }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status } : m))
      );
    });

    return () => {
      s.disconnect();
    };
  }, [partner]);

  // auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !socket) return;

    const msg = {
      id: Date.now(),
      text: input,
      sender: partner.selfId,
      receiver: partner.partnerId,
      status: "sent",
    };

    setMessages((prev) => [...prev, msg]);
    socket.emit("send-message", msg);
    setInput("");
  };

  if (!partner) {
    return (
      <div className="flex items-center justify-center h-screen text-lg">
        Loading chat...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-pink-100">
      {/* Header */}
      <div className="bg-pink-500 text-white p-3 text-lg font-bold">
        💖 Chat with {partner.partnerName || "Partner"}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`p-2 rounded-lg max-w-xs ${
              msg.sender === partner.selfId
                ? "ml-auto bg-pink-400 text-white"
                : "mr-auto bg-gray-200 text-black"
            }`}
          >
            <div>{msg.text}</div>
            {msg.sender === partner.selfId && (
              <div className="text-xs mt-1 text-right">
                {msg.status === "sent" && "✓"}
                {msg.status === "delivered" && "✓✓"}
                {msg.status === "seen" && "✓✓ (seen)"}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-white flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 border rounded-lg px-3 py-2"
        />
        <button
          onClick={sendMessage}
          className="bg-pink-500 text-white px-4 py-2 rounded-lg"
        >
          Send
        </button>
      </div>
    </div>
  );
}
