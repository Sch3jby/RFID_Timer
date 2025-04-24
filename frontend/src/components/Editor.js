// components/Editor.js
import React, { useState } from 'react';
import ResultEditor from './ResultEditor';
import StartEditor from './StartEditor';

/**
 * Editor container component with tabs for different editors.
 * Switches between Result and Start List editors.
 * 
 * @param {number} raceId - ID of the race being edited
 * @param {function} onClose - Callback to close the editor
 * @returns Rendered editor with tabs for result and start list editing
 */

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