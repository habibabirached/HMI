import React, { useState } from 'react';
import './KeyboardShortcuts.css';

const KeyboardShortcuts = () => {
  const [isOpen, setIsOpen] = useState(false);

  const shortcuts = [
    { keys: ['Shift', 'Click'], desc: 'Multi-select components' },
    { keys: ['Ctrl/⌘', 'A'], desc: 'Select all' },
    { keys: ['Esc'], desc: 'Clear selection' },
    { keys: ['Arrow'], desc: 'Move selected (grid)' },
    { keys: ['Delete'], desc: 'Delete selected' },
    { keys: ['Ctrl/⌘', 'Click'], desc: 'Start connection' },
    { keys: ['Alt', 'Drag'], desc: 'Pan canvas' },
    { keys: ['Scroll'], desc: 'Zoom in/out' }
  ];

  if (!isOpen) {
    return (
      <button 
        className="shortcuts-toggle-btn"
        onClick={() => setIsOpen(true)}
        title="Keyboard Shortcuts (K)"
      >
        ⌨️
      </button>
    );
  }

  return (
    <div className="keyboard-shortcuts-panel">
      <div className="shortcuts-header">
        <div className="shortcuts-title">⌨️ Keyboard Shortcuts</div>
        <button 
          className="shortcuts-close"
          onClick={() => setIsOpen(false)}
        >
          ✕
        </button>
      </div>
      
      <div className="shortcuts-list">
        {shortcuts.map((shortcut, index) => (
          <div key={index} className="shortcut-item">
            <div className="shortcut-key">
              {shortcut.keys.map((key, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="key-plus">+</span>}
                  <span className="key-badge">{key}</span>
                </React.Fragment>
              ))}
            </div>
            <div className="shortcut-desc">{shortcut.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KeyboardShortcuts;
