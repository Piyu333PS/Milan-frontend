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
    <div style={{ padding: "2rem" }}>
      <h1>Login</h1>
      <form onSubmit={handleLogin}>
        <input placeholder="Email or Mobile" value={emailOrMobile} onChange={e => setEmailOrMobile(e.target.value)} /><br />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} /><br />
        <button type="submit">Login</button>
      </form>
      <p>{message}</p>
    </div>
  );
}