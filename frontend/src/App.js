// frontend/src/App.js

import React, { useState, useEffect } from "react";
import './styles.css';
import axios from "axios";

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  const handleStartSaving = () => {
    setMessage("Starting to save tags...");
    axios.post("http://localhost:5000/start_saving")
      .then((response) => {
        if (response.data.status === "saving_started") {
          setIsSaving(true);
          setMessage("Started saving tags.");
        } else {
          setMessage("Error: " + response.data.message);
        }
      })
      .catch(() => {
        setMessage("Error: Could not start saving tags.");
      });
  };

  const handleStopSaving = () => {
    setMessage("Stopping saving tags...");
    axios.post("http://localhost:5000/stop_saving")
      .then((response) => {
        if (response.data.status === "saving_stopped") {
          setIsSaving(false);
          setMessage("Stopped saving tags.");
        } else {
          setMessage("Error: " + response.data.message);
        }
      })
      .catch(() => {
        setMessage("Error: Could not stop saving tags.");
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
      <button onClick={handleStartSaving} disabled={!isConnected || isSaving}>
        Start Saving
      </button>
      <button onClick={handleStopSaving} disabled={!isConnected || !isSaving}>
        Stop Saving
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
