import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { mainConfigAtom, compareConfigAtom, mainSimulationIsDoneAtom, compareSimulationIsDoneAtom } from '../state/state';

const BroadcastContext = createContext();

export const useBroadcast = () => {
  const context = useContext(BroadcastContext);
  if (!context) {
    throw new Error('useBroadcast must be used within BroadcastProvider');
  }
  return context;
};

export const BroadcastProvider = ({ children, screenId }) => {
  const [channel] = useState(() => new BroadcastChannel('simulator-sync'));
  
  const [mainConfig, setMainConfig] = useAtom(mainConfigAtom);
  const [compareConfig, setCompareConfig] = useAtom(compareConfigAtom);
  const [mainSimulationIsDone, setMainSimulationIsDone] = useAtom(mainSimulationIsDoneAtom);
  const [compareSimulationIsDone, setCompareSimulationIsDone] = useAtom(compareSimulationIsDoneAtom);
  const [showCompareConfig, setShowCompareConfig] = useState(false);

  // Listen for messages from other tabs
  useEffect(() => {
    const handleMessage = (event) => {
      const { type, payload, screenId: senderId } = event.data;
      
      // Ignore messages from ourselves
      if (senderId === screenId) {
        return;
      }
      
      console.log(`Screen ${screenId} received:`, type, payload, `from Screen ${senderId}`);
      
      switch (type) {
        case 'MAIN_CONFIG_CHANGED':
          setMainConfig(payload);
          break;
        case 'COMPARE_CONFIG_CHANGED':
          setCompareConfig(payload);
          break;
        case 'MAIN_SIMULATION_DONE':
          setMainSimulationIsDone(payload);
          break;
        case 'COMPARE_SIMULATION_DONE':
          setCompareSimulationIsDone(payload);
          break;
        case 'SHOW_COMPARE_CONFIG':
          setShowCompareConfig(payload);
          break;
        case 'REQUEST_STATE':
          // Only Screen 1 responds to state requests
          if (screenId === 1) {
            console.log(`Screen 1 broadcasting current state to Screen ${senderId}`);
            setTimeout(() => {
              channel.postMessage({ type: 'MAIN_CONFIG_CHANGED', payload: mainConfig, screenId: 1 });
              channel.postMessage({ type: 'COMPARE_CONFIG_CHANGED', payload: compareConfig, screenId: 1 });
              channel.postMessage({ type: 'SHOW_COMPARE_CONFIG', payload: showCompareConfig, screenId: 1 });
            }, 50);
          }
          break;
        default:
          break;
      }
    };

    channel.addEventListener('message', handleMessage);
    
    // On mount, if we're not screen 1, request current state from Screen 1
    if (screenId !== 1) {
      setTimeout(() => {
        console.log(`Screen ${screenId} requesting state from Screen 1`);
        channel.postMessage({ type: 'REQUEST_STATE', screenId });
      }, 200);
    }
    
    return () => {
      channel.removeEventListener('message', handleMessage);
    };
  }, [channel, screenId, setMainConfig, setCompareConfig, setMainSimulationIsDone, setCompareSimulationIsDone, mainConfig, compareConfig, showCompareConfig]);

  // Broadcast function to send messages to other tabs
  const broadcast = (type, payload) => {
    console.log(`Screen ${screenId} broadcasting:`, type, payload);
    channel.postMessage({ type, payload, screenId });
  };

  const value = {
    screenId,
    broadcast,
    mainConfig,
    setMainConfig: (config) => {
      setMainConfig(config);
      if (screenId === 1) broadcast('MAIN_CONFIG_CHANGED', config);
    },
    compareConfig,
    setCompareConfig: (config) => {
      setCompareConfig(config);
      if (screenId === 1) broadcast('COMPARE_CONFIG_CHANGED', config);
    },
    mainSimulationIsDone,
    setMainSimulationIsDone: (done) => {
      setMainSimulationIsDone(done);
      if (screenId === 2) broadcast('MAIN_SIMULATION_DONE', done);
    },
    compareSimulationIsDone,
    setCompareSimulationIsDone: (done) => {
      setCompareSimulationIsDone(done);
      if (screenId === 2) broadcast('COMPARE_SIMULATION_DONE', done);
    },
    showCompareConfig,
    setShowCompareConfig: (show) => {
      setShowCompareConfig(show);
      if (screenId === 1) broadcast('SHOW_COMPARE_CONFIG', show);
    },
  };

  return (
    <BroadcastContext.Provider value={value}>
      {children}
    </BroadcastContext.Provider>
  );
};

