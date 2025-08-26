"use client";
import { useEffect } from "react";
import io from "socket.io-client";

export default function ChatPage() {
  useEffect(() => {
    const socket = io("https://milan-j9u9.onrender.com");

    const msgInput = document.getElementById("msgInput");
    const typingIndicator = document.getElementById("typingIndicator");
    const messagesContainer = document.getElementById("messages");
    const sendBtn = document.getElementById("sendBtn");
    const partnerNameEl = document.getElementById("partnerName");
    const partnerAvatarEl = document.getElementById("partnerAvatar");
    const welcomeMessageEl = document.getElementById("welcomeMessage");
    const disconnectBtn = document.getElementById("disconnectBtn");
    const fileBtn = document.getElementById("fileBtn");
    const fileInput = document.getElementById("fileInput");
    const reportBtn = document.getElementById("reportBtn");

    let partnerData = null;
    try { partnerData = JSON.parse(sessionStorage.getItem("partnerData")); } catch { partnerData = null; }
    if (!partnerData || !sessionStorage.getItem("roomCode")) {
      alert("Partner info missing. Redirecting...");
      window.location.href = "/";
      return;
    }

    const roomCode = sessionStorage.getItem("roomCode");

    partnerNameEl.textContent = partnerData.name || "Partner";
    partnerAvatarEl.src = partnerData.avatar || "partner-avatar.png";

    socket.emit("userInfo", { name: partnerData.name, avatar: partnerData.avatar });
    socket.emit("joinRoom", { roomCode });

    welcomeMessageEl.classList.remove("hidden");
    setTimeout(() => welcomeMessageEl.classList.add("hidden"), 4000);

    function sendMessage() {
      const text = msgInput.value.trim(); 
      if (!text) return;
      socket.emit("message", { text, roomCode, senderId: socket.id });
      msgInput.value = "";
    }

    function appendMessage(from, text, isSelf) {
      const div = document.createElement("div");
      div.className = "message " + (isSelf ? "self" : "partner");
      const timeString = formatTime();
      div.innerHTML = `<div class="bubble"><strong>${from}:</strong> ${text}<div class="timestamp">${timeString}</div></div>`;
      messagesContainer.appendChild(div);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function appendFileMessage(from, fileName, fileType, fileData, isSelf) {
      const div = document.createElement("div");
      div.className = "message " + (isSelf ? "self" : "partner");
      const timeString = formatTime();
      let fileLinkHtml = "";
      if (fileType && fileType.startsWith("image/")) {
        fileLinkHtml = `<a href="${fileData}" target="_blank" class="file-link"><img src="${fileData}" alt="${fileName}" style="max-width:160px; max-height:100px; border-radius:8px;"/></a>`;
      } else {
        fileLinkHtml = `<a href="${fileData}" download="${fileName}" class="file-link">${fileName}</a>`;
      }
      div.innerHTML = `<div class="bubble"><strong>${from}:</strong> sent a file<br/>${fileLinkHtml}<div class="timestamp">${timeString}</div></div>`;
      messagesContainer.appendChild(div);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function formatTime() {
      const time = new Date();
      const hours = time.getHours() % 12 || 12;
      const minutes = time.getMinutes().toString().padStart(2, '0');
      const ampm = time.getHours() >= 12 ? 'PM' : 'AM';
      return `${hours}:${minutes} ${ampm}`;
    }

    // Events
    sendBtn.addEventListener("click", sendMessage);
    msgInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessage(); });
    msgInput.addEventListener("input", () => socket.emit("typing", { roomCode }));

    fileBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        socket.emit("fileMessage", { fileName: file.name, fileType: file.type, fileData: reader.result, roomCode });
        appendFileMessage("You", file.name, file.type, reader.result, true);
      };
      reader.readAsDataURL(file);
    });

    disconnectBtn.addEventListener("click", () => {
      socket.emit("disconnectByUser"); socket.disconnect(); window.location.href = "/";
    });

    reportBtn.addEventListener("click", () => {
      alert("🚩 Partner reported. Thank you for keeping Milan safe!");
      socket.emit("reportPartner", { roomCode });
    });

    // Socket listeners
    socket.on("message", (msg) => {
      if (!msg) return;
      appendMessage(msg.senderId === socket.id ? "You" : partnerData.name, msg.text, msg.senderId === socket.id);
    });

    socket.on("fileMessage", (msg) => {
      appendFileMessage(msg.senderId === socket.id ? "You" : partnerData.name, msg.fileName, msg.fileType, msg.fileData, msg.senderId === socket.id);
    });

    socket.on("partnerTyping", () => {
      typingIndicator.classList.remove("hidden");
      clearTimeout(typingIndicator.timeout);
      typingIndicator.timeout = setTimeout(() => typingIndicator.classList.add("hidden"), 2000);
    });

    socket.on("partnerDisconnected", () => {
      alert("💔 Partner disconnected."); window.location.href = "/";
    });

    return () => { socket.disconnect(); };
  }, []);

  return (
    <>
      <div className="chat-container">
        <div className="chat-header">
          <div className="header-center">
            <img id="partnerAvatar" src="partner-avatar.png" alt="Partner"/>
            <div className="partner-info">
              <span id="partnerName">Partner</span>
              <span id="typingIndicator" className="typing-indicator-header hidden">typing...</span>
            </div>
          </div>
          <div>
            <button id="reportBtn" className="report-btn">Report 🚩</button>
            <button id="disconnectBtn" className="disconnect-btn">Disconnect</button>
          </div>
        </div>

        <div id="welcomeMessage" className="welcome-message hidden">
          You are now connected to a Romantic Stranger 💌
        </div>

        <div className="chat-messages" id="messages"></div>

        <div className="chat-input">
          <input type="file" id="fileInput" style={{ display:"none" }} />
          <button id="fileBtn" title="Attach file">📎</button>
          <input type="text" id="msgInput" placeholder="Type a message..."/>
          <button id="sendBtn" title="Send">&#9658;</button>
        </div>
      </div>

      {/* Styles */}
      <style jsx global>{`
        body {
          margin: 0;
          font-family: 'Poppins', sans-serif;
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
          background: rgba(255,255,255,0.9);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 6px 20px rgba(0,0,0,0.2);
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
        .chat-header img { width: 40px; height: 40px; border-radius: 50%; margin-right: 8px; }
        .header-center { display: flex; align-items: center; }
        .partner-info { display: flex; flex-direction: column; font-size: 14px; }
        .typing-indicator-header { font-size: 12px; color: #ffe; }
        .disconnect-btn, .report-btn {
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
          background: url('https://i.ibb.co/hMKyQzR/romantic-bg.png') repeat;
          background-size: contain;
        }
        .welcome-message {
          text-align: center;
          font-weight: bold;
          color: #ff4e75;
          padding: 10px;
        }
        .message { margin: 6px 0; display: flex; flex-direction: column; }
        .message.self { align-items: flex-end; }
        .bubble { max-width: 75%; padding: 8px 12px; border-radius: 16px; line-height: 1.4; position: relative; }
        .message.self .bubble { background: #ff4e75; color: #fff; border-bottom-right-radius: 2px; }
        .message.partner .bubble { background: #f1f1f1; color: #333; border-bottom-left-radius: 2px; }
        .timestamp { font-size: 11px; opacity: 0.7; margin-top: 2px; text-align: right; }
        .chat-input { display: flex; align-items: center; padding: 8px; background: #fff; border-top: 1px solid #ddd; }
        .chat-input input[type="text"] {
          flex: 1; padding: 8px 10px; border-radius: 20px; border: 1px solid #ccc;
          margin: 0 6px; outline: none;
        }
        .chat-input button {
          background: #ff4e75; border: none; border-radius: 50%;
          width: 40px; height: 40px; color: #fff; font-size: 18px; cursor: pointer;
        }
        .file-link { display: inline-block; margin-top: 4px; color: #0077ff; text-decoration: none; font-size: 14px; }
        .hidden { display: none; }
      `}</style>
    </>
  );
}
