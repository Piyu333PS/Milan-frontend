"use client";
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

export default function ChatPage() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

  const messagesEndRef = useRef(null);

  // Partner data
  const partnerData = JSON.parse(sessionStorage.getItem("partnerData") || "{}");
  const roomCode = sessionStorage.getItem("roomCode");

  useEffect(() => {
    if (!partnerData || !roomCode) {
      alert("Partner info missing. Redirecting...");
      window.location.href = "/";
      return;
    }

    const s = io("https://milan-j9u9.onrender.com");
    setSocket(s);

    s.emit("userInfo", { name: partnerData.name, avatar: partnerData.avatar });
    s.emit("joinRoom", { roomCode });

    s.on("message", (msg) => {
      setMessages((prev) => [...prev, { ...msg, type: "text" }]);
    });

    s.on("fileMessage", (msg) => {
      setMessages((prev) => [...prev, { ...msg, type: "file" }]);
    });

    s.on("partnerTyping", () => {
      setTyping(true);
      setTimeout(() => setTyping(false), 2000);
    });

    s.on("partnerDisconnected", () => {
      alert("💔 Partner disconnected.");
      window.location.href = "/";
    });

    return () => s.disconnect();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage() {
    if (!input.trim()) return;
    const msg = { text: input, roomCode, senderId: socket.id };
    socket.emit("message", msg);
    setMessages((prev) => [...prev, { ...msg, from: "You", type: "text" }]);
    setInput("");
  }

  function sendFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const msg = {
        fileName: file.name,
        fileType: file.type,
        fileData: reader.result,
        roomCode,
        senderId: socket.id,
      };

      // Fake progress bar (since socket emits instantly)
      setUploadProgress(0);
      let progress = 0;
      const interval = setInterval(() => {
        progress += 20;
        setUploadProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          setUploadProgress(null);
          socket.emit("fileMessage", msg);
          setMessages((prev) => [
            ...prev,
            { ...msg, from: "You", type: "file" },
          ]);
        }
      }, 200);
    };
    reader.readAsDataURL(file);
  }

  function formatTime() {
    const time = new Date();
    const hours = time.getHours() % 12 || 12;
    const minutes = time.getMinutes().toString().padStart(2, "0");
    const ampm = time.getHours() >= 12 ? "PM" : "AM";
    return `${hours}:${minutes} ${ampm}`;
  }

  return (
    <>
      <div className="chat-container">
        {/* Header */}
        <div className="chat-header">
          <div className="header-center">
            <img
              src={partnerData.avatar || "partner-avatar.png"}
              alt="Partner"
            />
            <div className="partner-info">
              <span>{partnerData.name || "Partner"}</span>
              {typing && <span className="typing-indicator-header">typing...</span>}
            </div>
          </div>
          <div>
            <button
              className="report-btn"
              onClick={() => setShowReportModal(true)}
            >
              Report 🚩
            </button>
            <button
              className="disconnect-btn"
              onClick={() => {
                socket.emit("disconnectByUser");
                socket.disconnect();
                window.location.href = "/";
              }}
            >
              Disconnect
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`message ${
                msg.senderId === socket?.id || msg.from === "You"
                  ? "self"
                  : "partner"
              }`}
            >
              <div className="bubble">
                {msg.type === "text" ? (
                  <>
                    <strong>
                      {msg.senderId === socket?.id || msg.from === "You"
                        ? "You"
                        : partnerData.name}
                      :
                    </strong>{" "}
                    {msg.text}
                  </>
                ) : (
                  <>
                    <strong>
                      {msg.senderId === socket?.id || msg.from === "You"
                        ? "You"
                        : partnerData.name}
                      :
                    </strong>{" "}
                    <br />
                    {msg.fileType.startsWith("image/") ? (
                      <a
                        href={msg.fileData}
                        target="_blank"
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
                    )}
                  </>
                )}
                <div className="timestamp">{formatTime()}</div>
              </div>
            </div>
          ))}
          {uploadProgress !== null && (
            <div className="message self">
              <div className="bubble">
                Uploading file... {uploadProgress}%
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="chat-input">
          <input
            type="file"
            id="fileInput"
            style={{ display: "none" }}
            onChange={sendFile}
          />
          <button onClick={() => document.getElementById("fileInput").click()}>
            📎
          </button>
          <input
            type="text"
            value={input}
            placeholder="Type a message..."
            onChange={(e) => {
              setInput(e.target.value);
              socket.emit("typing", { roomCode });
            }}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          />
          <button onClick={sendMessage}>&#9658;</button>
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Report Partner 🚩</h3>
            <p>Are you sure you want to report this partner?</p>
            <button
              onClick={() => {
                socket.emit("reportPartner", { roomCode });
                alert("🚩 Partner reported. Thank you!");
                setShowReportModal(false);
              }}
            >
              Yes, Report
            </button>
            <button onClick={() => setShowReportModal(false)}>Cancel</button>
          </div>
        </div>
      )}

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
        .modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .modal-content {
          background: #fff;
          padding: 20px;
          border-radius: 12px;
          text-align: center;
          max-width: 300px;
        }
        .modal-content button {
          margin: 10px;
          padding: 8px 12px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }
      `}</style>
    </>
  );
}
