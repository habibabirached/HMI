import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { useFullscreen } from '../contexts/FullscreenContext';

const MultiScreenFullscreen = () => {
  const { isFullscreen, toggleFullscreen, screenWidth } = useFullscreen();

  return (
    <Tooltip title={
      isFullscreen 
        ? "Exit Triple Screen Mode" 
        : `Enter Triple Screen Mode (${screenWidth * 3}px width)`
    }>
      <IconButton
        color="inherit"
        onClick={toggleFullscreen}
        size="large"
      >
        {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
      </IconButton>
    </Tooltip>
  );
};

export default MultiScreenFullscreen;

