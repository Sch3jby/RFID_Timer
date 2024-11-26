import React, { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

function RFIDReader() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [races, setRaces] = useState([]);

  // Fetch races when component mounts
  useEffect(() => {
    axios.get("http://localhost:5001/races")
      .then(response => {
        setRaces(response.data.races);
      })
      .catch(error => {
        console.error("Error fetching races:", error);
      });
  }, []);

  const handleRaceSelect = (raceId) => {
    navigate(`/rfid-reader/${raceId}`);
  };

  return (
    <div className="races-container p-4">
      <h1 className="text-center mb-4">{t('rfidReader.raceSelection')}</h1>
      
      <div className="race-list row">
        {races.map(race => (
          <div 
            key={race.id} 
            className="col-md-4 mb-3"
            onClick={() => handleRaceSelect(race.id)}
          >
            <div className="card race-card">
              <div className="card-body">
                <h5 className="card-title">{race.name}</h5>
                <p className="card-text">
                  <strong>Date:</strong> {race.date}
                  <br />
                  <strong>Description:</strong> {race.description}
                </p>
                <button className="btn btn-primary">
                  Select Race
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RFIDReader;