import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from 'react-router-dom';
import axios from "axios";
import { useTranslation } from '../contexts/LanguageContext';

function RegistrationForm() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstname: '',
    surname: '',
    year: '',
    club: '',
    email: '',
    gender: '',
    race_id: '',
    track_id: ''
  });
  const [userRole, setUserRole] = useState(null);
  const [races, setRaces] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);
  const [raceInput, setRaceInput] = useState('');
  const [trackInput, setTrackInput] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          navigate('/login');
          return;
        }

        const userResponse = await axios.get('http://localhost:5001/api/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        setUserRole(userResponse.data.role);
        setFormData(prevData => ({
          ...prevData,
          email: userResponse.data.email
        }));

        const racesResponse = await axios.get('http://localhost:5001/api/races', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        setRaces(racesResponse.data.races);

        if (location.state?.preselectedRace) {
          setRaceInput(location.state.preselectedRace);
          
          const selectedRace = racesResponse.data.races.find(race => 
            `${race.name} - ${race.date}` === location.state.preselectedRace
          );
          
          if (selectedRace) {
            const tracksResponse = await axios.get(
              `http://localhost:5001/api/tracks?race_id=${selectedRace.id}`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              }
            );
            setTracks(tracksResponse.data.tracks);
            
            setFormData(prevData => ({
              ...prevData,
              race_id: selectedRace.id
            }));
          }
        }
      } catch (error) {
        if (error.response?.status === 401) {
          navigate('/login');
        } else {
          setMessage({ 
            type: 'error', 
            text: t('registration.errorLoadingData') 
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [t, location.state, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleRaceChange = async (e) => {
    const inputValue = e.target.value;
    setRaceInput(inputValue);
    
    const selectedRace = races.find(race => 
      `${race.name} - ${race.date}` === inputValue
    );
    
    setFormData({
      ...formData,
      race_id: selectedRace ? selectedRace.id : '',
      track_id: ''
    });
    setTrackInput('');

    if (selectedRace) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.get(
          `http://localhost:5001/api/tracks?race_id=${selectedRace.id}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        setTracks(response.data.tracks);
      } catch (error) {
        if (error.response?.status === 401) {
          navigate('/login');
        } else {
          setMessage({ 
            type: 'error', 
            text: t('registration.errorLoadingTracks') 
          });
        }
      }
    } else {
      setTracks([]);
    }
  };

  const handleTrackChange = (e) => {
    const inputValue = e.target.value;
    setTrackInput(inputValue);
    
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
      const token = localStorage.getItem('access_token');
      const response = await axios.post(
        'http://localhost:5001/api/registration',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      setMessage({ type: 'success', text: t('registration.success') });
      
      setFormData(prevData => ({ 
        firstname: '', 
        surname: '', 
        year: '', 
        club: '', 
        email: prevData.email,
        gender: '',
        race_id: '',
        track_id: ''
      }));
      setRaceInput('');
      setTrackInput('');
    } catch (error) {
      if (error.response?.status === 401) {
        navigate('/login');
      } else {
        setMessage({ 
          type: 'error', 
          text: error.response?.data?.error || t('registration.error') 
        });
      }
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
            name="firstname" 
            value={formData.firstname} 
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
            readOnly={userRole !== 1}
            className={userRole !== 1 ? "readonly-input" : ""}
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

        <button type="submit" className="submit-button">
          {t('registration.register')}
        </button>
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