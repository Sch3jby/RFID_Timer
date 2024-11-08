import React, { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from '../contexts/LanguageContext';

function StartList() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const fetchStartlist = async () => {
      try {
        const response = await axios.get('http://localhost:5001/startlist');
        setUsers(response.data.users);
        setFilteredUsers(response.data.users);
      } catch (error) {
        setMessage({ 
          type: 'error', 
          text: t('startList.error') 
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStartlist();
  }, [t]);

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);

    const filtered = users.filter((user) => {
      const fullName = `${user.forename.toLowerCase()} ${user.surname.toLowerCase()}`;
      const club = user.club.toLowerCase();
      const category = user.category.toLowerCase();
      const race = user.race_name.toLowerCase();

      return (
        fullName.includes(query) ||
        club.includes(query) ||
        category.includes(query) ||
        race.includes(query)
      );
    });

    setFilteredUsers(filtered);
  };

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>;
  }

  if (message.text) {
    return (
      <div className={`message ${message.type}`}>
        {message.text}
      </div>
    );
  }

  return (
    <div className="startlist-container">
      <h1 className="text-center mb-4">{t('startList.title')}</h1>
      <div className="search-container">
        <input
          type="text"
          placeholder={t('startList.search')}
          value={searchQuery}
          onChange={handleSearch}
        />
      </div>
      <table className="startlist-table">
        <thead>
          <tr>
            <th>{t('startList.columns.name')}</th>
            <th>{t('startList.columns.club')}</th>
            <th>{t('startList.columns.category')}</th>
            <th>{t('startList.columns.race')}</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map((user, index) => (
            <tr key={index}>
              <td>{user.forename} {user.surname}</td>
              <td>{user.club}</td>
              <td>{user.category}</td>
              <td>{user.race_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default StartList;