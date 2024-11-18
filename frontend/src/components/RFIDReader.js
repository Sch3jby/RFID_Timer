import React, { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from '../contexts/LanguageContext';

function RFIDReader() {
  const { t } = useTranslation();
  const [isConnected, setIsConnected] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [message, setMessage] = useState("");
  const [tags, setTags] = useState([]);
  const [storedTags, setStoredTags] = useState([]);
  const [races, setRaces] = useState([]);
  const [selectedRace, setSelectedRace] = useState(null);

  // Fetch races when component mounts
  useEffect(() => {
    axios.get("http://localhost:5001/races")
      .then(response => {
        setRaces(response.data.races);
        if (response.data.races.length > 0) {
          setSelectedRace(response.data.races[0].id);
        }
      })
      .catch(error => {
        console.error("Error fetching races:", error);
      });
  }, []);

  const handleConnect = () => {
    setMessage(t('rfidReader.connecting'));
    axios.post("http://localhost:5001/connect")
      .then((response) => {
        if (response.data.status === "connected") {
          setIsConnected(true);
          setMessage(t('rfidReader.connected'));
        } else if (response.data.status === "disconnected") {
          setIsConnected(false);
          setMessage(t('rfidReader.disconnected'));
          setTags([]);
          setIsStarted(false);
        } else {
          setMessage(t('rfidReader.error') + response.data.message);
        }
      })
      .catch(() => {
        setMessage(t('rfidReader.error') + t('rfidReader.connectionFailed'));
      });
  };

  const handleStartStop = () => {
    setIsStarted(!isStarted);
    if (!isStarted) {
      setStoredTags([]);
    }
  };

  useEffect(() => {
    let interval;
    if (isConnected) {
      interval = setInterval(() => {
        axios.get("http://localhost:5001/fetch_taglist")
          .then((response) => {
            if (response.data.status === "success") {
              const fetchedTags = response.data.taglist;
              setTags(fetchedTags);
              
              // Store to BackupTag
              axios.post("http://localhost:5001/store_tags", { 
                tags: fetchedTags,
                race_id: selectedRace
              });

              // Store to results when started
              if (isStarted) {
                axios.post("http://localhost:5001/store_results", { 
                  tags: fetchedTags,
                  race_id: selectedRace 
                })
                .then(() => {
                  setStoredTags(prev => [...new Set([...prev, ...fetchedTags])]);
                });
              }
            } else {
              setMessage(t('rfidReader.error') + response.data.message);
            }
          })
          .catch((error) => {
            setMessage(t('rfidReader.error') + error.message);
          });
      }, 500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected, isStarted, selectedRace]);

  return (
    <div className="rfid-container">
      <h1 className="text-center mb-4">{t('rfidReader.title')}</h1>
      
      {/* Race Selection Dropdown */}
      <div className="race-selection mb-3">
        <label className="mr-2">Select Race: </label>
        <select 
          value={selectedRace || ''} 
          onChange={(e) => setSelectedRace(parseInt(e.target.value))}
          disabled={isStarted}
          className="form-control"
        >
          {races.map(race => (
            <option key={race.id} value={race.id}>
              {race.name} - {race.date}
            </option>
          ))}
        </select>
      </div>

      <div className="button-group mb-3">
        <button 
          onClick={handleConnect} 
          className="btn btn-primary mr-2"
        >
          {isConnected ? 'Disconnect' : 'Connect'}
        </button>
        <button 
          onClick={handleStartStop} 
          disabled={!isConnected || !selectedRace}
          className={`btn ${isStarted ? 'btn-danger' : 'btn-success'}`}
        >
          {isStarted ? 'Stop' : 'Start'}
        </button>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      <div className="row">
        <div className="col-md-6">
          <h3>Current Tags</h3>
          <div className="tag-container">
            {tags.map((tag, index) => (
              <div key={index} className="badge bg-secondary m-1">{tag}</div>
            ))}
          </div>
        </div>
        <div className="col-md-6">
          <h3>Stored Tags</h3>
          <div className="tag-container">
            {storedTags.map((tag, index) => (
              <div key={index} className="badge bg-success m-1">{tag}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RFIDReader;