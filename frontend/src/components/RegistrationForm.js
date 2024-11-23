import React, { useState, useEffect } from "react";
import { useLocation } from 'react-router-dom';
import axios from "axios";
import { useTranslation } from '../contexts/LanguageContext';

function RegistrationForm() {
  const { t } = useTranslation();
  const location = useLocation();
  const [formData, setFormData] = useState({
    forename: '',
    surname: '',
    year: '',
    club: '',
    email: '',
    gender: '',
    race_id: '',
    track_id: ''
  });
  const [races, setRaces] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);
  const [raceInput, setRaceInput] = useState('');
  const [trackInput, setTrackInput] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const racesResponse = await axios.get('http://localhost:5001/races');
        setRaces(racesResponse.data.races);

        // Check for pre-selected race from navigation state
        if (location.state?.preselectedRace) {
          setRaceInput(location.state.preselectedRace);
          
          // Find the corresponding race and set its ID
          const selectedRace = racesResponse.data.races.find(race => 
            `${race.name} - ${race.date}` === location.state.preselectedRace
          );
          
          if (selectedRace) {
            // Fetch tracks for the pre-selected race
            const tracksResponse = await axios.get(`http://localhost:5001/tracks?race_id=${selectedRace.id}`);
            setTracks(tracksResponse.data.tracks);
            
            setFormData(prevData => ({
              ...prevData,
              race_id: selectedRace.id
            }));
          }
        }
      } catch (error) {
        setMessage({ 
          type: 'error', 
          text: t('registration.errorLoadingData') 
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [t, location.state]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleRaceChange = (e) => {
    const inputValue = e.target.value;
    setRaceInput(inputValue);
    
    // Find the corresponding race and set its ID
    const selectedRace = races.find(race => 
      `${race.name} - ${race.date}` === inputValue
    );
    
    setFormData({
      ...formData,
      race_id: selectedRace ? selectedRace.id : '',
      track_id: ''
    });

    // Fetch tracks for the selected race
    const fetchTracks = async () => {
      try {
        const response = await axios.get(`http://localhost:5001/tracks?race_id=${selectedRace?.id}`);
        setTracks(response.data.tracks);
      } catch (error) {
        setMessage({ 
          type: 'error', 
          text: t('registration.errorLoadingTracks') 
        });
      }
    };
    fetchTracks();
  };

  const handleTrackChange = (e) => {
    const inputValue = e.target.value;
    setTrackInput(inputValue);
    
    // Find the corresponding track and set its ID
    const selectedTrack = tracks.find(track => 
      `${track.name} - ${track.distance}km` === inputValue
    );
    
    setFormData({
      ...formData,
      track_id: selectedTrack ? selectedTrack.id : ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5001/registration', formData);
      setMessage({ type: 'success', text: t('registration.success') });
      setFormData({ 
        forename: '', 
        surname: '', 
        year: '', 
        club: '', 
        email: '', 
        gender: '',
        race_id: '',
        track_id: ''
      });
      setRaceInput('');
      setTrackInput('');
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || t('registration.error') 
      });
    }
  };

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>;
  }

  return (
    <div className="form-container">
      <h1 className="text-center mb-4">{t('registration.title')}</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>{t('registration.race')}:</label>
          <input
            list="races"
            type="text"
            value={raceInput}
            onChange={handleRaceChange}
            placeholder={t('registration.select')}
            required
          />
          <datalist id="races">
            {races.map((race) => (
              <option key={race.id} value={`${race.name} - ${race.date}`} />
            ))}
          </datalist>
        </div>
        <div className="form-group">
          <label>{t('registration.track')}:</label>
          <input
            list="tracks"
            type="text"
            value={trackInput}
            onChange={handleTrackChange}
            placeholder={t('registration.select')}
            required
          />
          <datalist id="tracks">
            {tracks.map((track) => (
              <option key={track.id} value={`${track.name} - ${track.distance}km`} />
            ))}
          </datalist>
        </div>
        <div className="form-group">
          <label>{t('registration.firstName')}:</label>
          <input 
            type="text" 
            name="forename" 
            value={formData.forename} 
            onChange={handleChange} 
            required 
          />
        </div>
        <div className="form-group">
          <label>{t('registration.lastName')}:</label>
          <input 
            type="text" 
            name="surname" 
            value={formData.surname} 
            onChange={handleChange} 
            required 
          />
        </div>
        <div className="form-group">
          <label>{t('registration.birthYear')}:</label>
          <input 
            type="text" 
            name="year" 
            value={formData.year} 
            onChange={handleChange} 
            required 
          />
        </div>
        <div className="form-group">
          <label>{t('registration.club')}:</label>
          <input 
            type="text" 
            name="club" 
            value={formData.club} 
            onChange={handleChange} 
            required 
          />
        </div>
        <div className="form-group">
          <label>{t('registration.email')}:</label>
          <input 
            type="email" 
            name="email" 
            value={formData.email} 
            onChange={handleChange} 
            required 
          />
        </div>
        <div className="form-group">
          <label>{t('registration.gender')}:</label>
          <select 
            name="gender" 
            value={formData.gender} 
            onChange={handleChange}
            required
          >
            <option value="">{t('registration.select')}</option>
            <option value="M">{t('registration.male')}</option>
            <option value="F">{t('registration.female')}</option>
          </select>
        </div>
        <button type="submit">{t('registration.register')}</button>
      </form>
      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}

export default RegistrationForm;