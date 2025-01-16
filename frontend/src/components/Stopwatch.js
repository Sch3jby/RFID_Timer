import React, { useState, useEffect } from 'react';

const Stopwatch = ({ isRunning, shouldReset }) => {
  const [time, setTime] = useState(0);

  useEffect(() => {
    let intervalId;

    // Reset time when shouldReset is true
    if (shouldReset) {
      setTime(0);
    }

    if (isRunning) {
      intervalId = setInterval(() => {
        setTime(prevTime => prevTime + 1);
      }, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning, shouldReset]);

  const formatTime = (timeInSeconds) => {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = timeInSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="text-xl font-mono font-bold mx-4">
      {formatTime(time)}
    </div>
  );
};

export default Stopwatch;