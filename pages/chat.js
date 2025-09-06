"use client";
import { useEffect, useState } from "react";
import io from "socket.io-client";

export default function ChatPage() {
  const [partnerData, setPartnerData] = useState(null);
  const [roomCode, setRoomCode] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let partner = null;
    try {
      partner = JSON.parse(sessionStorage.getItem("partnerData"));
    } catch {
      partner = null;
    }

    const room = sessionStorage.getItem("roomCode");

    if (!partner || !room) {
      alert("Partner info missing. Redirecting...");
      window.location.href = "/";
      return;
    }

    setPartnerData(partner);
    setRoomCode(room);

    const socket = io("https://milan-j9u9.onrender.com");

    socket.emit("userInfo", { name: partner.name, avatar: partner.avatar });
    socket.emit("joinRoom", { roomCode: room });

    // send message
    const sendMessage = (text) => {
      const msg = {
        id: Date.now(),
        text,
        senderId: socket.id,
        status: "delivered", // ✅ first tick
      };
      setMessages((prev) => [...prev, msg]);
      socket.emit("message", { ...msg, roomCode: room });
    };

    // send file
    const sendFile = (file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const msg = {
          id: Date.now(),
          fileName: file.name,
          fileType: file.type,
          fileData: reader.result,
          senderId: socket.id,
          status: "delivered",
        };
        setMessages((prev) => [...prev, msg]);
        socket.emit("fileMessage", { ...msg, roomCode: room });
      };
      reader.readAsDataURL(file);
    };

    // receive text
    socket.on("message", (msg) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id && m.senderId === socket.id
            ? { ...m, status: "seen" } // ✅✅ seen
            : m
        )
      );
      if (msg.senderId !== socket.id) {
        setMessages((prev) => [...prev, { ...msg, status: "seen" }]);
      }
    });

    // receive file
    socket.on("fileMessage", (msg) => {
      if (msg.senderId !== socket.id) {
        setMessages((prev) => [...prev, { ...msg, status: "seen" }]);
      }
    });

    // typing
    socket.on("partnerTyping", () => {
      setTyping(true);
      setTimeout(() => setTyping(false), 2000);
    });

    // partner disconnect
    socket.on("partnerDisconnected", () => {
      alert("💔 Partner disconnected.");
      window.location.href = "/";
    });

    // attach listeners
    const input = document.getElementById("msgInput");
    const fileInput = document.getElementById("fileInput");

    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && input.value.trim()) {
        sendMessage(input.value.trim());
        input.value = "";
      }
    });

    input.addEventListener("input", () => {
      socket.emit("typing", { roomCode: room });
    });

    document.getElementById("sendBtn").addEventListener("click", () => {
      if (input.value.trim()) {
        sendMessage(input.value.trim());
        input.value = "";
      }
    });

    document.getElementById("fileBtn").addEventListener("click", () =>
      fileInput.click()
    );

    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (file) sendFile(file);
    });

    document.getElementById("disconnectBtn").addEventListener("click", () => {
      socket.emit("disconnectByUser");
      socket.disconnect();
      window.location.href = "/";
    });

    document.getElementById("reportBtn").addEventListener("click", () => {
      alert("🚩 Partner reported. Thank you for keeping Milan safe!");
      socket.emit("reportPartner", { roomCode: room });
    });

    return () => socket.disconnect();
  }, []);

  if (!partnerData) return <div>Loading chat...</div>;

  return (
    <>
      <div className="chat-container">
        {/* Header */}
        <div className="chat-header">
          <div className="header-center">
            <img
              id="partnerAvatar"
              src={partnerData.avatar || "partner-avatar.png"}
              alt="Partner"
            />
            <div className="partner-info">
              <span id="partnerName">{partnerData.name || "Partner"}</span>
              {typing && (
                <span className="typing-indicator-header">typing...</span>
              )}
            </div>
          </div>
          <div>
            <button id="reportBtn" className="report-btn">
              Report 🚩
            </button>
            <button id="disconnectBtn" className="disconnect-btn">
              Disconnect
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-messages" id="messages">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message ${
                msg.senderId === partnerData.id ? "partner" : "self"
              }`}
            >
              <div className="bubble">
                {msg.text && <span>{msg.text}</span>}
                {msg.fileData &&
                  (msg.fileType?.startsWith("image/") ? (
                    <a
                      href={msg.fileData}
                      target="_blank"
                      rel="noreferrer"
                      className="file-link"
                    >
                      <img
                        src={msg.fileData}
                        alt={msg.fileName}
                        style={{
                          maxWidth: "160px",
                          maxHeight: "100px",
                          borderRadius: "8px",
                        }}
                      />
                    </a>
                  ) : (
                    <a
                      href={msg.fileData}
                      download={msg.fileName}
                      className="file-link"
                    >
                      {msg.fileName}
                    </a>
                  ))}
                <div className="timestamp">
                  {new Date(msg.id).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  {msg.status === "delivered" && "✅"}
                  {msg.status === "seen" && "✅✅"}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="chat-input">
          <input type="file" id="fileInput" style={{ display: "none" }} />
          <button id="fileBtn" title="Attach file">
            📎
          </button>
          <input type="text" id="msgInput" placeholder="Type a message..." />
          <button id="sendBtn" title="Send">
            ➤
          </button>
        </div>
      </div>

      {/* Styles */}
      <style jsx global>{`
        body {
          margin: 0;
          font-family: "Poppins", sans-serif;
          background: linear-gradient(135deg, #ffdde1, #ee9ca7);
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .chat-container {
          width: 100%;
          max-width: 500px;
          height: 90vh;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
          overflow: hidden;
        }
        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #ff4e75;
          color: #fff;
          padding: 10px 15px;
        }
        .chat-header img {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          margin-right: 8px;
        }
        .header-center {
          display: flex;
          align-items: center;
        }
        .partner-info {
          display: flex;
          flex-direction: column;
          font-size: 14px;
        }
        .typing-indicator-header {
          font-size: 12px;
          color: #ffe;
        }
        .disconnect-btn,
        .report-btn {
          background: #fff;
          color: #ff4e75;
          border: none;
          border-radius: 8px;
          padding: 6px 10px;
          font-weight: bold;
          cursor: pointer;
          margin-left: 6px;
        }
        .chat-messages {
          flex: 1;
          padding: 10px;
          overflow-y: auto;
          background: url("https://i.ibb.co/hMKyQzR/romantic-bg.png") repeat;
          background-size: contain;
        }
        .message {
          margin: 6px 0;
          display: flex;
          flex-direction: column;
        }
        .message.self {
          align-items: flex-end;
        }
        .bubble {
          max-width: 75%;
          padding: 8px 12px;
          border-radius: 16px;
          line-height: 1.4;
          position: relative;
        }
        .message.self .bubble {
          background: #ff4e75;
          color: #fff;
          border-bottom-right-radius: 2px;
        }
        .message.partner .bubble {
          background: #f1f1f1;
          color: #333;
          border-bottom-left-radius: 2px;
        }
        .timestamp {
          font-size: 11px;
          opacity: 0.7;
          margin-top: 2px;
          text-align: right;
        }
        .chat-input {
          display: flex;
          align-items: center;
          padding: 8px;
          background: #fff;
          border-top: 1px solid #ddd;
        }
        .chat-input input[type="text"] {
          flex: 1;
          padding: 8px 10px;
          border-radius: 20px;
          border: 1px solid #ccc;
          margin: 0 6px;
          outline: none;
        }
        .chat-input button {
          background: #ff4e75;
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          color: #fff;
          font-size: 18px;
          cursor: pointer;
        }
        .file-link {
          display: inline-block;
          margin-top: 4px;
          color: #0077ff;
          text-decoration: none;
          font-size: 14px;
        }
      `}</style>
    </>
  );
}
