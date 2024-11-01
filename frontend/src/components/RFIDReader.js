import React, { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from '../contexts/LanguageContext';

function RFIDReader() {
  const { t } = useTranslation();
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [tags, setTags] = useState([]);

  const handleConnect = () => {
    setMessage(t('rfidReader.connecting'));
    axios.post("http://localhost:5001/connect")
      .then((response) => {
        if (response.data.status === "connected") {
          setIsConnected(true);
          setMessage(t('rfidReader.connected'));
        } else if (response.data.status === "disconnected") {
          setIsConnected(false);
          setMessage(t('rfidReader.disconnected'));
          setTags([]);
        } else {
          setMessage(t('rfidReader.error') + response.data.message);
        }
      })
      .catch(() => {
        setMessage(t('rfidReader.error') + t('rfidReader.connectionFailed'));
      });
  };

  useEffect(() => {
    let interval;
    if (isConnected) {
      interval = setInterval(() => {
        axios.get("http://localhost:5001/fetch_taglist")
          .then((response) => {
            if (response.data.status === "success") {
              setTags(response.data.taglist);
            } else {
              setMessage(t('rfidReader.error') + response.data.message);
            }
          })
          .catch((error) => {
            setMessage(t('rfidReader.error') + error.message);
          });
      }, 500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected, t]);

  return (
    <div className="rfid-container">
      <h1 className="text-center mb-4">{t('rfidReader.title')}</h1>
      <button onClick={handleConnect}>
        {isConnected ? t('rfidReader.disconnect') : t('rfidReader.connect')}
      </button>
      {message && <div className="message">{message}</div>}
      <div className="tag-container">
        {tags.map((tag, index) => (
          <div key={index} className="tag-box">{tag}</div>
        ))}
      </div>
    </div>
  );
}

export default RFIDReader;