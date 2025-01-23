import React, { useState } from 'react';
import ResultEditor from './ResultEditor';
import StartEditor from './StartEditor';

const Editor = ({ raceId, onClose }) => {
  const [activeEditor, setActiveEditor] = useState('result');

  return (
    <div className="editor-container">
      <div className="editor-header">
        <div className="editor-tabs">
          <button 
            onClick={() => setActiveEditor('result')}
            className={`editor-tab ${activeEditor === 'result' ? 'active' : ''}`}
          >
            Result List Editor
          </button>
          <button 
            onClick={() => setActiveEditor('start')}
            className={`editor-tab ${activeEditor === 'start' ? 'active' : ''}`}
          >
            Start List Editor
          </button>
        </div>
      </div>

      <div className="editor-content">
        {activeEditor === 'result' ? (
          <ResultEditor 
            raceId={raceId} 
            onClose={onClose} 
          />
        ) : (
          <StartEditor 
            raceId={raceId} 
            onClose={onClose} 
          />
        )}
      </div>
    </div>
  );
};

export default Editor;