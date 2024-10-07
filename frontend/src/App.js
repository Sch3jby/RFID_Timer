import React, { useState, useEffect } from "react";
import './styles.css';
import axios from "axios";

function App() {
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
      <h1>Welcome to the App!</h1>
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

export default App;
