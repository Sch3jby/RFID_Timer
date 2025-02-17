import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../contexts/LanguageContext";
import UserRaceResults from "./UserRaceResults";

function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [selectedRaceId, setSelectedRaceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserRegistrations = async () => {
      const token = localStorage.getItem('access_token');
      
      if (!token) {
        navigate('/login');
        return;
      }
      
      try {
        const response = await fetch('http://localhost:5001/api/me/registrations', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('access_token');
            navigate('/login');
            throw new Error(t('profile.unauthorized'));
          }
          throw new Error(t('profile.loadError'));
        }
        
        const data = await response.json();
        setUserData(data.user);
        setRegistrations(data.registrations);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRegistrations();
  }, [navigate, t]);

  const handleViewResults = (raceId) => {
    setSelectedRaceId(raceId);
  };

  if (loading) return <div className="profile-container loading">{t('common.loading')}</div>;
  if (error) return <div className="profile-container error">{error}</div>;

  return (
    <div className="profile-container">
      <h1>{t('profile.title')}</h1>
      
      {userData && (
        <div className="user-info-card">
          <h2>{userData.firstname} {userData.surname} ({userData.nickname})</h2>
          <p>{t('profile.email')}: {userData.email}</p>
        </div>
      )}
      
      <div className="registrations-section">
        <h2>{t('profile.yourRegistrations')}</h2>
        
        {registrations.length === 0 ? (
          <p className="no-registrations">{t('profile.noRegistrations')}</p>
        ) : (
          <div className="registrations-table-container">
            <table className="registrations-table">
              <thead>
                <tr>
                  <th>{t('profile.firstname')}</th>
                  <th>{t('profile.surname')}</th>
                  <th>{t('profile.race')}</th>
                  <th>{t('profile.date')}</th>
                  <th>{t('profile.track')}</th>
                  <th>{t('profile.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map(reg => (
                  <tr key={reg.registration_id}>
                    <td>{reg.user.firstname}</td>
                    <td>{reg.user.surname}</td>
                    <td>{reg.race.name}</td>
                    <td>{reg.race.date}</td>
                    <td>
                      {reg.track.name} ({reg.track.distance} km,{' '}
                      {t('profile.laps')}: {reg.track.number_of_laps})
                    </td>
                    <td>
                      <button 
                        className="view-results-btn"
                        onClick={() => handleViewResults(reg.race.id)}
                      >
                        {t('profile.viewResults')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {selectedRaceId && (
        <UserRaceResults raceId={selectedRaceId} />
      )}
    </div>
  );
}

export default ProfilePage;