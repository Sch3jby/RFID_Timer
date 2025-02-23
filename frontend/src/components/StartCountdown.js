import React, { useState, useEffect } from 'react';
import axios from '../api/axiosConfig';

const StartCountdown = ({ raceId, trackId, isRunning }) => {
  const [runners, setRunners] = useState([]);
  const [startTimestamp, setStartTimestamp] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState({});

  // Fetch runners when component mounts
  useEffect(() => {
    const fetchStartList = async () => {
      try {
        const response = await axios.get(`/api/race/${raceId}/startlist`);
        const trackRunners = response.data.startList
          .filter(item => 
            item.track_id === trackId && 
            item.user_start_time !== '--:--:--'
          )
          .map(item => ({
            id: item.registration_id,
            number: item.number,
            name: `${item.firstname} ${item.surname}`,
            startTime: item.user_start_time
          }))
          .sort((a, b) => a.startTime.localeCompare(b.startTime));

        setRunners(trackRunners);
      } catch (error) {
        console.error('Error fetching start list:', error);
      }
    };

    fetchStartList();
  }, [raceId, trackId]);

  // Handle start/stop
  useEffect(() => {
    if (isRunning) {
      setStartTimestamp(new Date());
    } else {
      setStartTimestamp(null);
      setTimeRemaining({});
    }
  }, [isRunning]);

  // Calculate color based on remaining time
  const getColorStyle = (seconds) => {
    if (seconds > 30) {
      return { backgroundColor: '#ffcdd2' }; // červená pro čas > 30s
    } else {
      // Plynulý přechod ze žluté do zelené pro čas < 30s
      const greenIntensity = Math.floor(1* 255);
      const redIntensity = Math.floor((seconds / 30) * 255);
      return {
        backgroundColor: `rgb(${redIntensity}, ${greenIntensity}, 0)`
      };
    }
  };

  // Check for expired times and update remaining times
  useEffect(() => {
    if (!isRunning || !startTimestamp) return;

    const interval = setInterval(() => {
      const now = new Date();
      const elapsedSeconds = Math.floor((now - startTimestamp) / 1000);
      
      setRunners(currentRunners => 
        currentRunners.filter(runner => {
          const [hours, minutes, seconds] = runner.startTime.split(':').map(Number);
          const runnerStartSeconds = hours * 3600 + minutes * 60 + seconds;
          return runnerStartSeconds > elapsedSeconds;
        })
      );

      // Update remaining time for each runner
      const newTimeRemaining = {};
      runners.forEach(runner => {
        const [hours, minutes, seconds] = runner.startTime.split(':').map(Number);
        const runnerStartSeconds = hours * 3600 + minutes * 60 + seconds;
        const remaining = runnerStartSeconds - elapsedSeconds;
        if (remaining >= 0) {
          newTimeRemaining[runner.id] = remaining;
        }
      });
      setTimeRemaining(newTimeRemaining);
    }, 100); // Update more frequently for smoother color transition

    return () => clearInterval(interval);
  }, [isRunning, startTimestamp, runners]);

  return (
    <div className="start-countdown">
      <h4>Upcoming Starts</h4>
      <div className="start-countdown__list">
        {runners.length === 0 ? (
          <p className="start-countdown__empty">No upcoming starts</p>
        ) : (
          <div className="start-countdown__items">
            {runners.map(runner => (
              <div 
                key={runner.id} 
                className="start-countdown__item"
                style={isRunning ? getColorStyle(timeRemaining[runner.id] || 0) : {}}
              >
                <span className="start-countdown__number">#{runner.number}</span>
                <span className="start-countdown__name">{runner.name}</span>
                <span className="start-countdown__time">{runner.startTime}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StartCountdown;