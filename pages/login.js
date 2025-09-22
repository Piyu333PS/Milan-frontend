// pages/login.js
import { useState } from 'react';
import axios from 'axios';

export default function Login() {
  const [emailOrMobile, setEmailOrMobile] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://milan-j9u9.onrender.com';

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('Signing in...');

    if (!emailOrMobile || !password) {
      setMessage('Please enter mobile/email and password.');
      return;
    }

    // Agar digits only hain to mobile treat karo
    const isDigitsOnly = /^\d+$/.test(emailOrMobile.trim());
    let payload;

    if (isDigitsOnly) {
      payload = { mobile: emailOrMobile.trim(), password };
    } else {
      payload = { email: emailOrMobile.trim(), password };
    }

    try {
      console.log('Sending login payload:', payload);
      const res = await axios.post(API_BASE + '/login', payload, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true
      });

      if (res.status === 200) {
        setMessage('Login successful! Welcome ' + (res.data.user?.name || 'User'));
        if (res.data.token) localStorage.setItem('token', res.data.token);
        if(res.data.user) localStorage.setItem('uid', res.data.user.id);
        console.log('Login response:', res.data);
        // TODO: redirect here
      } else {
        setMessage(res.data.message || 'Login failed');
      }
    } catch (err) {
      console.error('Login error', err);
      const serverMsg = err.response?.data?.message || err.response?.data?.error;
      setMessage(serverMsg || 'Login failed. Please try again.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>Login</h1>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Email or Mobile"
            value={emailOrMobile}
            onChange={(e) => setEmailOrMobile(e.target.value)}
            name="emailOrMobile"
            autoComplete="username"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            name="password"
            autoComplete="current-password"
            required
          />
          <button type="submit">Login</button>
        </form>
        <p>{message}</p>
      </div>

      <style jsx>{`
        .auth-container {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          background: #111;
        }
        .auth-box {
          background: rgba(255, 255, 255, 0.06);
          padding: 20px;
          border-radius: 12px;
          width: 100%;
          max-width: 360px;
        }
        input,
        button {
          width: 100%;
          padding: 10px;
          margin: 8px 0;
          border: none;
          border-radius: 6px;
        }
        button {
          background: #ec4899;
          color: #fff;
          font-weight: bold;
          cursor: pointer;
        }
        button:hover {
          background: #f472b6;
        }
        h1 {
          text-align: center;
          color: #fff;
        }
        p {
          color: yellow;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
