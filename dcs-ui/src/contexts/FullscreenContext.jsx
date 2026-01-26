import React, { createContext, useContext, useState, useEffect } from 'react';

const FullscreenContext = createContext();

export const useFullscreen = () => {
  const context = useContext(FullscreenContext);
  if (!context) {
    throw new Error('useFullscreen must be used within FullscreenProvider');
  }
  return context;
};

export const FullscreenProvider = ({ children }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [screenWidth, setScreenWidth] = useState(window.screen.width);
  const [screenHeight, setScreenHeight] = useState(window.screen.height);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    const elem = document.documentElement;

    if (!isFullscreen) {
      try {
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
          await elem.mozRequestFullScreen();
        } else if (elem.msRequestFullscreen) {
          await elem.msRequestFullscreen();
        }
      } catch (error) {
        console.error('Error entering fullscreen:', error);
      }
    } else {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      } catch (error) {
        console.error('Error exiting fullscreen:', error);
      }
    }
  };

  const value = {
    isFullscreen,
    screenWidth,
    screenHeight,
    toggleFullscreen,
    tripleWidth: screenWidth * 3,
  };

  return (
    <FullscreenContext.Provider value={value}>
      {children}
    </FullscreenContext.Provider>
  );
};

