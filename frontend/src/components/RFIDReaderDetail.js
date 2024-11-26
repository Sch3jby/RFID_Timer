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
  
  // State for tracking which tracks are started with start times
  const [trackStates, setTrackStates] = useState({});

  // State for start time inputs
  const [startTimeInputs, setStartTimeInputs] = useState({});

  useEffect(() => {
    // Fetch categories first
    axios.get('http://localhost:5001/categories')
      .then(categoriesResponse => {
        // Group categories by track
        const categoriesByTrack = categoriesResponse.data.categories.reduce((acc, category) => {
          if (!acc[category.track_id]) {
            acc[category.track_id] = [];
          }
          acc[category.track_id].push(category);
          return acc;
        }, {});
        setTrackCategories(categoriesByTrack);

        // Fetch race details
        return axios.get(`http://localhost:5001/race/${raceId}`);
      })
      .then(response => {
        setRaceDetail(response.data.race);

        // Fetch tracks for this race
        return axios.get(`http://localhost:5001/tracks?race_id=${raceId}`);
      })
      .then(response => {
        const fetchedTracks = response.data.tracks;
        setTracks(fetchedTracks);
        
        // Initialize track states
        const initialTrackStates = fetchedTracks.reduce((acc, track) => {
          acc[track.id] = {
            isStarted: false,
            storedTags: []
          };
          return acc;
        }, {});
        setTrackStates(initialTrackStates);

        // Initialize start time inputs
        const initialStartTimeInputs = fetchedTracks.reduce((acc, track) => {
          acc[track.id] = {
            time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            isLocked: false,
            isAutomatic: false
          };
          return acc;
        }, {});
        setStartTimeInputs(initialStartTimeInputs);
      })
      .catch(error => {
        console.error("Error fetching data:", error);
        setMessage(`Error: ${error.message}`);
      });
  }, [raceId]);

  // Handle start time input change
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

  // Handle automatic time checkbox
  const handleAutomaticTimeToggle = (trackId) => {
    setStartTimeInputs(prev => ({
      ...prev,
      [trackId]: { 
        ...prev[trackId], 
        isAutomatic: !prev[trackId].isAutomatic
      }
    }));
  };

  const handleTrackStartStop = (trackId) => {
    // If start time is not locked, prepare to set start time
    if (!startTimeInputs[trackId].isLocked) {
      axios.post('http://localhost:5001/set_track_start_time', {
        race_id: raceId,
        track_id: trackId,
        start_time: startTimeInputs[trackId].isAutomatic 
          ? 'auto'
          : startTimeInputs[trackId].time
      })
      .then((response) => {
        // Lock the start time input
        setStartTimeInputs(prev => ({
          ...prev,
          [trackId]: { 
            ...prev[trackId], 
            isLocked: true
          }
        }));
        
        // Start the track
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
    // If start time is already locked, just toggle start/stop
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

  // RFID Reader Connection
  const handleConnect = () => {
    axios.post("http://localhost:5001/connect")
      .then((response) => {
        if (response.data.status === "connected") {
          setIsConnected(true);
          setMessage("RFID Reader connected successfully");
        } else if (response.data.status === "disconnected") {
          setIsConnected(false);
          setMessage("RFID Reader disconnected");
          
          // Reset only current tags, keep track states unchanged
          setCurrentTags([]);
        } else {
          setMessage(`Error: ${response.data.message}`);
        }
      })
      .catch((error) => {
        setMessage(`Connection error: ${error.message}`);
      });
  };

  // Tag processing function
  const processTag = (tag) => {
    const match = tag.match(/Tag:\s*(\d+)/);
    return match ? match[1] : tag;
  };

  // Periodic Tag Fetching for each active track
  useEffect(() => {
    let interval;
    
    if (isConnected) {
      interval = setInterval(() => {
        axios.get("http://localhost:5001/fetch_taglist")
          .then((response) => {
            if (response.data.status === "success") {
              const fetchedTags = response.data.taglist;
              
              // Zpracování tagů
              const processedTags = fetchedTags.map(processTag);
              
              // Update current tags
              setCurrentTags(processedTags);
              
              // Store backup tags for the race
              axios.post("http://localhost:5001/store_tags", { 
                tags: processedTags,
                race_id: raceId
              });

              // Store results for each started track
              tracks.forEach(track => {
                const trackState = trackStates[track.id];
                if (trackState && trackState.isStarted) {
                  axios.post("http://localhost:5001/store_results", { 
                    tags: processedTags,
                    race_id: raceId,
                    track_id: track.id
                  })
                  .then(() => {
                    // Update stored tags for the specific track
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
              setMessage(`Error: ${response.data.message}`);
            }
          })
          .catch((error) => {
            setMessage(`Tag fetch error: ${error.message}`);
          });
      }, 500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected, trackStates, raceId, tracks]);

  // Navigation back to races list
  const handleBack = () => {
    navigate('/rfid-reader');
  };

  // Render loading state
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
    <div className="container">
      {/* Navigation and Race Info */}
      <div className="row mb-4">
        <div className="col-12">
          <button 
            onClick={handleBack} 
            className="btn btn-secondary mb-3"
          >
            Back to Races
          </button>
          
          <h1>{raceDetail.name}</h1>
          <p>
            <strong>Date:</strong> {raceDetail.date} | 
            <strong> Start Type:</strong> {raceDetail.start}
          </p>
        </div>
      </div>

      {/* RFID Reader Connection */}
      <div className="row mb-3">
        <div className="col-12">
          <button 
            onClick={handleConnect} 
            className={`btn ${isConnected ? 'btn-danger' : 'btn-primary'}`}
          >
            {isConnected ? 'Disconnect' : 'Connect'} RFID Reader
          </button>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className="row mb-3">
          <div className="col-12">
            <div className={`alert ${message.includes('Error') ? 'alert-danger' : 'alert-info'}`}>
              {message}
            </div>
          </div>
        </div>
      )}

      {/* Current Tags Section */}
      <div className="row mb-3">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h4>Current Tags</h4>
            </div>
            <div className="tag-container">
              <div className="card-body">
                {currentTags.length === 0 ? (
                  <p className="text-muted">No tags detected</p>
                ) : (
                  currentTags.map((tag, index) => (
                    <span key={index} className="badge bg-secondary m-1">{tag}</span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tracks List with Start Time and Start/Stop */}
      <div className="row">
        {tracks.map(track => (
          <div key={track.id} className="col-md-6 mb-3">
            <div className="card">
              <div className="card-header">
                <h3>{track.name} - {track.distance} km</h3>
                
                {/* Start Time Input */}
                <div className="input-group mb-2">
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

                {/* Start/Stop Track Button */}
                <button 
                  onClick={() => handleTrackStartStop(track.id)} 
                  className={`btn ${trackStates[track.id]?.isStarted ? 'btn-warning' : 'btn-success'}`}
                >
                  {trackStates[track.id]?.isStarted ? 'Stop' : 'Start'} Track
                </button>

                {/* Display Categories for this Track */}
                <div className="mt-2">
                  <strong>Categories:</strong>
                  {trackCategories[track.id] ? (
                    <ul className="list-unstyled">
                      {trackCategories[track.id].map(category => (
                        <li key={category.id}>
                          {category.name} ({category.gender}) 
                          {category.min_age}-{category.max_age} years
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted">No categories found</p>
                  )}
                </div>
              </div>
              
              {/* Existing card body with stored tags */}
              <div className="card-body">
                <h4>Stored Tags</h4>
                <div className="tag-container">
                  {trackStates[track.id]?.storedTags.length === 0 ? (
                    <p className="text-muted">No tags stored</p>
                  ) : (
                    trackStates[track.id]?.storedTags.map((tag, index) => (
                      <span key={index} className="badge bg-success m-1">{tag}</span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RFIDReaderDetail;