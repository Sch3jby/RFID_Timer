import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ResultEditor = ({ raceId, onClose }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingResult, setEditingResult] = useState(null);
  const [editedTime, setEditedTime] = useState('');
  const [editedLastSeenTime, setEditedLastSeenTime] = useState('');
  const [editedStatus, setEditedStatus] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchResults();
  }, [raceId]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:5001/race/${raceId}/results`);
      setResults(response.data.results);
      setError(null);
    } catch (err) {
      setError('Failed to load results');
      console.error('Error fetching results:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (result) => {
    setEditingResult(result);
    setEditedTime(result.race_time || '');
    setEditedLastSeenTime(result.last_seen_time || '');
    setEditedStatus(result.status || '');
  };

  const validateTime = (timeStr) => {
    // Validate HH:MM:SS or HH:MM:SS.MS format
    const regex = /^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.(\d{1,3}))?$/;
    return regex.test(timeStr);
  };

  const addMilliseconds = (timeStr) => {
    return timeStr.includes('.') ? timeStr : timeStr + '.000';
  };

  const handleSaveEdit = async () => {
    if (!editingResult) return;

    try {
      // Create an update object with all changed fields
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

      // Send all updates in a single request
      await axios.post(`http://localhost:5001/race/${raceId}/result/update`, {
        number: editingResult.number,
        track_id: editingResult.track_id,
        ...updates
      });

      setSuccessMessage('Changes saved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      
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

  if (loading) return (
    <div className="fixed inset-0 bg-white z-50 p-6 shadow-lg">
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-white z-50 p-6 shadow-lg overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Edit Race Results</h2>
        <button 
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-xl font-bold"
        >
          ✕
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 text-green-700 p-4 rounded-md mb-4">
          {successMessage}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-full border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-2 text-left">Position</th>
              <th className="p-2 text-left">Number</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Track</th>
              <th className="p-2 text-left">Category</th>
              <th className="p-2 text-left">Time</th>
              <th className="p-2 text-left">Last Seen</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.number} className="border-b hover:bg-gray-50">
                <td className="p-2">{result.position_track}</td>
                <td className="p-2">{result.number}</td>
                <td className="p-2">{result.name}</td>
                <td className="p-2">{result.track}</td>
                <td className="p-2">{result.category}</td>
                <td className="p-2">
                  {editingResult?.number === result.number ? (
                    <input
                      type="text"
                      value={editedTime}
                      onChange={(e) => setEditedTime(e.target.value)}
                      className="border rounded p-1 w-32"
                      placeholder="HH:MM:SS"
                    />
                  ) : (
                    result.race_time
                  )}
                </td>
                <td className="p-2">
                  {editingResult?.number === result.number ? (
                    <input
                      type="text"
                      value={editedLastSeenTime}
                      onChange={(e) => setEditedLastSeenTime(e.target.value)}
                      className="border rounded p-1 w-32"
                      placeholder="HH:MM:SS"
                    />
                  ) : (
                    result.last_seen_time
                  )}
                </td>
                <td className="p-2">
                  {editingResult?.number === result.number ? (
                    <select
                      value={editedStatus}
                      onChange={(e) => setEditedStatus(e.target.value)}
                      className="border rounded p-1"
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
                <td className="p-2">
                  {editingResult?.number === result.number ? (
                    <div className="space-x-2">
                      <button
                        onClick={handleSaveEdit}
                        className="text-green-600 hover:text-green-800"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="text-red-600 hover:text-red-800"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEditClick(result)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultEditor;