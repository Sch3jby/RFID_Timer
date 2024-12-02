import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useNavigate } from 'react-router-dom';

function RFIDReaderDetail() {
  const { raceId } = useParams();
  const navigate = useNavigate();

  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [currentTags, setCurrentTags] = useState([]);
  const [raceDetail, setRaceDetail] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [trackCategories, setTrackCategories] = useState({});
  
  const [trackStates, setTrackStates] = useState({});
  const [startTimeInputs, setStartTimeInputs] = useState({});
  const [manualEntries, setManualEntries] = useState({});

  useEffect(() => {
    axios.get('http://localhost:5001/categories')
      .then(categoriesResponse => {
        const categoriesByTrack = categoriesResponse.data.categories.reduce((acc, category) => {
          if (!acc[category.track_id]) {
            acc[category.track_id] = [];
          }
          acc[category.track_id].push(category);
          return acc;
        }, {});
        setTrackCategories(categoriesByTrack);

        return axios.get(`http://localhost:5001/race/${raceId}`);
      })
      .then(response => {
        setRaceDetail(response.data.race);
        return axios.get(`http://localhost:5001/tracks?race_id=${raceId}`);
      })
      .then(response => {
        const fetchedTracks = response.data.tracks;
        setTracks(fetchedTracks);
        
        const initialTrackStates = fetchedTracks.reduce((acc, track) => {
          acc[track.id] = {
            isStarted: false,
            storedTags: []
          };
          return acc;
        }, {});
        setTrackStates(initialTrackStates);

        const initialStartTimeInputs = fetchedTracks.reduce((acc, track) => {
          acc[track.id] = {
            time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            isLocked: false,
            isAutomatic: false
          };
          return acc;
        }, {});
        setStartTimeInputs(initialStartTimeInputs);

        const initialManualEntries = fetchedTracks.reduce((acc, track) => {
          acc[track.id] = {
            number: '',
            timestamp: ''
          };
          return acc;
        }, {});
        setManualEntries(initialManualEntries);
      })
      .catch(error => {
        console.error("Error fetching data:", error);
        setMessage(`Error: ${error.message}`);
      });
  }, [raceId]);

  const handleStartTimeChange = (trackId, value) => {
    setStartTimeInputs(prev => ({
      ...prev,
      [trackId]: { 
        ...prev[trackId], 
        time: value,
        isAutomatic: false
      }
    }));
  };

  const handleAutomaticTimeToggle = (trackId) => {
    setStartTimeInputs(prev => ({
      ...prev,
      [trackId]: { 
        ...prev[trackId], 
        isAutomatic: !prev[trackId].isAutomatic
      }
    }));
  };

  const handleManualNumberChange = (trackId, value) => {
    setManualEntries(prev => ({
      ...prev,
      [trackId]: { 
        ...prev[trackId], 
        number: value
      }
    }));
  };

  const handleManualTimestampChange = (trackId, value) => {
      setManualEntries(prev => ({
        ...prev,
        [trackId]: { 
          ...prev[trackId], 
          timestamp: value
        }
      }));
  };

  const handleManualResultInsert = (trackId) => {
    const entry = manualEntries[trackId];
    
    if (!entry.number) {
      setMessage(`Error: Number is required for track ${trackId}`);
      return;
    }
  
    // Optional timestamp validation
    if (entry.timestamp && !/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/.test(entry.timestamp)) {
      setMessage(`Error: Invalid timestamp format for track ${trackId}. Use HH:MM:SS`);
      return;
    }
    
    const resultData = {
      race_id: raceId,
      track_id: trackId,
      number: entry.number,
      timestamp: entry.timestamp || null
    };
    
    axios.post('http://localhost:5001/manual_result_store', resultData)
      .then(response => {
        setMessage(`Successfully stored result for track ${trackId}: Number ${entry.number}`);
        
        setManualEntries(prev => ({
          ...prev,
          [trackId]: { 
            number: '', 
            timestamp: '' 
          }
        }));
      })
      .catch(error => {
        setMessage(`Error storing result: ${error.response?.data?.message || error.message}`);
      });
  };
  const handleTrackStartStop = (trackId) => {
    if (!startTimeInputs[trackId].isLocked) {
      axios.post('http://localhost:5001/set_track_start_time', {
        race_id: raceId,
        track_id: trackId,
        start_time: startTimeInputs[trackId].isAutomatic 
          ? 'auto'
          : startTimeInputs[trackId].time
      })
      .then((response) => {
        setStartTimeInputs(prev => ({
          ...prev,
          [trackId]: { 
            ...prev[trackId], 
            isLocked: true
          }
        }));
        
        setTrackStates(prev => ({
          ...prev,
          [trackId]: {
            ...prev[trackId],
            isStarted: true,
            storedTags: []
          }
        }));

        setMessage(`Start time set for track categories: ${
          response.data.categories.map(cat => cat.name).join(', ')
        }`);
      })
      .catch(error => {
        setMessage(`Error setting start time: ${error.message}`);
      });
    } else {
      setTrackStates(prev => ({
        ...prev,
        [trackId]: {
          ...prev[trackId],
          isStarted: !prev[trackId].isStarted,
          storedTags: !prev[trackId].isStarted ? [] : prev[trackId].storedTags
        }
      }));
    }
  };

  const handleConnect = () => {
    axios.post("http://localhost:5001/connect")
      .then((response) => {
        switch(response.data.status) {
          case "connected":
            setIsConnected(true);
            setMessage("RFID Reader connected successfully");
            break;
          case "disconnected":
            setIsConnected(false);
            setCurrentTags([]);
            setMessage("RFID Reader disconnected");
            break;
          case "error":
            setIsConnected(false);
            setMessage(`Connection error: ${response.data.message}`);
            break;
          default:
            setMessage("Unexpected response from server");
        }
      })
      .catch((error) => {
        setIsConnected(false);
        setMessage(`Connection failed: ${error.response?.data?.message || error.message}`);
      });
  };

  const processTag = (tag) => {
    const match = tag.match(/Tag:\s*(\d+)/);
    return match ? match[1] : tag;
  };

  useEffect(() => {
    let interval;
    
    if (isConnected) {
      interval = setInterval(() => {
        axios.get("http://localhost:5001/fetch_taglist")
          .then((response) => {
            if (response.data.status === "success") {
              const fetchedTags = response.data.taglist;
              
              const processedTags = fetchedTags.map(processTag);
              
              setCurrentTags(processedTags);
              
              axios.post("http://localhost:5001/store_tags", { 
                tags: processedTags,
                race_id: raceId
              });
  
              tracks.forEach(track => {
                const trackState = trackStates[track.id];
                if (trackState && trackState.isStarted) {
                  axios.post("http://localhost:5001/store_results", { 
                    tags: processedTags,
                    race_id: raceId,
                    track_id: track.id
                  })
                  .then(() => {
                    setTrackStates(prev => ({
                      ...prev,
                      [track.id]: {
                        ...prev[track.id],
                        storedTags: [...new Set([...prev[track.id].storedTags, ...processedTags])]
                      }
                    }));
                  })
                  .catch(error => {
                    setMessage(`Error storing results: ${error.message}`);
                  });
                }
              });
            } else {
              // If status is not success, treat it as a disconnection
              setIsConnected(false);
              setMessage(`Connection lost: ${response.data.message}`);
              setCurrentTags([]);
            }
          })
          .catch((error) => {
            // If there's a network error, disconnect
            setIsConnected(false);
            setMessage(`Connection error: ${error.message}`);
            setCurrentTags([]);
          });
      }, 500);
    }
  
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected, trackStates, raceId, tracks]);

  const handleBack = () => {
    navigate('/rfid-reader');
  };

  if (!raceDetail) {
    return (
      <div className="container mt-4">
        <div className="spinner-border" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container rfid-reader-detail">
      {/* Navigation and Race Info */}
      <div className="rfid-reader-detail__header">
        <div>
          <h1 className="rfid-reader-detail__title">{raceDetail.name}</h1>
          <p>
            <strong>Date:</strong> {raceDetail.date} | 
            <strong> Start Type:</strong> {raceDetail.start}
          </p>
        </div>
        <div className="rfid-reader-detail__connection-status">
          <div className={`rfid-reader-detail__connection-indicator ${isConnected ? 'rfid-reader-detail__connection-indicator--connected' : ''}`}></div>
          <button 
            onClick={handleConnect} 
            className={`btn ${isConnected ? 'btn-danger' : 'btn-primary'}`}
          >
            {isConnected ? 'Disconnect' : 'Connect'} RFID Reader
          </button>
        </div>
      </div>

      {/* Back Button */}
      <button 
        onClick={handleBack} 
        className="btn btn-secondary mb-3"
      >
        Back to Races
      </button>

      {/* Message Display */}
      {message && (
        <div className="alert mb-3 text-center">
          <div className={`${message.includes('Error') ? 'alert-danger' : 'alert-success'}`}>
            {message}
          </div>
        </div>
      )}

      {/* Current Tags Section */}
      <div className="rfid-reader-tags">
        <h4 className="rfid-reader-tags__title">Current Tags</h4>
        <div className="rfid-reader-tags__container">
          {currentTags.length === 0 ? (
            <p className="text-muted text-center">No tags detected</p>
          ) : (
            currentTags.map((tag, index) => (
              <span key={index} className="rfid-reader-tag">{tag}</span>
            ))
          )}
        </div>
      </div>

      {/* Tracks List */}
      <div className="rfid-reader-tracks">
        {tracks.map(track => (
          <div key={track.id} className="rfid-reader-track">
            <div className="rfid-reader-track__header">
              <div>
                <h3 className="rfid-reader-track__title">{track.name}</h3>
                <span className="rfid-reader-track__distance">{track.distance} km</span>
              </div>
              <button 
                onClick={() => handleTrackStartStop(track.id)} 
                className={`btn ${trackStates[track.id]?.isStarted ? 'btn-warning' : 'btn-success'}`}
              >
                {trackStates[track.id]?.isStarted ? 'Stop' : 'Start'} Track
              </button>
            </div>

            {/* Start Time Input */}
            <div className="mb-3">
              <div className="input-group">
                <input 
                  type="time" 
                  className="form-control" 
                  value={startTimeInputs[track.id]?.time || ''}
                  onChange={(e) => handleStartTimeChange(track.id, e.target.value)}
                  disabled={startTimeInputs[track.id]?.isLocked || startTimeInputs[track.id]?.isAutomatic}
                />
                <div className="input-group-text">
                  <input
                    type="checkbox"
                    className="form-check-input mt-0"
                    checked={startTimeInputs[track.id]?.isAutomatic || false}
                    onChange={() => handleAutomaticTimeToggle(track.id)}
                  />
                  <label className="form-check-label ms-1">Auto</label>
                </div>
              </div>
            </div>

            {/* Manual Result Entry */}
            <div className="rfid-reader-track__manual-entry">
              <h4>Manual Result Entry</h4>
              <div className="row">
                <div className="col-md-6 mb-2">
                  <label className="form-label">Number</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={manualEntries[track.id]?.number || ''}
                    onChange={(e) => handleManualNumberChange(track.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleManualResultInsert(track.id);
                      }
                    }}
                    placeholder="Enter participant number"
                  />
                </div>
                <div className="col-md-6 mb-2">
                  <label className="form-label">Timestamp</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={manualEntries[track.id]?.timestamp || ''}
                    onChange={(e) => handleManualTimestampChange(track.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleManualResultInsert(track.id);
                      }
                    }}
                    placeholder="HH:MM:SS"
                  />
                </div>
              </div>
              <button 
                className="btn btn-primary mt-2 w-100"
                onClick={() => handleManualResultInsert(track.id)}
              >
                Insert Result
              </button>
            </div>

            {/* Track Categories */}
            <div className="rfid-reader-track__categories">
              <h4>Categories</h4>
              {trackCategories[track.id] ? (
                <ul className="rfid-reader-track__categories-list">
                  {trackCategories[track.id].map(category => (
                    <li key={category.id} className="rfid-reader-track__categories-item">
                      {category.name} ({category.gender}) 
                      {category.min_age}-{category.max_age} years
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted text-center">No categories found</p>
              )}
            </div>

            {/* Stored Tags */}
            <div className="rfid-reader-tags mt-3">
              <h4 className="rfid-reader-tags__title">Stored Tags</h4>
              <div className="rfid-reader-tags__container">
                {trackStates[track.id]?.storedTags.length === 0 ? (
                  <p className="text-muted text-center">No tags stored</p>
                ) : (
                  trackStates[track.id]?.storedTags.map((tag, index) => (
                    <span key={index} className="rfid-reader-tag rfid-reader-tag--stored">{tag}</span>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RFIDReaderDetail;