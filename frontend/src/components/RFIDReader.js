// components/RFIDReader.js
import React, { useState, useEffect } from "react";
import { useTranslation } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axiosConfig';
import RaceManagement from './RaceManagement';

/**
 * RFID reader management page showing available races.
 * Displays race list for organizers and allows creating new races.
 * @returns Rendered RFID reader management page
 */

function RFIDReader() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [races, setRaces] = useState([]);
  const [showManagement, setShowManagement] = useState(false);

  useEffect(() => {
    fetchRaces();
  }, []);

  const fetchRaces = async () => {
    try {
      const response = await axios.get("/api/races");
      setRaces(response.data.races);
    } catch (error) {
      console.error("Error fetching races:", error);
    }
  };

  const handleRaceSelect = (raceId) => {
    navigate(`/rfid-reader/${raceId}`);
  };

  if (showManagement) {
    return (
      <RaceManagement 
        onBack={() => {
          setShowManagement(false);
          fetchRaces();
        }}
        initialMode="create"
      />
    );
  }

  return (
    <div className="races-container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>{t('rfidReader.raceSelection')}</h1>
        <button 
          className="btn btn-success" 
          onClick={() => setShowManagement(true)}
        >
          {t('rfidReader.createNewRace')}
        </button>
      </div>
      
      <div className="race-list row">
        {races.map(race => (
          <div 
            key={race.id} 
            className="col"
            onClick={() => handleRaceSelect(race.id)}
          >
            <div className="card race-card">
              <div className="card-body">
                <h5 className="card-title">{race.name}</h5>
                <p className="card-text">
                  <strong>{t('rfidReader.date')}:</strong> {race.date}
                  <br />
                  <strong>{t('rfidReader.description')}:</strong> {race.description}
                </p>
                <button className="btn btn-primary">
                  {t('rfidReader.selectRace')}
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