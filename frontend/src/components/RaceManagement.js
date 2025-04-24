// components/RaceManagement.js
import React, { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import axios from '../api/axiosConfig';
import { useTranslation } from '../contexts/LanguageContext';

const emptyRace = {
  name: '',
  date: new Date().toISOString().split('T')[0],
  start: 'M',
  description: '',
  interval_time: '00:00:00',
  tracks: []
};

const emptyTrack = {
  name: '',
  distance: 0.0,
  min_age: 0,
  max_age: 99,
  fastest_possible_time: '00:00:45',
  number_of_laps: 1,
  expected_start_time: '12:00:00',
  categories: []
};

const emptyCategory = {
  category_name: '',
  min_age: 0,
  max_age: 99,
  min_number: 1,
  max_number: 999,
  gender: 'M'
};

/**
 * Race management component for creating and editing races.
 * Handles complex race configuration with tracks and categories.
 * 
 * @param {function} onBack - Callback for navigation back 
 * @returns Rendered race management interface
 */

const RaceManagement = ({ onBack }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [races, setRaces] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentRace, setCurrentRace] = useState(null);
  const [formData, setFormData] = useState(emptyRace);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchRaces();
  }, []);

  const fetchRaces = async () => {
    try {
      const response = await axios.get('/api/races');
      setRaces(response.data.races);
    } catch (error) {
      console.error('Error fetching races:', error);
      setErrorMessage(t('raceManagement.errorFetchingRaces'));
    }
  };

  const prepareFormDataForSubmission = (data) => {
    const formattedData = JSON.parse(JSON.stringify(data));
    return formattedData;
  };

  const handleInputChange = (e, trackIndex = null, categoryIndex = null) => {
    const { name, value } = e.target;
    
    const processValue = (name, value) => {
      switch(name) {
        case 'distance':
          return parseFloat(value) || 0;
        case 'min_age':
        case 'max_age':
        case 'number_of_laps':
        case 'min_number':
        case 'max_number':
          return parseInt(value) || 0;
        default:
          return value;
      }
    };
    
    if (trackIndex === null) {
      setFormData(prev => ({ ...prev, [name]: processValue(name, value) }));
    } else if (categoryIndex === null) {
      const newTracks = [...formData.tracks];
      newTracks[trackIndex] = { 
        ...newTracks[trackIndex], 
        [name]: processValue(name, value) 
      };
      setFormData(prev => ({ ...prev, tracks: newTracks }));
    } else {
      const newTracks = [...formData.tracks];
      newTracks[trackIndex].categories[categoryIndex] = {
        ...newTracks[trackIndex].categories[categoryIndex],
        [name]: processValue(name, value)
      };
      setFormData(prev => ({ ...prev, tracks: newTracks }));
    }
  };

  const addTrack = () => {
    setFormData(prev => ({
      ...prev,
      tracks: [...prev.tracks, { ...emptyTrack, categories: [] }]
    }));
  };

  const removeTrack = (index) => {
    setFormData(prev => ({
      ...prev,
      tracks: prev.tracks.filter((_, i) => i !== index)
    }));
  };

  const addCategory = (trackIndex) => {
    const newTracks = [...formData.tracks];
    if (!newTracks[trackIndex].categories) {
      newTracks[trackIndex].categories = [];
    }
    newTracks[trackIndex].categories.push({ ...emptyCategory });
    setFormData(prev => ({ ...prev, tracks: newTracks }));
  };

  const removeCategory = (trackIndex, categoryIndex) => {
    const newTracks = [...formData.tracks];
    newTracks[trackIndex].categories = newTracks[trackIndex].categories.filter(
      (_, i) => i !== categoryIndex
    );
    setFormData(prev => ({ ...prev, tracks: newTracks }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setErrorMessage('');
      
      const dataToSubmit = prepareFormDataForSubmission(formData);
      
      if (isEditing) {
        await axios.put(`/api/race/${currentRace.id}/update`, dataToSubmit);
      } else {
        await axios.post('/api/race/add', dataToSubmit);
      }
      
      await fetchRaces();
      resetForm();
    } catch (error) {
      console.error("Error saving race:", error);
      
      if (error.response && error.response.data && error.response.data.message) {
        setErrorMessage(`${t('raceManagement.errorSavingRace')}: ${error.response.data.message}`);
      } else {
        setErrorMessage(t('raceManagement.errorSavingRace'));
      }
    }
  };

  const handleDelete = async (raceId) => {
    try {
      const confirmDelete = window.confirm(t('raceManagement.confirmDelete'));
      
      if (confirmDelete) {
        setErrorMessage('');
        
        await axios.delete(`/api/race/${raceId}/delete`);
        
        await fetchRaces();
        
        resetForm();
        
        alert(t('raceManagement.raceDeletedSuccessfully'));
      }
    } catch (error) {
      console.error("Error deleting race:", error);
      setErrorMessage(t('raceManagement.errorDeletingRace'));
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setFormData(emptyRace);
    setCurrentRace(null);
    setErrorMessage('');
  };

  const handleEdit = (race) => {
    setIsEditing(true);
    setCurrentRace(race);
    setFormData(race);
  };

  const handleBack = () => {
    onBack();
  };

  return (
    <div className="race-manager">
      <div className="race-form">
        <h2 className="text">
          {isEditing ? t('raceManagement.editRace') : t('raceManagement.createRace')}
        </h2>
        <button
          onClick={handleBack}
          className="btn btn-secondary"
        >
          {t('common.back')}
        </button>
        
        {errorMessage && (
          <div className="error-message text-red-500 mt-2 mb-4">
            {errorMessage}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="race-form-grid">
            <div className="race-form-group">
              <label className="race-form-label">{t('raceManagement.name')}</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="form-input"
                required
              />
            </div>
            
            <div className="race-form-group">
              <label className="race-form-label">{t('raceManagement.date')}</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                className="race-form-input"
                required
              />
            </div>

            <div className="race-form-group">
              <label className="race-form-label">{t('raceManagement.startType')}</label>
              <select
                name="start"
                value={formData.start}
                onChange={handleInputChange}
                className="race-form-input"
              >
                <option value="M">{t('raceManagement.massStart')}</option>
                <option value="I">{t('raceManagement.intervalStart')}</option>
              </select>
            </div>

            {formData.start === 'I' && (
              <div className="race-form-group">
                <label className="race-form-label">{t('raceManagement.intervalTime')}</label>
                <input
                  type="time"
                  name="interval_time"
                  value={formData.interval_time}
                  onChange={handleInputChange}
                  className="race-form-input"
                  step="1"
                  required
                />
              </div>
            )}
          </div>

          <div className="race-track-section">
            <div className="race-section-header">
              <h3 className="text-lg font-semibold">
                {t('raceManagement.tracks')}
              </h3>
              <button 
                type="button" 
                onClick={addTrack}
                className="race-add-btn"
              >
                {t('raceManagement.addTrack')}
              </button>
            </div>

            {formData.tracks.map((track, trackIndex) => (
              <div key={trackIndex} className="race-track-item">
                <div className="race-track-header">
                  <h4 className="text-md font-medium">
                    <span className="race-track-number">{trackIndex + 1}</span>
                    {track.name || t('raceManagement.track')}
                  </h4>
                  <button 
                    type="button"
                    onClick={() => removeTrack(trackIndex)}
                    className="race-remove-btn"
                  >
                    {t('common.remove')}
                  </button>
                </div>

                <div className="race-hierarchy-indicator">
                  <span>{t('raceManagement.race')}</span>
                  <span>{t('raceManagement.track')} {trackIndex + 1}</span>
                </div>

                <div className="race-form-grid">
                  <div className="race-form-group">
                    <label className="race-form-label">{t('raceManagement.trackName')}</label>
                    <input
                      type="text"
                      name="name"
                      value={track.name}
                      onChange={(e) => handleInputChange(e, trackIndex)}
                      className="race-form-input"
                    />
                  </div>
                  <div className="race-form-group">
                    <label className="race-form-label">{t('raceManagement.distance')}</label>
                    <input
                      type="number"
                      name="distance"
                      value={track.distance}
                      step="0.1"
                      min="0"
                      onChange={(e) => handleInputChange(e, trackIndex)}
                      className="race-form-input"
                      required
                    />
                  </div>
                  <div className="race-form-group">
                    <label className="race-form-label">{t('raceManagement.minAge')}</label>
                    <input
                      type="number"
                      name="min_age"
                      value={track.min_age}
                      onChange={(e) => handleInputChange(e, trackIndex)}
                      className="race-form-input"
                    />
                  </div>
                  <div className="race-form-group">
                    <label className="race-form-label">{t('raceManagement.maxAge')}</label>
                    <input
                      type="number"
                      name="max_age"
                      value={track.max_age}
                      onChange={(e) => handleInputChange(e, trackIndex)}
                      className="race-form-input"
                    />
                  </div>
                  <div className="race-form-group">
                    <label className="race-form-label">{t('raceManagement.fastestTime')}</label>
                    <input
                      type="time"
                      name="fastest_possible_time"
                      value={track.fastest_possible_time}
                      onChange={(e) => handleInputChange(e, trackIndex)}
                      className="race-form-input"
                      step="1"
                    />
                  </div>
                  <div className="race-form-group">
                    <label className="race-form-label">{t('raceManagement.startTime')}</label>
                    <input
                      type="time"
                      name="expected_start_time"
                      value={track.expected_start_time}
                      onChange={(e) => handleInputChange(e, trackIndex)}
                      className="race-form-input"
                      step="1"
                    />
                  </div>
                  <div className="race-form-group">
                    <label className="race-form-label">{t('raceManagement.numberOfLaps')}</label>
                    <input
                      type="number"
                      name="number_of_laps"
                      value={track.number_of_laps}
                      onChange={(e) => handleInputChange(e, trackIndex)}
                      className="race-form-input"
                    />
                  </div>
                </div>

                <div className="race-category-section">
                  <div className="race-section-header">
                    <h5 className="text-md font-medium">
                      {t('raceManagement.categories')}
                    </h5>
                    <button
                      type="button"
                      onClick={() => addCategory(trackIndex)}
                      className="race-add-btn"
                    >
                      {t('raceManagement.addCategory')}
                    </button>
                  </div>

                  {track.categories?.map((category, categoryIndex) => (
                    <div key={categoryIndex} className="race-category-item">
                      <button
                        type="button"
                        onClick={() => removeCategory(trackIndex, categoryIndex)}
                        className="race-remove-btn"
                      >
                        {t('common.remove')}
                      </button>
                      
                      <div className="race-hierarchy-indicator">
                        <span>{t('raceManagement.track')} {trackIndex + 1}</span>
                        <span>{t('raceManagement.category')} {categoryIndex + 1}</span>
                      </div>
                      <div className="race-form-grid">
                        <div className="race-form-group">
                          <label className="race-form-label">{t('raceManagement.categoryName')}</label>
                          <input
                            type="text"
                            name="category_name"
                            value={category.category_name}
                            onChange={(e) => handleInputChange(e, trackIndex, categoryIndex)}
                            className="race-form-input"
                          />
                        </div>
                        <div className="race-form-group">
                          <label className="race-form-label">{t('raceManagement.categoryMinAge')}</label>
                          <input
                            type="number"
                            name="min_age"
                            value={category.min_age}
                            onChange={(e) => handleInputChange(e, trackIndex, categoryIndex)}
                            className="race-form-input"
                          />
                        </div>
                        <div className="race-form-group">
                          <label className="race-form-label">{t('raceManagement.categoryMaxAge')}</label>
                          <input
                            type="number"
                            name="max_age"
                            value={category.max_age}
                            onChange={(e) => handleInputChange(e, trackIndex, categoryIndex)}
                            className="race-form-input"
                          />
                        </div>
                        <div className="race-form-group">
                          <label className="race-form-label">{t('raceManagement.gender')}</label>
                          <select
                            name="gender"
                            value={category.gender}
                            onChange={(e) => handleInputChange(e, trackIndex, categoryIndex)}
                            className="race-form-input"
                          >
                            <option value="M">{t('raceManagement.male')}</option>
                            <option value="F">{t('raceManagement.female')}</option>
                          </select>
                        </div>
                        <div className="race-form-group">
                          <label className="race-form-label">{t('raceManagement.categoryMinNumber')}</label>
                          <input
                            type="number"
                            name="min_number"
                            value={category.min_number}
                            onChange={(e) => handleInputChange(e, trackIndex, categoryIndex)}
                            className="race-form-input"
                          />
                        </div>
                        <div className="race-form-group">
                          <label className="race-form-label">{t('raceManagement.categoryMaxNumber')}</label>
                          <input
                            type="number"
                            name="max_number"
                            value={category.max_number}
                            onChange={(e) => handleInputChange(e, trackIndex, categoryIndex)}
                            className="race-form-input"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-4 mt-6">
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="race-cancel-btn"
              >
                {t('common.cancel')}
              </button>
            )}
            <button type="submit" className="race-btn btn-primary">
              {isEditing ? t('common.save') : t('common.create')}
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {races.map(race => (
          <div key={race.id} className="race-race-card">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">{race.name}</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleEdit(race)}
                  className="race-edit-btn"
                >
                  {t('common.edit')}
                </button>
                <button 
                  onClick={() => handleDelete(race.id)}
                  className="race-delete-btn"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
            <p>{t('raceManagement.date')}: {race.date}</p>
            <p>
              {t('raceManagement.startType')}: {' '}
              {race.start === 'M' ? t('raceManagement.massStart') : t('raceManagement.intervalStart')}
            </p>
            <p>{t('raceManagement.tracks')}: {race.tracks?.length || 0}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RaceManagement;