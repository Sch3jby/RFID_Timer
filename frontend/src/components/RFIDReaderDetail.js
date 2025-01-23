import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '../contexts/LanguageContext';
import Stopwatch from './Stopwatch.js';
import Editor from './Editor';

function RFIDReaderDetail() {
  const { raceId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [currentTags, setCurrentTags] = useState([]);
  const [raceDetail, setRaceDetail] = useState(null);
  const [tracks, setTracks] = useState([]);
  
  const [trackStates, setTrackStates] = useState({});
  const [startTimeInputs, setStartTimeInputs] = useState({});
  const [manualEntries, setManualEntries] = useState({});
  const [lineupConfirmed, setLineupConfirmed] = useState(false);
  const [draggedTrack, setDraggedTrack] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  useEffect(() => {
    axios.get(`http://localhost:5001/race/${raceId}`)
      .then(response => {
        setRaceDetail(response.data.race);
        return axios.get(`http://localhost:5001/tracks?race_id=${raceId}`);
      })
      .then(response => {
        const fetchedTracks = response.data.tracks;
        setTracks(fetchedTracks);
        
        const initialTrackStates = fetchedTracks.reduce((acc, track) => {
          acc[track.id] = {
            isStarted: false
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
            timestamp: '',
            status: 'None'
          };
          return acc;
        }, {});
        setManualEntries(initialManualEntries);
      })
      .catch(error => {
        console.error("Error fetching data:", error);
        showMessage(`Error: ${error.message}`, 'error');
      });
  }, [raceId]);

  const showMessage = (text, type = 'success') => {
    const id = Date.now(); // Create unique ID for message
    const newMessage = {
      id,
      text,
      type: text.includes('Error') ? 'error' : type
    };
    
    setMessages(prev => [...prev, newMessage]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setMessages(prev => prev.filter(msg => msg.id !== id));
    }, 5000);
  };

  const handleEditorToggle = () => {
    setIsEditorOpen(!isEditorOpen);
  };

  const handleManualStatusChange = (trackId, value) => {
    setManualEntries(prev => ({
      ...prev,
      [trackId]: { 
        ...prev[trackId], 
        status: value
      }
    }));
  };

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

  const handleKeyPress = (e, trackId) => {
    if (e.key === 'Enter') {
      handleManualResultInsert(trackId);
    }
  };

  const handleManualResultInsert = (trackId) => {
    const entry = manualEntries[trackId];
    
    if (!entry.number) {
      showMessage(`Error: Number is required for track ${trackId}`, 'error');
      return;
    }
  
    if (entry.timestamp && !/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/.test(entry.timestamp)) {
      showMessage(`Error: Invalid timestamp format for track ${trackId}. Use HH:MM:SS`, 'error');
      return;
    }
    
    const resultData = {
      race_id: raceId,
      track_id: trackId,
      number: entry.number,
      timestamp: entry.timestamp || null,
      status: entry.status || 'None'
    };
    
    axios.post('http://localhost:5001/manual_result_store', resultData)
      .then(() => {
        // Reset manual entry fields
        setManualEntries(prev => ({
          ...prev,
          [trackId]: { 
            number: '', 
            timestamp: '',
            status: 'None'
          }
        }));
        showMessage('Result stored successfully');
      })
      .catch(error => {
        showMessage(`Error storing result: ${error.response?.data?.message || error.message}`, 'error');
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
      .then(() => {
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
            shouldReset: true
          }
        }));
  
        showMessage('Start time set successfully');
      })
      .catch(error => {
        showMessage(`Error setting start time: ${error.message}`, 'error');
      });
    } else {
      const wasStarted = trackStates[trackId].isStarted;
      setTrackStates(prev => ({
        ...prev,
        [trackId]: {
          ...prev[trackId],
          isStarted: !wasStarted,
          shouldReset: !wasStarted
        }
      }));
    }
  };

  const handleConfirmLineup = () => {
    const lineupData = {
      race_id: raceId,
      tracks: tracks.map(track => ({
        id: track.id,
        name: track.name,
        start_time: startTimeInputs[track.id].time,
        is_automatic_time: startTimeInputs[track.id].isAutomatic
      }))
    };

    axios.post('http://localhost:5001/confirm_lineup', lineupData)
      .then(() => {
        setLineupConfirmed(true);
        showMessage("Starlist confirmed");
      })
      .catch(error => {
        showMessage(`Error when confirming the start list: ${error.response?.data?.message || error.message}`, 'error');
      });
  };

  const handleConnect = () => {
    axios.post("http://localhost:5001/connect")
      .then((response) => {
        switch(response.data.status) {
          case "connected":
            setIsConnected(true);
            showMessage("RFID Reader connected successfully");
            break;
          case "disconnected":
            setIsConnected(false);
            setCurrentTags([]);
            showMessage("RFID Reader disconnected");
            break;
          case "error":
            setIsConnected(false);
            showMessage(`Connection error: ${response.data.message}`, 'error');
            break;
          default:
            showMessage("Unexpected response from server");
        }
      })
      .catch((error) => {
        setIsConnected(false);
        showMessage(`Connection failed: ${error.response?.data?.message || error.message}`, 'error');
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
              
              tracks.forEach(track => {
                const trackState = trackStates[track.id];
                if (trackState && trackState.isStarted) {
                  axios.post("http://localhost:5001/store_results", { 
                    tags: processedTags,
                    race_id: raceId,
                    track_id: track.id
                  })
                  .catch(error => {
                    showMessage(`Error storing results: ${error.message}`, 'error');
                  });
                }
              });
            } else {
              setIsConnected(false);
              showMessage(`Connection lost: ${response.data.message}`, 'error');
              setCurrentTags([]);
            }
          })
          .catch((error) => {
            setIsConnected(false);
            showMessage(`Connection error: ${error.message}`, 'error');
            setCurrentTags([]);
          });
      }, 500);
    }
  
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected, trackStates, raceId, tracks]);

  const handleDragStart = (e, track) => {
    setDraggedTrack(track);
    e.dataTransfer.effectAllowed = "move";
    e.target.classList.add('dragging');
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDragEnter = (e, targetTrack) => {
    if (draggedTrack.id === targetTrack.id) return;
    
    const newTracks = [...tracks];
    const draggedIndex = newTracks.findIndex(t => t.id === draggedTrack.id);
    const targetIndex = newTracks.findIndex(t => t.id === targetTrack.id);
    
    newTracks.splice(draggedIndex, 1);
    newTracks.splice(targetIndex, 0, draggedTrack);
    
    setTracks(newTracks);
  };
  
  const handleDragEnd = (e) => {
    e.target.classList.remove('dragging');
    setDraggedTrack(null);
  };

  const handleBack = () => {
    navigate('/rfid-reader');
  };

  if (!raceDetail) {
    return (
      <div className="container">
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
            <strong>   {t('rfidReader.date')}:</strong> {raceDetail.date} | 
            <strong>   {t('rfidReader.startType')}:</strong> {raceDetail.start}
          </p>
        </div>
        <div className="rfid-reader-detail__connection-status">
          <div className={`rfid-reader-detail__connection-indicator ${isConnected ? 'rfid-reader-detail__connection-indicator--connected' : ''}`}></div>
          <button 
            onClick={handleConnect} 
            className={`btn ${isConnected ? 'btn-danger' : 'btn-primary'}`}
          >
            {isConnected ? t('rfidReader.disconnect') : t('rfidReader.connect')} RFID Reader
          </button>
        </div>
      </div>

      {/* Back Button */}
      <button onClick={handleBack} className="btn btn-secondary">{t('rfidReader.back')}</button>

      {/* Space */}
      <div className="space">
          <p> </p>
      </div>

      {/* New Confirm Lineup Button */}
      <div className="button">
        <button 
          onClick={handleConfirmLineup} 
          className={`btn ${lineupConfirmed ? 'btn-success' : 'btn-primary'}`}
          disabled={lineupConfirmed}
        >
          {lineupConfirmed ? t('rfidReader.confirmed') : t('rfidReader.confirm')}
        </button>
      </div>

      {/* Space */}
      <div className="space">
          <p> </p>
      </div>

      {/* Editor Modal */}
      <div className="d-flex gap-2">
        <button onClick={handleEditorToggle} className="btn btn-primary">
          {t('rfidReader.editor')}
        </button>
      </div>
      {isEditorOpen && (
        <Editor
          raceId={raceId}
          onClose={handleEditorToggle}
        />
      )}

      {/* Message Display */}
      <div className="messages-container">
        {messages.map(msg => (
          <div 
            key={msg.id}
            className={`alert ${msg.type === 'error' ? 'alert-danger' : 'alert-success'} fade show`}
            role="alert"
          >
            {msg.text}
          </div>
        ))}
      </div>

      {/* Current Tags Section */}
      <div className="rfid-reader-tags">
        <h4 className="rfid-reader-tags__title">{t('rfidReader.curTags')}</h4>
        <div className="rfid-reader-tags__container">
          {currentTags.length === 0 ? (
            <p className="text-muted text-center">{t('rfidReader.noTags')}</p>
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
          <div 
            key={track.id} 
            className="rfid-reader-track"
            draggable
            onDragStart={(e) => handleDragStart(e, track)}
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnter(e, track)}
            onDragEnd={handleDragEnd}
          >
            <div className="rfid-reader-track__header">
              <div>
                <h3 className="rfid-reader-track__title">{track.name}</h3>
                <span className="rfid-reader-track__distance">{track.distance} km</span>
              </div>
              <div className="d-flex align-items-center">
              <Stopwatch 
                isRunning={trackStates[track.id]?.isStarted}
                shouldReset={trackStates[track.id]?.shouldReset}
              />
                <button 
                  onClick={() => handleTrackStartStop(track.id)} 
                  className={`btn ${trackStates[track.id]?.isStarted ? 'btn-warning' : 'btn-success'}`}
                >
                  {trackStates[track.id]?.isStarted ? 'Stop' : 'Start'}
                </button>
              </div>
            </div>

            {/* Start Time Controls */}
            <div className="rfid-reader-track__time-controls">
              <div className="rfid-reader-track__time-input">
                <label className="form-label">Start Time</label>
                <input 
                  type="time" 
                  className="form-control" 
                  value={startTimeInputs[track.id]?.time || ''}
                  onChange={(e) => handleStartTimeChange(track.id, e.target.value)}
                  disabled={startTimeInputs[track.id]?.isLocked || startTimeInputs[track.id]?.isAutomatic}
                />
              </div>
              <div className="rfid-reader-track__auto-checkbox">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={startTimeInputs[track.id]?.isAutomatic || false}
                  onChange={() => handleAutomaticTimeToggle(track.id)}
                />
                <label className="form-check-label">Auto</label>
              </div>
            </div>

            {/* Manual Entry */}
            <div className="rfid-reader-track__manual-entry">
              <h4>{t('rfidReader.manual')}</h4>
              <div className="rfid-reader-track__manual-fields">
                <div className="rfid-reader-track__manual-field">
                  <label>{t('rfidReader.number')}:</label>
                  <input 
                    type="text" 
                    value={manualEntries[track.id]?.number || ''}
                    onChange={(e) => handleManualNumberChange(track.id, e.target.value)}
                    onKeyDown={(e) => handleKeyPress(e, track.id)}
                    placeholder={t('rfidReader.enterNumber')}
                  />
                </div>
                <div className="rfid-reader-track__manual-field">
                  <label>{t('rfidReader.time')}:</label>
                  <input 
                    type="text" 
                    value={manualEntries[track.id]?.timestamp || ''}
                    onChange={(e) => handleManualTimestampChange(track.id, e.target.value)}
                    onKeyDown={(e) => handleKeyPress(e, track.id)}
                    placeholder="HH:MM:SS"
                  />
                </div>
                <div className="rfid-reader-track__manual-field">
                  <label>{t('rfidReader.status')}:</label>
                  <select 
                    value={manualEntries[track.id]?.status || 'None'}
                    onChange={(e) => handleManualStatusChange(track.id, e.target.value)}
                  >
                    <option value="None">None</option>
                    <option value="DNF">DNF</option>
                    <option value="DNS">DNS</option>
                    <option value="DSQ">DSQ</option>
                  </select>
                </div>
              </div>
              <button 
                className="btn btn-primary" 
                onClick={() => handleManualResultInsert(track.id)}
              >
                {t('rfidReader.insert')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RFIDReaderDetail;