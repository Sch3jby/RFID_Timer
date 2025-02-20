import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../contexts/LanguageContext";
import UserRaceResults from "./UserRaceResults";

function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [registrations, setRegistrations] = useState([]);
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
        const response = await fetch('/api/me/registrations', {
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

  const getUniqueRaces = (registrations) => {
    const uniqueRaces = new Map();
    
    registrations.forEach(reg => {
      const raceId = reg.race.id;
      if (!uniqueRaces.has(raceId)) {
        uniqueRaces.set(raceId, {
          id: raceId,
          name: reg.race.name
        });
      }
    });
    
    return Array.from(uniqueRaces.values());
  };

  if (loading) return <div className="profile-container loading">{t('common.loading')}</div>;
  if (error) return <div className="profile-container error">{error}</div>;

  const uniqueRaces = getUniqueRaces(registrations);

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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {uniqueRaces.map(race => (
        <div key={`results-${race.id}`} className="race-results-section">
          <h3>{race.name} - {t('profile.results')}</h3>
          <UserRaceResults raceId={race.id} />
        </div>
      ))}
    </div>
  );
}

export default ProfilePage;