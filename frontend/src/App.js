import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import axios from "axios";
import './styles.css';

// Role Selection Component
function RoleSelection() {
  const navigate = useNavigate();

  return (
    <div className="container">
      <h1>Vyberte roli</h1>
      <button onClick={() => navigate("/timer")}>Správce</button>
      <button onClick={() => navigate("/registration")}>Závodník</button>
    </div>
  );
}

// RFID Reader/Timer Component
function RFIDReader() {
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [tags, setTags] = useState([]);

  const handleConnect = () => {
    setMessage("Attempting to connect...");
    axios.post("http://localhost:5001/connect")
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
    let interval;
    if (isConnected) {
      interval = setInterval(() => {
        axios.get("http://localhost:5001/fetch_taglist")
          .then((response) => {
            if (response.data.status === "success") {
              setTags(response.data.taglist);
            } else {
              setMessage("Error: " + response.data.message);
            }
          })
          .catch((error) => {
            setMessage("Error: " + error.message);
          });
      }, 500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
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
      const response = await axios.post('http://localhost:5001/registration', formData);
      setMessage('Uživatel byl úspěšně zaregistrován');
      setFormData({ forename: '', surname: '', year: '', club: '' });
    } catch (error) {
      setMessage(error.response?.data?.error || 'Chyba při registraci');
    }
  };

  return (
    <div className="container">
      <h1>Registrace</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Jméno:</label>
          <input type="text" name="forename" value={formData.forename} onChange={handleChange} />
        </div>
        <div>
          <label>Příjmení:</label>
          <input type="text" name="surname" value={formData.surname} onChange={handleChange} />
        </div>
        <div>
          <label>Rok narození:</label>
          <input type="text" name="year" value={formData.year} onChange={handleChange} />
        </div>
        <div>
          <label>Klub:</label>
          <input type="text" name="club" value={formData.club} onChange={handleChange} />
        </div>
        <button type="submit">Registrovat</button>
      </form>
      <p>{message}</p>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RoleSelection />} />
        <Route path="/timer" element={<RFIDReader />} />
        <Route path="/registration" element={<RegistrationForm />} />
      </Routes>
    </Router>
  );
}

export default App;