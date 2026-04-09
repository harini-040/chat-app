import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [room, setRoom] = useState('');
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    if (token && !socketRef.current) {
      socketRef.current = io('http://localhost:5000', {
        auth: { token }
      });
      
      socketRef.current.on('connect', () => console.log('✅ Connected'));
      socketRef.current.on('message', (msg) => {
        setMessages(prev => [...prev, msg]);
      });
    }
  }, [token]);

  const handleLogin = async () => {
    try {
      const res = await axios.post('http://localhost:5000/api/login', { username, password });
      setToken(res.data.token);
      setLoggedIn(true);
    } catch (err) {
      alert('Login failed');
    }
  };

  const handleRegister = async () => {
    try {
      await axios.post('http://localhost:5000/api/register', { username, password });
      alert('Registered! Please login.');
    } catch (err) {
      alert('Registration failed');
    }
  };

  const joinRoom = async (roomName) => {
    const selectedRoom = roomName || room;
    if (!selectedRoom) return;
    
    setRoom(selectedRoom);
    
    try {
      const res = await axios.get(`http://localhost:5000/api/messages/${selectedRoom}`, {
        headers: { Authorization: token }
      });
      setMessages(res.data);
    } catch (err) {}
    
    if (socketRef.current) {
      socketRef.current.emit('join-room', selectedRoom);
      setJoined(true);
    }
  };

  const sendMessage = () => {
    if (!text.trim()) return;
    socketRef.current.emit('send-message', { text });
    setText('');
  };

  if (!loggedIn) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial' }}>
        <h1>💬 Chat App</h1>
        <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} style={{ padding: 10, margin: 5, width: 200 }} />
        <br />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: 10, margin: 5, width: 200 }} />
        <br />
        <button onClick={handleLogin} style={{ padding: 10, margin: 5, width: 100 }}>Login</button>
        <button onClick={handleRegister} style={{ padding: 10, margin: 5, width: 100 }}>Register</button>
      </div>
    );
  }

  if (!joined) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h1>Welcome {username}! 👋</h1>
        <h3>Join a Chat Room</h3>
        <input placeholder="Room name" value={room} onChange={(e) => setRoom(e.target.value)} style={{ padding: 10, width: 200, marginRight: 10 }} />
        <button onClick={() => joinRoom()} style={{ padding: 10 }}>Join</button>
        <div style={{ marginTop: 30 }}>
          <button onClick={() => joinRoom('general')} style={{ margin: 5, padding: '10px 20px' }}>#general</button>
          <button onClick={() => joinRoom('gaming')} style={{ margin: 5, padding: '10px 20px' }}>#gaming</button>
          <button onClick={() => joinRoom('coding')} style={{ margin: 5, padding: '10px 20px' }}>#coding</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f5f5f5' }}>
      <div style={{ background: '#333', color: 'white', padding: 15, display: 'flex', justifyContent: 'space-between' }}>
        <h2>💬 #{room}</h2>
        <button onClick={() => setJoined(false)} style={{ padding: '5px 15px', cursor: 'pointer' }}>Change Room</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ background: 'white', padding: '10px 15px', marginBottom: 10, borderRadius: 10 }}>
            <strong>{msg.username}:</strong> {msg.text}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', padding: 15, background: 'white', gap: 10 }}>
        <input 
          style={{ flex: 1, padding: 10, border: '1px solid #ddd', borderRadius: 5 }}
          value={text} 
          onChange={(e) => setText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
        />
        <button onClick={sendMessage} style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' }}>Send</button>
      </div>
    </div>
  );
}

export default App;