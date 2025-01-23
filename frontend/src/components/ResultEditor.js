import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ResultEditor = ({ raceId, onClose }) => {
  const [results, setResults] = useState([]);
  const [laps, setLaps] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingResult, setEditingResult] = useState(null);
  const [editingLap, setEditingLap] = useState(null);
  const [editedTime, setEditedTime] = useState('');
  const [editedLastSeenTime, setEditedLastSeenTime] = useState('');
  const [editedStatus, setEditedStatus] = useState('');
  const [editedLapTime, setEditedLapTime] = useState('');
  const [editedTimestamp, setEditedTimestamp] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [expandedRunner, setExpandedRunner] = useState(null);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:5001/race/${raceId}/results`);
      setResults(response.data.results);
      setError(null);
      
      // Refresh laps data if a runner is expanded
      if (expandedRunner) {
        await fetchRunnerLaps(expandedRunner);
      }
    } catch (err) {
      setError('Failed to load results');
      console.error('Error fetching results:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [raceId]);

  const fetchRunnerLaps = async (number) => {
    try {
      const response = await axios.get(`http://localhost:5001/race/${raceId}/racer/${number}/laps`);
      setLaps(prev => ({ ...prev, [number]: response.data.laps }));
    } catch (err) {
      setError(`Failed to load laps for runner ${number}`);
      console.error('Error fetching laps:', err);
    }
  };

  const handleEditClick = (result) => {
    setEditingResult(result);
    setEditedTime(result.race_time || '');
    setEditedLastSeenTime(result.last_seen_time || '');
    setEditedStatus(result.status || '');
  };

  const handleEditLapClick = (lap) => {
    setEditingLap(lap);
    setEditedLapTime(lap.lap_time || '');
    setEditedTimestamp(lap.timestamp || '');
  };

  const validateTime = (timeStr) => {
    const regex = /^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.(\d{1,3}))?$/;
    return regex.test(timeStr);
  };

  const addMilliseconds = (timeStr) => {
    return timeStr.includes('.') ? timeStr : timeStr + '.000';
  };

  const handleSaveLapEdit = async () => {
    if (!editingLap || !expandedRunner) return;

    try {
      let payload = {
        number: expandedRunner,
        lap_number: editingLap.lap_number
      };

      if (editedLapTime !== editingLap.lap_time) {
        if (!validateTime(editedLapTime)) {
          setError('Invalid time format. Use HH:MM:SS');
          return;
        }
        payload.lap_time = addMilliseconds(editedLapTime);
      }

      if (editedTimestamp !== editingLap.timestamp) {
        if (!validateTime(editedTimestamp)) {
          setError('Invalid time format. Use HH:MM:SS');
          return;
        }
        payload.timestamp = addMilliseconds(editedTimestamp);
      }

      await axios.post(`http://localhost:5001/race/${raceId}/lap/update`, payload);
      
      setSuccessMessage('Lap updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Refresh both results and laps
      await fetchResults();
      setEditingLap(null);
      setEditedLapTime('');
      setEditedTimestamp('');
      setError(null);
    } catch (err) {
      setError('Failed to save lap: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSaveEdit = async () => {
    if (!editingResult) return;

    try {
      const updates = {};
      
      if (editedStatus !== (editingResult.status || '')) {
        updates.status = editedStatus === "" ? null : editedStatus;
      }
      
      if (editedLastSeenTime !== (editingResult.last_seen_time || '')) {
        if (!validateTime(editedLastSeenTime)) {
          setError('Invalid time format. Use HH:MM:SS');
          return;
        }
        updates.last_seen_time = addMilliseconds(editedLastSeenTime);
      }
      
      if (editedTime !== (editingResult.race_time || '')) {
        if (!validateTime(editedTime)) {
          setError('Invalid time format. Use HH:MM:SS');
          return;
        }
        updates.time = addMilliseconds(editedTime);
      }

      await axios.post(`http://localhost:5001/race/${raceId}/result/update`, {
        number: editingResult.number,
        track_id: editingResult.track_id,
        ...updates
      });

      setSuccessMessage('Changes saved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Refresh data after save
      await fetchResults();
      setEditingResult(null);
      setEditedTime('');
      setEditedLastSeenTime('');
      setEditedStatus('');
      setError(null);
    } catch (err) {
      setError('Failed to save changes: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCancelEdit = () => {
    setEditingResult(null);
    setEditedTime('');
    setEditedLastSeenTime('');
    setEditedStatus('');
    setError(null);
  };

  const handleCancelLapEdit = () => {
    setEditingLap(null);
    setEditedLapTime('');
    setEditedTimestamp('');
    setError(null);
  };

  const toggleRunner = async (number) => {
    if (expandedRunner === number) {
      setExpandedRunner(null);
    } else {
      setExpandedRunner(number);
      await fetchRunnerLaps(number);
    }
  };

  if (loading) {
    return (
      <div className="result-editor">
        <div className="result-editor__loading">
          <div className="result-editor__spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="result-editor">
      <div className="result-editor__header">
        <h2 className="result-editor__title">Edit Result List</h2>
        <button onClick={onClose} className="result-editor__close">✕</button>
      </div>

      <div className="result-editor__content">
        {error && (
          <div className="result-editor__message result-editor__message--error">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="result-editor__message result-editor__message--success">
            {successMessage}
          </div>
        )}

        <table className="result-editor__table">
          <thead>
            <tr>
              <th>Position</th>
              <th>Number</th>
              <th>Name</th>
              <th>Track</th>
              <th>Category</th>
              <th>Race Time</th>
              <th>Finnish Time</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <React.Fragment key={result.number}>
                <tr>
                  <td>{result.position_track}</td>
                  <td>{result.number}</td>
                  <td>{result.name}</td>
                  <td>{result.track}</td>
                  <td>{result.category}</td>
                  <td>
                    {editingResult?.number === result.number ? (
                      <input
                        type="text"
                        value={editedTime}
                        onChange={(e) => setEditedTime(e.target.value)}
                        className="result-editor__input"
                        placeholder="HH:MM:SS"
                      />
                    ) : (
                      result.race_time
                    )}
                  </td>
                  <td>
                    {editingResult?.number === result.number ? (
                      <input
                        type="text"
                        value={editedLastSeenTime}
                        onChange={(e) => setEditedLastSeenTime(e.target.value)}
                        className="result-editor__input"
                        placeholder="HH:MM:SS"
                      />
                    ) : (
                      result.last_seen_time
                    )}
                  </td>
                  <td>
                    {editingResult?.number === result.number ? (
                      <select
                        value={editedStatus}
                        onChange={(e) => setEditedStatus(e.target.value)}
                        className="result-editor__select"
                      >
                        <option value="">None</option>
                        <option value="DNF">DNF</option>
                        <option value="DNS">DNS</option>
                        <option value="DSQ">DSQ</option>
                      </select>
                    ) : (
                      result.status || 'None'
                    )}
                  </td>
                  <td>
                    <div className="result-editor__actions">
                      {editingResult?.number === result.number ? (
                        <>
                          <button
                            onClick={handleSaveEdit}
                            className="result-editor__button result-editor__button--save"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="result-editor__button result-editor__button--cancel"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEditClick(result)}
                            className="result-editor__button result-editor__button--edit"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleRunner(result.number)}
                            className="result-editor__button result-editor__button--edit"
                          >
                            {expandedRunner === result.number ? 'Hide Laps' : 'Show Laps'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedRunner === result.number && (
                  <tr>
                    <td colSpan="9">
                      <table className="result-editor__table">
                        <thead>
                          <tr>
                            <th>Lap</th>
                            <th>Timestamp</th>
                            <th>Lap Time</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {laps[result.number]?.map((lap) => (
                            <tr key={lap.lap_number}>
                              <td>{lap.lap_number}</td>
                              <td>
                                {editingLap?.lap_number === lap.lap_number ? (
                                  <input
                                    type="text"
                                    value={editedTimestamp}
                                    onChange={(e) => setEditedTimestamp(e.target.value)}
                                    className="result-editor__input"
                                    placeholder="HH:MM:SS"
                                  />
                                ) : (
                                  lap.timestamp
                                )}
                              </td>
                              <td>
                                {editingLap?.lap_number === lap.lap_number ? (
                                  <input
                                    type="text"
                                    value={editedLapTime}
                                    onChange={(e) => setEditedLapTime(e.target.value)}
                                    className="result-editor__input"
                                    placeholder="HH:MM:SS"
                                  />
                                ) : (
                                  lap.lap_time
                                )}
                              </td>
                              <td>
                                <div className="result-editor__actions">
                                  {editingLap?.lap_number === lap.lap_number ? (
                                    <>
                                      <button
                                        onClick={handleSaveLapEdit}
                                        className="result-editor__button result-editor__button--save"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={handleCancelLapEdit}
                                        className="result-editor__button result-editor__button--cancel"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => handleEditLapClick(lap)}
                                      className="result-editor__button result-editor__button--edit"
                                    >
                                      Edit
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultEditor;