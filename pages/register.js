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
    <div style={{ padding: "2rem" }}>
      <h1>Register</h1>
      <form onSubmit={handleRegister}>
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} /><br />
        <input placeholder="Email or Mobile" value={emailOrMobile} onChange={e => setEmailOrMobile(e.target.value)} /><br />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} /><br />
        <button type="submit">Register</button>
      </form>
      <p>{message}</p>
    </div>
  );
}