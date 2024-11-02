import React, { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from '../contexts/LanguageContext';

function StartList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { t } = useTranslation();

  useEffect(() => {
    axios.get('http://localhost:5001/startlist')
      .then(response => {
        setUsers(response.data.users);
        setLoading(false);
      })
      .catch(error => {
        setError(t('startList.error'));
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="container">{t('startList.')}</div>;
  if (error) return <div className="container">{error}</div>;

  return (
    <div className="container">
      <h1>{t('startList.title')}</h1>
      <table className="startlist-table">
        <thead>
          <tr>
            <th>{t('startList.columns.firstName')}</th>
            <th>{t('startList.columns.lastName')}</th>
            <th>{t('startList.columns.club')}</th>
            <th>{t('startList.columns.category')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => (
            <tr key={index}>
              <td>{user.forename}</td>
              <td>{user.surname}</td>
              <td>{user.club}</td>
              <td>{user.category}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default StartList;