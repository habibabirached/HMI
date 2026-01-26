import React, { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Box, IconButton, Tooltip } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';

const ScreenHeader = ({ screenNumber, title }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  return (
    <AppBar position="static" style={{ backgroundColor: "#005E60" }}>
      <Toolbar>
        <img 
          src="/gevernova_white.png" 
          alt="GE Vernova" 
          style={{ height: 40, marginRight: 20 }} 
        />
        <Typography 
          fontWeight="bold" 
          variant="h6" 
          component="div" 
          sx={{ flexGrow: 1 }}
        >
          Data Center Simulator
        </Typography>
        <Box sx={{ 
          backgroundColor: 'rgba(255,255,255,0.2)', 
          padding: '8px 16px', 
          borderRadius: 1,
          mr: 2
        }}>
          <Typography variant="body2">
            Screen {screenNumber}: {title}
          </Typography>
        </Box>
        <Tooltip title={isFullscreen ? "Exit Fullscreen (or press F11)" : "Enter Fullscreen (or press F11)"}>
          <IconButton
            color="inherit"
            onClick={toggleFullscreen}
            size="large"
          >
            {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
};

export default ScreenHeader;

