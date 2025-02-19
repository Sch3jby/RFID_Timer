import React, { useState, useEffect } from 'react';
import axios from 'axios';

const StartEditor = ({ raceId, onClose }) => {
  const [startList, setStartList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tracks, setTracks] = useState([]);

  // Editing states
  const [editingRegistration, setEditingRegistration] = useState(null);
  const [editedfirstname, setEditedfirstname] = useState('');
  const [editedSurname, setEditedSurname] = useState('');
  const [editedNumber, setEditedNumber] = useState('');
  const [editedClub, setEditedClub] = useState('');
  const [editedTrackId, setEditedTrackId] = useState('');
  const [editedStartTime, setEditedStartTime] = useState('');

  const [successMessage, setSuccessMessage] = useState('');

  // Fetch start list and tracks
  const fetchStartList = async () => {
    try {
      setLoading(true);
      // Fetch registrations with user details for the specific race
      const response = await axios.get(`http://localhost:5001/api/race/${raceId}/startlist`);
      setStartList(response.data.startList || []);;

      // Fetch available tracks for this race
      const tracksResponse = await axios.get(`http://localhost:5001/api/tracks?race_id=${raceId}`);
      setTracks(tracksResponse.data.tracks);

      setError(null);
    } catch (err) {
      setStartList([]);
      setError('Failed to load start list');
      console.error('Error fetching start list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStartList();
  }, [raceId]);

  // Validation functions
  const validateTime = (timeStr) => {
    const regex = /^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/;
    return regex.test(timeStr);
  };

  // Handle edit click for a registration
  const handleEditClick = (registration) => {
    setEditingRegistration(registration);
    setEditedfirstname(registration.firstname);
    setEditedSurname(registration.surname);
    setEditedNumber(registration.number || '');
    setEditedClub(registration.club);
    setEditedTrackId(registration.track_id.toString());
    setEditedStartTime(registration.user_start_time || '');
  };

  // Save edited registration
  const handleSaveEdit = async () => {
    if (!editingRegistration) return;

    try {
      const updates = {
        user_id: editingRegistration.user_id,
        registration_id: editingRegistration.registration_id
      };

      // Check and add updates
      if (editedNumber !== (editingRegistration.number || '')) {
        updates.number = editedNumber === '' ? null : parseInt(editedNumber);
      }

      if (editedTrackId !== editingRegistration.track_id.toString()) {
        updates.track_id = parseInt(editedTrackId);
      }

      if (editedStartTime !== (editingRegistration.user_start_time || '')) {
        if (!validateTime(editedStartTime)) {
          setError('Invalid time format. Use HH:MM:SS');
          return;
        }
        updates.user_start_time = editedStartTime;
      }

      // Update user details
      await axios.post(`http://localhost:5001/api/race/${raceId}/startlist/update/user`, {
        user_id: editingRegistration.user_id,
        firstname: editedfirstname,
        surname: editedSurname,
        club: editedClub
      });

      // Update registration details
      await axios.post(`http://localhost:5001/api/race/${raceId}/startlist/update/registration`, updates);

      setSuccessMessage('Changes saved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Refresh data after save
      await fetchStartList();
      setEditingRegistration(null);
      setError(null);
    } catch (err) {
      setError('Failed to save changes: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCancelEdit = () => {
    setEditingRegistration(null);
    setError(null);
  };

  const handleDelete = async (registrationId) => {
    if (!window.confirm('Opravdu chcete odstranit tohoto závodníka? Tato akce odstraní závodníka ze závodu i z databáze uživatelů.')) {
      return;
    }
    
    try {
      await axios.delete(`http://localhost:5001/api/race/${raceId}/startlist/delete/${registrationId}`);
      setSuccessMessage('Závodník byl úspěšně odstraněn ze závodu i z databáze');
      setTimeout(() => setSuccessMessage(''), 3000);
      await fetchStartList();
    } catch (err) {
      setError('Chyba při odstraňování závodníka: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) {
    return (
      <div className="start-editor">
        <div className="start-editor__loading">
          <div className="start-editor__spinner" />
        </div>
      </div>
    );
  }

  if (error && !startList.length) {
    return (
      <div className="start-editor">
        <div className="start-editor__header">
          <h2 className="start-editor__title">Edit Start List</h2>
          <button onClick={onClose} className="start-editor__close">✕</button>
        </div>
        <div className="start-editor__message start-editor__message--error">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="start-editor">
      <div className="start-editor__header">
        <h2 className="start-editor__title">Edit Start List</h2>
        <button onClick={onClose} className="start-editor__close">✕</button>
      </div>

      <div className="start-editor__content">
        {error && (
          <div className="start-editor__message start-editor__message--error">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="start-editor__message start-editor__message--success">
            {successMessage}
          </div>
        )}

        <table className="start-editor__table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Name</th>
              <th>Club</th>
              <th>Track</th>
              <th>Start Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {startList.map((registration) => (
              <tr key={registration.registration_id}>
                <td>
                  {editingRegistration?.registration_id === registration.registration_id ? (
                    <input
                      type="text"
                      value={editedNumber}
                      onChange={(e) => setEditedNumber(e.target.value)}
                      className="start-editor__input"
                      placeholder="Number"
                    />
                  ) : (
                    registration.number || 'No number'
                  )}
                </td>
                <td>
                  {editingRegistration?.registration_id === registration.registration_id ? (
                    <>
                      <input
                        type="text"
                        value={editedfirstname}
                        onChange={(e) => setEditedfirstname(e.target.value)}
                        className="start-editor__input"
                        placeholder="First Name"
                      />
                      <input
                        type="text"
                        value={editedSurname}
                        onChange={(e) => setEditedSurname(e.target.value)}
                        className="start-editor__input"
                        placeholder="Last Name"
                      />
                    </>
                  ) : (
                    `${registration.firstname} ${registration.surname}`
                  )}
                </td>
                <td>
                  {editingRegistration?.registration_id === registration.registration_id ? (
                    <input
                      type="text"
                      value={editedClub}
                      onChange={(e) => setEditedClub(e.target.value)}
                      className="start-editor__input"
                      placeholder="Club"
                    />
                  ) : (
                    registration.club
                  )}
                </td>
                <td>
                  {editingRegistration?.registration_id === registration.registration_id ? (
                    <select
                      value={editedTrackId}
                      onChange={(e) => setEditedTrackId(e.target.value)}
                      className="start-editor__select"
                    >
                      {tracks.map((track) => (
                        <option key={track.id} value={track.id}>
                          {track.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    registration.track_name
                  )}
                </td>
                <td>
                  {editingRegistration?.registration_id === registration.registration_id ? (
                    <input
                      type="text"
                      value={editedStartTime}
                      onChange={(e) => setEditedStartTime(e.target.value)}
                      className="start-editor__input"
                      placeholder="HH:MM:SS"
                    />
                  ) : (
                    registration.user_start_time || 'No start time'
                  )}
                </td>
                <td>
                  <div className="start-editor__actions">
                    {editingRegistration?.registration_id === registration.registration_id ? (
                      <>
                        <button
                          onClick={handleSaveEdit}
                          className="start-editor__button start-editor__button--save"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="start-editor__button start-editor__button--cancel"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEditClick(registration)}
                          className="start-editor__button start-editor__button--edit"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(registration.registration_id)}
                          className="start-editor__button start-editor__button--delete"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StartEditor;