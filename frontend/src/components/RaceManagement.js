import React, { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../contexts/LanguageContext';

const RaceManagement = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [races, setRaces] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentRace, setCurrentRace] = useState(null);
  
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
    distance: 0,
    min_age: 0,
    max_age: 99,
    fastest_possible_time: '00:00:00',
    number_of_laps: 1,
    expected_start_time: '10:00:00',
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

  const [formData, setFormData] = useState(emptyRace);

  useEffect(() => {
    fetchRaces();
  }, []);

  const fetchRaces = async () => {
    try {
      const response = await fetch("http://localhost:5001/races");
      const data = await response.json();
      setRaces(data.races);
    } catch (error) {
      console.error("Error fetching races:", error);
    }
  };

  const handleInputChange = (e, trackIndex = null, categoryIndex = null) => {
    const { name, value } = e.target;
    
    if (trackIndex === null) {
      setFormData(prev => ({ ...prev, [name]: value }));
    } else if (categoryIndex === null) {
      const newTracks = [...formData.tracks];
      newTracks[trackIndex] = { ...newTracks[trackIndex], [name]: value };
      setFormData(prev => ({ ...prev, tracks: newTracks }));
    } else {
      const newTracks = [...formData.tracks];
      newTracks[trackIndex].categories[categoryIndex] = {
        ...newTracks[trackIndex].categories[categoryIndex],
        [name]: value
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

  const addCategory = (trackIndex) => {
    const newTracks = [...formData.tracks];
    if (!newTracks[trackIndex].categories) {
      newTracks[trackIndex].categories = [];
    }
    newTracks[trackIndex].categories.push({ ...emptyCategory });
    setFormData(prev => ({ ...prev, tracks: newTracks }));
  };

  const removeTrack = (index) => {
    setFormData(prev => ({
      ...prev,
      tracks: prev.tracks.filter((_, i) => i !== index)
    }));
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
      const endpoint = isEditing 
        ? `http://localhost:5001/race/${currentRace.id}/update`
        : 'http://localhost:5001/race/add';
      
      const response = await fetch(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        await fetchRaces();
        setIsEditing(false);
        setFormData(emptyRace);
        setCurrentRace(null);
      }
    } catch (error) {
      console.error("Error saving race:", error);
    }
  };

  const handleEdit = (race) => {
    setIsEditing(true);
    setCurrentRace(race);
    setFormData(race);
  };

  return (
    <div className="container mx-4">
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <h2 className="text-2xl mb-4">
          {isEditing ? t('race.editRace') : t('race.createRace')}
        </h2>
        
        <form onSubmit={handleSubmit}>
          {/* Základní informace o závodu */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block mb-2">{t('race.name')}</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block mb-2">{t('race.date')}</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block mb-2">{t('race.startType')}</label>
              <select
                name="start"
                value={formData.start}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
              >
                <option value="M">{t('race.massStart')}</option>
                <option value="I">{t('race.intervalStart')}</option>
              </select>
            </div>
            {formData.start === 'I' && (
              <div>
                <label className="block mb-2">{t('race.intervalTime')}</label>
                <input
                  type="time"
                  name="interval_time"
                  value={formData.interval_time}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  step="1"
                  required
                />
              </div>
            )}
          </div>

          {/* Tratě */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl">{t('race.tracks')}</h3>
              <button
                type="button"
                onClick={addTrack}
                className="bg-blue-500 text-white px-4 py-2 rounded"
              >
                {t('race.addTrack')}
              </button>
            </div>

            {formData.tracks.map((track, trackIndex) => (
              <div key={trackIndex} className="border p-4 rounded mb-4">
                <div className="flex justify-between mb-4">
                  <h4>{t('race.track')} {trackIndex + 1}</h4>
                  <button
                    type="button"
                    onClick={() => removeTrack(trackIndex)}
                    className="text-red-500"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    name="name"
                    value={track.name}
                    onChange={(e) => handleInputChange(e, trackIndex)}
                    placeholder={t('race.trackName')}
                    className="p-2 border rounded"
                  />
                  <input
                    type="number"
                    name="distance"
                    value={track.distance}
                    onChange={(e) => handleInputChange(e, trackIndex)}
                    placeholder={t('race.distance')}
                    className="p-2 border rounded"
                  />
                  <input
                    type="number"
                    name="min_age"
                    value={track.min_age}
                    onChange={(e) => handleInputChange(e, trackIndex)}
                    placeholder={t('race.minAge')}
                    className="p-2 border rounded"
                  />
                  <input
                    type="number"
                    name="max_age"
                    value={track.max_age}
                    onChange={(e) => handleInputChange(e, trackIndex)}
                    placeholder={t('race.maxAge')}
                    className="p-2 border rounded"
                  />
                  <input
                    type="time"
                    name="fastest_possible_time"
                    value={track.fastest_possible_time}
                    onChange={(e) => handleInputChange(e, trackIndex)}
                    className="p-2 border rounded"
                    step="1"
                  />
                  <input
                    type="time"
                    name="expected_start_time"
                    value={track.expected_start_time}
                    onChange={(e) => handleInputChange(e, trackIndex)}
                    className="p-2 border rounded"
                    step="1"
                  />
                  <input
                    type="number"
                    name="number_of_laps"
                    value={track.number_of_laps}
                    onChange={(e) => handleInputChange(e, trackIndex)}
                    placeholder={t('race.numberOfLaps')}
                    className="p-2 border rounded"
                  />
                </div>

                {/* Kategorie */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h5>{t('race.categories')}</h5>
                    <button
                      type="button"
                      onClick={() => addCategory(trackIndex)}
                      className="bg-green-500 text-white px-3 py-1 rounded text-sm"
                    >
                      {t('race.addCategory')}
                    </button>
                  </div>

                  {track.categories && track.categories.map((category, categoryIndex) => (
                    <div key={categoryIndex} className="grid grid-cols-3 gap-2 mb-2">
                      <input
                        type="text"
                        name="category_name"
                        value={category.category_name}
                        onChange={(e) => handleInputChange(e, trackIndex, categoryIndex)}
                        placeholder={t('race.categoryName')}
                        className="p-2 border rounded"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          name="min_age"
                          value={category.min_age}
                          onChange={(e) => handleInputChange(e, trackIndex, categoryIndex)}
                          placeholder={t('race.minAge')}
                          className="p-2 border rounded"
                        />
                        <input
                          type="number"
                          name="max_age"
                          value={category.max_age}
                          onChange={(e) => handleInputChange(e, trackIndex, categoryIndex)}
                          placeholder={t('race.maxAge')}
                          className="p-2 border rounded"
                        />
                      </div>
                      <div className="flex gap-2">
                        <select
                          name="gender"
                          value={category.gender}
                          onChange={(e) => handleInputChange(e, trackIndex, categoryIndex)}
                          className="p-2 border rounded"
                        >
                          <option value="M">{t('race.male')}</option>
                          <option value="F">{t('race.female')}</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeCategory(trackIndex, categoryIndex)}
                          className="text-red-500 px-2"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Tlačítka */}
          <div className="flex justify-end gap-4">
            {isEditing && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setFormData(emptyRace);
                  setCurrentRace(null);
                }}
                className="px-4 py-2 border rounded hover:bg-gray-100"
              >
                {t('common.cancel')}
              </button>
            )}
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              {isEditing ? t('common.save') : t('common.create')}
            </button>
          </div>
        </form>
      </div>

      {/* Seznam závodů */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {races.map(race => (
          <div key={race.id} className="border rounded p-4 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl">{race.name}</h3>
              <button
                onClick={() => handleEdit(race)}
                className="text-blue-500 hover:text-blue-700"
              >
                ✎
              </button>
            </div>
            <p>{t('race.date')}: {race.date}</p>
            <p>
              {t('race.startType')}: {race.start === 'M' ? t('race.massStart') : t('race.intervalStart')}
            </p>
            {race.tracks && (
              <p>{t('race.tracks')}: {race.tracks.length}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RaceManagement;