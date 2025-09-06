"use client";
import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

export default function ChatPage() {
  const [username, setUsername] = useState(null);
  const [partner, setPartner] = useState("Partner ❤️");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [uploading, setUploading] = useState(null);

  const socketRef = useRef(null);
  const inputRef = useRef(null);

  // ✅ Load username safely (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("username") || "You";
      setUsername(stored);
    }
  }, []);

  // ✅ Setup Socket.IO connection
  useEffect(() => {
    if (!username) return;

    const socket = io("https://milan-j9u9.onrender.com");
    socketRef.current = socket;

    socket.emit("join", username);

    socket.on("chatMessage", (msg) => {
      setMessages((prev) => [
        ...prev,
        { text: msg, sender: partner, status: "read" }, // partner ka msg hamesha read
      ]);
    });

    socket.on("typing", () => {
      setTyping(true);
      setTimeout(() => setTyping(false), 1500);
    });

    return () => {
      socket.disconnect();
    };
  }, [username]);

  // ✅ Send message
  const sendMessage = () => {
    if (input.trim() === "") return;
    const msg = {
      id: Date.now(),
      text: input,
      sender: username,
      status: "sent",
    };

    setMessages((prev) => [...prev, msg]);

    // Deliver tick
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, status: "delivered" } : m
        )
      );
    }, 200);

    socketRef.current.emit("chatMessage", input);

    setInput("");
    inputRef.current.focus();
  };

  // ✅ Handle typing
  const handleTyping = (e) => {
    setInput(e.target.value);
    socketRef.current.emit("typing");
  };

  // ✅ File send
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const msg = {
      id: Date.now(),
      text: `📎 ${file.name}`,
      sender: username,
      status: "sent",
      file,
      progress: 0,
    };

    setMessages((prev) => [...prev, msg]);
    setUploading(msg.id);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, progress } : m
        )
      );
      if (progress >= 100) {
        clearInterval(interval);
        setUploading(null);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id ? { ...m, status: "delivered" } : m
          )
        );
        socketRef.current.emit("chatMessage", `Sent a file: ${file.name}`);
      }
    }, 400);
  };

  if (!username) {
    return <div className="text-white text-center mt-20">Loading chat...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-pink-200 to-red-300">
      {/* Header */}
      <div className="p-4 bg-pink-600 text-white flex justify-between items-center">
        <h2 className="text-lg font-bold">{partner}</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowReport(true)}
            className="bg-red-500 px-3 py-1 rounded"
          >
            Report
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="bg-gray-800 px-3 py-1 rounded"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Chat body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => (
          <div
            key={msg.id || Math.random()}
            className={`flex ${
              msg.sender === username ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-xs px-3 py-2 rounded-2xl shadow ${
                msg.sender === username
                  ? "bg-pink-500 text-white"
                  : "bg-white text-black"
              }`}
            >
              <p>{msg.text}</p>
              {msg.file && (
                <div className="mt-1 text-sm italic">
                  {msg.progress < 100
                    ? `Uploading... ${msg.progress}%`
                    : "Upload complete"}
                </div>
              )}
              {/* Delivery ticks */}
              {msg.sender === username && (
                <span className="text-xs ml-2">
                  {msg.status === "sent" && "🕓"}
                  {msg.status === "delivered" && "✅"}
                  {msg.status === "read" && "✅✅"}
                </span>
              )}
            </div>
          </div>
        ))}
        {typing && (
          <div className="text-sm text-gray-700 italic">
            {partner} is typing...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 bg-white flex items-center gap-2">
        <input
          type="file"
          onChange={handleFile}
          className="hidden"
          id="file-input"
        />
        <label
          htmlFor="file-input"
          className="cursor-pointer text-pink-600 font-bold"
        >
          📎
        </label>
        <input
          ref={inputRef}
          value={input}
          onChange={handleTyping}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 border rounded-full px-4 py-2"
        />
        <button
          onClick={sendMessage}
          className="bg-pink-600 text-white px-4 py-2 rounded-full"
        >
          Send
        </button>
      </div>

      {/* Report Modal */}
      {showReport && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl w-80">
            <h3 className="text-lg font-bold mb-2">Report {partner}?</h3>
            <textarea
              placeholder="Reason..."
              className="w-full border p-2 rounded"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setShowReport(false)}
                className="px-3 py-1 bg-gray-400 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  alert("Report submitted!");
                  setShowReport(false);
                }}
                className="px-3 py-1 bg-red-600 text-white rounded"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
