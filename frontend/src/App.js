// frontend/src/App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import axios from "axios";
import './styles.css';

// RFID Reader Component
function RFIDReader() {
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [tags, setTags] = useState([]);

  const handleConnect = () => {
    setMessage("Attempting to connect...");
    axios.post("http://localhost:5000/connect")
      .then((response) => {
        if (response.data.status === "connected") {
          setIsConnected(true);
          setMessage("Connected to RFID reader.");
        } else if (response.data.status === "disconnected") {
          setIsConnected(false);
          setMessage("Disconnected from RFID reader.");
          setTags([]);
        } else {
          setMessage("Error: " + response.data.message);
        }
      })
      .catch(() => {
        setMessage("Error: Could not connect to RFID reader.");
      });
  };

  useEffect(() => {
    if (isConnected) {
      const interval = setInterval(() => {
        axios.get("http://localhost:5000/fetch_taglist")
          .then((response) => {
            if (response.data.status === "success") {
              setTags(response.data.taglist.split("\n"));
            } else {
              setMessage("Error: " + response.data.message);
            }
          });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isConnected]);

  return (
    <div className="container">
      <h1>RFID Reader</h1>
      <button onClick={handleConnect}>
        {isConnected ? "Disconnect" : "Connect"}
      </button>
      <div id="message">{message}</div>
      <div id="tag-container">
        {tags.map((tag, index) => (
          <div key={index} className="tag-box">{tag}</div>
        ))}
      </div>
    </div>
  );
}

// Registration Form Component
function RegistrationForm() {
  const [formData, setFormData] = useState({
    forename: '',
    surname: '',
    year: '',
    club: ''
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/registration', formData);
      setMessage('Uživatel byl úspěšně zaregistrován');
      setFormData({ forename: '', surname: '', year: '', club: '' });
    } catch (error) {
      setMessage(error.response?.data?.error || 'Došlo k chybě při registraci');
    }
  };

  return (
    <div className="registration-container">
      <h2>Registrace uživatele</h2>
      {message && <div className={message.includes('úspěšně') ? 'success-message' : 'error-message'}>{message}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="forename">Jméno:</label>
          <input
            type="text"
            id="forename"
            name="forename"
            value={formData.forename}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="surname">Příjmení:</label>
          <input
            type="text"
            id="surname"
            name="surname"
            value={formData.surname}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="year">Rok narození:</label>
          <input
            type="number"
            id="year"
            name="year"
            value={formData.year}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="club">Klub:</label>
          <input
            type="text"
            id="club"
            name="club"
            value={formData.club}
            onChange={handleChange}
            required
          />
        </div>
        <button type="submit">Registrovat</button>
      </form>
    </div>
  );
}

// Main App Component
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RFIDReader />} />
        <Route path="/registration" element={<RegistrationForm />} />
      </Routes>
    </Router>
  );
}

export default App;