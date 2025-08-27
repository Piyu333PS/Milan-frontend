"use client";
import { useEffect, useState } from "react";

export default function HomePage() {
  const API_BASE = "https://milan-j9u9.onrender.com";
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    // Hearts background
    const canvas = document.getElementById("heartsCanvas");
    const ctx = canvas.getContext("2d");
    let hearts = [];

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    function createHeart() {
      return {
        x: Math.random() * canvas.width,
        y: canvas.height + 50,
        size: Math.random() * 30 + 15,
        speed: Math.random() * 1.5 + 0.5,
        color: ["#ff4d6d", "#ff1c68", "#ff6b81", "#e6005c"][Math.floor(Math.random() * 4)]
      };
    }

    function drawHearts() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hearts.forEach(h => {
        ctx.fillStyle = h.color;
        ctx.beginPath();
        ctx.moveTo(h.x, h.y);
        ctx.bezierCurveTo(h.x + h.size / 2, h.y - h.size, h.x + h.size * 1.5, h.y + h.size / 3, h.x, h.y + h.size);
        ctx.bezierCurveTo(h.x - h.size * 1.5, h.y + h.size / 3, h.x - h.size / 2, h.y - h.size, h.x, h.y);
        ctx.fill();
        h.y -= h.speed;
      });
      hearts = hearts.filter(h => h.y + h.size > 0);
      if (Math.random() < 0.1) hearts.push(createHeart());
      requestAnimationFrame(drawHearts);
    }
    drawHearts();
  }, []);

  function showError(msg) {
    const errDiv = document.getElementById("errorMessage");
    if (!errDiv) return;
    errDiv.textContent = msg;
    errDiv.style.display = "block";
    setTimeout(() => {
      errDiv.style.display = "none";
    }, 4000);
  }

  async function handleRegister() {
    const name = document.getElementById("name").value.trim();
    const gender = document.getElementById("gender").value;
    const contact = document.getElementById("contact").value.trim();
    const password = document.getElementById("password").value.trim();
    const age = document.getElementById("age").value.trim();
    const city = document.getElementById("city").value.trim();
    const reason = document.getElementById("reason").value;
    if (!name || !gender || !contact || !password || !age || !city || !reason)
      return showError("Please fill all required fields!");

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrMobile: contact, password, name })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        window.location.href = "/connect";
      } else showError(data.error || "Registration failed");
    } catch {
      showError("Server error");
    }
  }

  async function handleLogin() {
    const contact = document.getElementById("loginContact").value.trim();
    const password = document.getElementById("loginPassword").value.trim();
    if (!contact || !password) return showError("Enter Email/Mobile and Password");

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrMobile: contact, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        window.location.href = "/connect";
      } else {
        showError(data.error || "Login failed");
      }
    } catch {
      showError("Server error");
    }
  }

  async function handleReset() {
    const contact = document.getElementById("resetContact").value.trim();
    const newPassword = document.getElementById("newPassword").value.trim();
    if (!contact || !newPassword) return showError("Fill all fields");

    try {
      const res = await fetch(`${API_BASE}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrMobile: contact, password: newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Password reset successful, please login again.");
        setShowReset(false);
        setShowLogin(true);
      } else showError(data.error || "Reset failed");
    } catch {
      showError("Server error");
    }
  }

  return (
    <>
      <canvas id="heartsCanvas"></canvas>
      <audio id="bgMusic" loop>
        <source src="music/romantic.mp3" type="audio/mpeg" />
      </audio>

      <div id="errorMessage"></div>

      {/* Banner with Ganesh Ji */}
      <div className="banner">
        <img src="/images/ganesh.png" alt="Ganesh Ji" className="ganeshImg" />
        <div className="bannerText">
          <h2>🌺 Ganesh Chaturthi ki Shubhkamnaye! 🌺</h2>
          <p>✨ Milan is Live! Let your hearts connect… ❤️</p>
        </div>
      </div>

      <div className="container" id="userFormContainer">
        <div className="left">
          <h1>Welcome to Milan ❤️</h1>
          <p>“Love recognizes no barriers. It jumps hurdles, leaps fences, penetrates walls to arrive at its destination full of hope.”</p>
        </div>
        <div className="right">
          <div className="form-container">
            {!showLogin && !showReset && (
              <div id="registerForm">
                <h2>Create Your Account</h2>
                <button id="musicBtn" type="button" onClick={() => {
                  const bgMusic = document.getElementById("bgMusic");
                  if (musicPlaying) bgMusic.pause();
                  else bgMusic.play().catch(() => {});
                  setMusicPlaying(!musicPlaying);
                }}>{musicPlaying ? "Music Off" : "Music On"}</button>
                <button id="themeToggle" type="button" onClick={() => document.body.classList.toggle("light-mode")}>🌙 Switch Theme</button>

                <label>Name <span className="star">*</span></label>
                <input type="text" id="name" placeholder="Your name or nickname" />
                <label>Gender <span className="star">*</span></label>
                <select id="gender">
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                <label>Email or Mobile <span className="star">*</span></label>
                <input type="text" id="contact" placeholder="Email or 10-digit Mobile number" />
                <label>Password <span className="star">*</span></label>
                <input type="password" id="password" placeholder="Enter password" />
                <label>Age <span className="star">*</span></label>
                <input type="number" id="age" placeholder="Your age" min="18" max="99" />
                <label>City/Country <span className="star">*</span></label>
                <input type="text" id="city" placeholder="City / Country" />
                <label>Reason for Joining <span className="star">*</span></label>
                <select id="reason" onChange={(e) => {
                  document.getElementById("otherReason").style.display = e.target.value === "Other" ? "block" : "none";
                }}>
                  <option value="">Select reason</option>
                  <option value="Looking for Love">Looking for Love ❤️</option>
                  <option value="Friendship">Friendship 🤗</option>
                  <option value="Casual Chat">Casual Chat 🎈</option>
                  <option value="Exploring">Exploring 🌎</option>
                  <option value="Other">Other</option>
                </select>
                <textarea id="otherReason" placeholder="If other, please describe" style={{display: "none"}} />
                <button onClick={handleRegister}>Register & Start</button>
                <p style={{textAlign:"center",cursor:"pointer",color:"yellow"}} onClick={()=>setShowLogin(true)}>Already Registered? Login here</p>
              </div>
            )}

            {showLogin && !showReset && (
              <div id="loginForm">
                <h2>Login to Milan</h2>
                <label>Email or Mobile</label>
                <input type="text" id="loginContact" placeholder="Enter Email/Mobile" />
                <label>Password</label>
                <input type="password" id="loginPassword" placeholder="Enter password" />
                <button onClick={handleLogin}>Login</button>
                <p style={{textAlign:"center",cursor:"pointer",color:"yellow"}} onClick={()=>setShowLogin(false)}>New User? Register here</p>
                <p style={{textAlign:"center",cursor:"pointer",color:"#ff4d4f"}} onClick={()=>setShowReset(true)}>Forgot Password?</p>
              </div>
            )}

            {showReset && (
              <div id="resetForm">
                <h2>Reset Password</h2>
                <label>Email or Mobile</label>
                <input type="text" id="resetContact" placeholder="Enter your Email/Mobile" />
                <label>New Password</label>
                <input type="password" id="newPassword" placeholder="Enter new password" />
                <button onClick={handleReset}>Reset Password</button>
                <p style={{textAlign:"center",cursor:"pointer",color:"yellow"}} onClick={()=>{setShowReset(false); setShowLogin(true);}}>Back to Login</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        :root {
          --bg-color:#1f2937; --text-color:#fff; --box-bg: rgba(255,255,255,0.2);
          --btn-bg:#fff; --btn-text:#ec4899; --red-star:#ff4d4f;
        }
        .light-mode { --bg-color:#f3f4f6; --text-color:#1f2937; --box-bg: rgba(0,0,0,0.1); --btn-bg:#ec4899; --btn-text:#fff; }
        html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;font-family:"Segoe UI",sans-serif;background:var(--bg-color);color:var(--text-color);}
        #heartsCanvas{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;}
        .banner{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(255,255,255,0.2);padding:15px 20px 15px 80px;border-radius:12px;backdrop-filter:blur(10px);text-align:left;z-index:10;display:flex;align-items:center;animation:fadeInPulse 2s ease-in-out infinite alternate;}
        .banner .ganeshImg{width:60px;height:60px;margin-right:15px;}
        .bannerText h2{margin:0;font-size:20px;}
        .bannerText p{margin:5px 0 0 0;font-size:16px;}
        @keyframes fadeInPulse{0%{opacity:0.7;transform:translateX(-50%) scale(1);}50%{opacity:1;transform:translateX(-50%) scale(1.05);}100%{opacity:0.8;transform:translateX(-50%) scale(1);}}
        .container{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;height:100%;padding:10px;}
        .left,.right{flex:1;padding:10px;box-sizing:border-box;}
        .left h1{font-size:2.2em;margin-bottom:8px;}
        .left p{font-size:16px;line-height:1.4;}
        .form-container{background:var(--box-bg);padding:20px;border-radius:10px;backdrop-filter:blur(8px);max-width:400px;margin:0 auto;}
        .form-container h2{margin-top:0;color:var(--text-color);font-size:22px;margin-bottom:15px;text-align:center;}
        input,select,textarea,button{width:100%;padding:10px;margin:8px 0;border:none;border-radius:5px;font-size:14px;box-sizing:border-box;}
        input,textarea{background:rgba(255,255,255,0.3);color:var(--text-color);}
        select,option{color:#333;background:#fff;}
        ::placeholder{color:#f3e8ff;}
        button{background:var(--btn-bg);color:var(--btn-text);font-weight:bold;cursor:pointer;transition:0.3s;}
        button:hover{background:var(--btn-text);color:var(--btn-bg);}
        label{display:block;margin-top:5px;font-weight:bold;font-size:14px;}
        .star{color:var(--red-star);margin-left:4px;}
        #errorMessage{display:none;position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#ff4d4f;color:#fff;padding:8px 16px;border-radius:5px;font-weight:bold;z-index:9999;box-shadow:0 0 10px rgba(0,0,0,0.3);font-size:14px;}
      `}</style>
    </>
  );
}
