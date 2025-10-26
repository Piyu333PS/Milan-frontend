// pages/register.js
import { useState } from 'react';
import axios from 'axios';
import Head from 'next/head';

export default function Register() {
  const [emailOrMobile, setEmailOrMobile] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(process.env.NEXT_PUBLIC_API_BASE + '/register', { 
        emailOrMobile, 
        password, 
        name 
      });
      setMessage('Registration successful! Redirecting...');
      
      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('milan_name', name);
        setTimeout(() => {
          window.location.href = '/connect';
        }, 1000);
      }
    } catch (err) {
      setMessage(err.response?.data?.error || err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <>
      <Head>
        <title>Register - Milan</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>
      
      <div className="auth-container">
        <canvas id="heartsCanvas"></canvas>
        
        <div className="auth-box">
          <div className="header-section">
            <h1 className="logo">Milan <span className="heart">❤️</span></h1>
            <p className="tagline">Where Hearts Connect</p>
          </div>
          
          <h2>Create Your Account</h2>
          
          <form onSubmit={handleRegister}>
            <div className="input-group">
              <label>Name</label>
              <input 
                placeholder="Enter your name" 
                value={name} 
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
            
            <div className="input-group">
              <label>Email or Mobile</label>
              <input 
                placeholder="Email or 10-digit Mobile" 
                value={emailOrMobile} 
                onChange={e => setEmailOrMobile(e.target.value)}
                required
              />
            </div>
            
            <div className="input-group">
              <label>Password</label>
              <input 
                type="password" 
                placeholder="Create a password" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            
            <button type="submit" className="submit-btn">Register & Start</button>
          </form>
          
          {message && (
            <p className={`message ${message.includes('success') ? 'success' : 'error'}`}>
              {message}
            </p>
          )}
          
          <p className="link-text">
            Already have an account? <a href="/login">Login here</a>
          </p>
        </div>
      </div>

      <style jsx>{`
        /* Hearts Canvas */
        #heartsCanvas {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }

        /* Container */
        .auth-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100dvh;
          background: radial-gradient(1200px circle at 10% 0%, #1a0a1e 0%, #0b1220 35%, #0f2030 100%);
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: 20px;
        }

        /* Auth Box */
        .auth-box {
          position: relative;
          z-index: 10;
          background: linear-gradient(145deg, rgba(255,79,160,0.1), rgba(139,92,246,0.05));
          backdrop-filter: blur(16px);
          padding: 32px 28px;
          border-radius: 24px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 24px 80px rgba(255,79,160,0.2);
          border: 2px solid rgba(255,107,129,0.15);
        }

        /* Header Section */
        .header-section {
          text-align: center;
          margin-bottom: 28px;
        }

        .logo {
          font-size: 48px;
          margin: 0 0 8px 0;
          font-weight: 900;
          background: linear-gradient(135deg, #ff4fa0, #ff1493);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          display: inline-block;
        }

        .heart {
          display: inline-block;
          animation: heartBeat 1200ms ease-in-out infinite;
          filter: drop-shadow(0 4px 12px rgba(255,70,94,0.4));
        }

        @keyframes heartBeat {
          0%, 100% { transform: scale(1); }
          14% { transform: scale(1.1); }
          28% { transform: scale(1); }
          42% { transform: scale(1.1); }
          70% { transform: scale(1); }
        }

        .tagline {
          font-size: 16px;
          color: #ffeef8;
          font-weight: 600;
          margin: 0;
        }

        h2 {
          text-align: center;
          color: #ffffff;
          font-size: 22px;
          margin: 0 0 24px 0;
          font-weight: 800;
        }

        /* Form Elements */
        form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        label {
          color: #f3f7fb;
          font-size: 14px;
          font-weight: 700;
        }

        input {
          width: 100%;
          padding: 14px 16px;
          border-radius: 12px;
          border: 1px solid rgba(255,107,129,0.2);
          background: rgba(0,0,0,0.4);
          color: #ffffff;
          font-size: 15px;
          outline: 2px solid transparent;
          transition: all 200ms ease;
          box-sizing: border-box;
        }

        input:focus {
          outline: 2px solid rgba(255,107,129,0.4);
          background: rgba(0,0,0,0.5);
          transform: translateY(-2px);
        }

        input::placeholder {
          color: #9ca9bb;
        }

        /* Submit Button */
        .submit-btn {
          width: 100%;
          padding: 14px 16px;
          margin-top: 8px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #ff4fa0, #ff1493);
          color: #ffffff;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 12px 40px rgba(255,79,160,0.3);
          transition: all 0.3s ease;
        }

        .submit-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 48px rgba(255,79,160,0.4);
        }

        .submit-btn:active {
          transform: translateY(0);
        }

        /* Message */
        .message {
          text-align: center;
          margin: 16px 0 0 0;
          padding: 12px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
        }

        .message.success {
          background: rgba(76, 217, 100, 0.15);
          color: #4cd964;
          border: 1px solid rgba(76, 217, 100, 0.3);
        }

        .message.error {
          background: rgba(255, 79, 160, 0.15);
          color: #ff6b9d;
          border: 1px solid rgba(255, 79, 160, 0.3);
        }

        /* Link Text */
        .link-text {
          text-align: center;
          color: #c7d7ea;
          margin: 20px 0 0 0;
          font-size: 14px;
        }

        .link-text a {
          color: #ff9fb0;
          text-decoration: none;
          font-weight: 700;
        }

        .link-text a:hover {
          color: #ff6b9d;
          text-decoration: underline;
        }

        /* Mobile Responsiveness */
        @media (max-width: 480px) {
          .auth-box {
            padding: 24px 20px;
          }

          .logo {
            font-size: 40px;
          }

          h2 {
            font-size: 20px;
          }

          input {
            padding: 12px 14px;
            font-size: 14px;
          }

          .submit-btn {
            padding: 13px 16px;
            font-size: 15px;
          }
        }
      `}</style>

      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        html, body {
          overflow-y: auto !important;
          height: auto !important;
          -webkit-overflow-scrolling: touch !important;
          overscroll-behavior-y: auto !important;
          touch-action: pan-y !important;
          font-family: 'Poppins', 'Segoe UI', Roboto, sans-serif;
        }

        body {
          background: #0b1220;
        }
      `}</style>

      <script dangerouslySetInnerHTML={{__html: `
        // Animate hearts on canvas
        (function() {
          const canvas = document.getElementById('heartsCanvas');
          if (!canvas) return;
          
          const ctx = canvas.getContext('2d');
          let hearts = [];

          function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
          }
          window.addEventListener('resize', resizeCanvas);
          resizeCanvas();

          function createHeart() {
            return {
              x: Math.random() * canvas.width,
              y: canvas.height + 50,
              size: Math.random() * 24 + 10,
              speed: Math.random() * 1.5 + 0.5,
              color: ['#ff4fa0', '#ff1493', '#ff6b9d'][Math.floor(Math.random() * 3)],
              alpha: 0.9,
              wobble: Math.random() * Math.PI * 2,
            };
          }

          function drawHearts() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            hearts.forEach((h) => {
              ctx.save();
              ctx.globalAlpha = h.alpha;
              ctx.translate(h.x, h.y);
              
              h.wobble += 0.02;
              ctx.rotate(Math.sin(h.wobble) * 0.1);
              
              ctx.fillStyle = h.color;
              ctx.beginPath();
              const s = h.size;
              ctx.moveTo(0, 0);
              ctx.bezierCurveTo(s / 2, -s, s * 1.5, s / 3, 0, s);
              ctx.bezierCurveTo(-s * 1.5, s / 3, -s / 2, -s, 0, 0);
              ctx.fill();
              ctx.restore();
              
              h.y -= h.speed;
              h.alpha *= 0.998;
            });
            
            hearts = hearts.filter((h) => h.y + h.size > -100 && h.alpha > 0.05);
            
            if (Math.random() < 0.1) hearts.push(createHeart());
            if (hearts.length > 150) hearts = hearts.slice(-150);
            
            requestAnimationFrame(drawHearts);
          }
          
          drawHearts();
        })();
      `}} />
    </>
  );
}
