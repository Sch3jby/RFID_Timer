import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import axios from "axios";
import './styles.css';

// Navigation Component
function Navigation() {
  const location = useLocation();
  
  return (
    <nav className="navigation">
      <div className="nav-container">
        <Link 
          to="/timer" 
          className={`nav-button ${location.pathname === '/timer' ? 'active' : ''}`}
        >
          Správce
        </Link>
        <Link 
          to="/registration" 
          className={`nav-button ${location.pathname === '/registration' ? 'active' : ''}`}
        >
          Závodník
        </Link>
        <Link 
          to="/startlist" 
          className={`nav-button ${location.pathname === '/startlist' ? 'active' : ''}`}
        >
          Startovní listina
        </Link>
      </div>
    </nav>
  );
}

// Home Component
function Home() {
  return (
    <div className="home-container">
      <h1>Vítejte v systému pro závody</h1>
      <p>Vyberte jednu z možností v menu nahoře pro pokračování.</p>
    </div>
  );
}

// Layout Component
function Layout({ children }) {
  return (
    <div className="app-container">
      <Navigation />
      <main className="main-content">
        {children}
      </main>
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

// StartList Component
function StartList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get('http://localhost:5001/startlist')
      .then(response => {
        setUsers(response.data.users);
        setLoading(false);
      })
      .catch(error => {
        setError('Chyba při načítání uživatelů');
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="container">Načítání...</div>;
  if (error) return <div className="container">{error}</div>;

  return (
    <div className="container">
      <h1>Startovní listina</h1>
      <table className="startlist-table">
        <thead>
          <tr>
            <th>Jméno</th>
            <th>Příjmení</th>
            <th>Rok narození</th>
            <th>Klub</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => (
            <tr key={index}>
              <td>{user.forename}</td>
              <td>{user.surname}</td>
              <td>{user.year}</td>
              <td>{user.club}</td>
            </tr>
          ))}
        </tbody>
      </table>
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

// Main App Component
function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/timer" element={<RFIDReader />} />
          <Route path="/registration" element={<RegistrationForm />} />
          <Route path="/startlist" element={<StartList />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;