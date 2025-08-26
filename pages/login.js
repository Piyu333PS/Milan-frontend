import { useState } from 'react';
import axios from 'axios';

export default function Login() {
  const [emailOrMobile, setEmailOrMobile] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(process.env.NEXT_PUBLIC_API_BASE + '/login', { emailOrMobile, password });
      setMessage('Login successful! Welcome ' + res.data.user.name);
      localStorage.setItem('token', res.data.token);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>Login</h1>
        <form onSubmit={handleLogin}>
          <input placeholder="Email or Mobile" value={emailOrMobile} onChange={e => setEmailOrMobile(e.target.value)} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit">Login</button>
        </form>
        <p>{message}</p>
      </div>
      <style jsx>{`
        .auth-container { display: flex; align-items: center; justify-content: center; height: 100vh; background: #111; }
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
