import { useState } from 'react';
import axios from 'axios';

export default function Register() {
  const [emailOrMobile, setEmailOrMobile] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(process.env.NEXT_PUBLIC_API_BASE + '/register', { emailOrMobile, password, name });
      setMessage('Registration successful!');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>Register</h1>
        <form onSubmit={handleRegister}>
          <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
          <input placeholder="Email or Mobile" value={emailOrMobile} onChange={e => setEmailOrMobile(e.target.value)} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit">Register</button>
        </form>
        <p>{message}</p>
      </div>
      <style jsx>{`
        /* 🚫 FIX: use min-height:100dvh + overflow:auto for mobile */
        .auth-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100dvh;
          background: #111;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: 16px;
        }
        .auth-box { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; width: 100%; max-width: 360px; }
        input, button { width: 100%; padding: 10px; margin: 8px 0; border: none; border-radius: 6px; }
        button { background: #ec4899; color: #fff; font-weight: bold; }
        button:hover { background: #f472b6; }
        h1 { text-align: center; color: #fff; }
        p { color: yellow; text-align: center; }
      `}</style>
    </div>
  );
}
