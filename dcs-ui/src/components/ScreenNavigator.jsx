import React, { useState, useEffect } from 'react';
import { Box, Button, ButtonGroup, Paper, Typography, Fade } from '@mui/material';
import { useFullscreen } from '../contexts/FullscreenContext';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const ScreenNavigator = () => {
  const { isFullscreen, screenWidth } = useFullscreen();
  const [currentScreen, setCurrentScreen] = useState(1);

  useEffect(() => {
    if (!isFullscreen) return;

    const handleScroll = () => {
      const scrollX = window.scrollX;
      const screen = Math.floor(scrollX / screenWidth) + 1;
      setCurrentScreen(Math.min(3, Math.max(1, screen)));
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isFullscreen, screenWidth]);

  const scrollToScreen = (screenNumber) => {
    const targetX = (screenNumber - 1) * screenWidth;
    window.scrollTo({
      left: targetX,
      behavior: 'smooth'
    });
  };

  if (!isFullscreen) return null;

  return (
    <Fade in={isFullscreen}>
      <Paper
        elevation={6}
        sx={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          padding: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          backgroundColor: 'rgba(0, 94, 96, 0.95)',
          color: 'white',
        }}
      >
        <Button
          variant="contained"
          size="small"
          disabled={currentScreen === 1}
          onClick={() => scrollToScreen(currentScreen - 1)}
          startIcon={<ChevronLeftIcon />}
          sx={{ minWidth: 100 }}
        >
          Previous
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2">Screen:</Typography>
          <ButtonGroup size="small" variant="contained">
            {[1, 2, 3].map(screen => (
              <Button
                key={screen}
                onClick={() => scrollToScreen(screen)}
                sx={{
                  backgroundColor: currentScreen === screen ? '#fff' : 'rgba(255,255,255,0.2)',
                  color: currentScreen === screen ? '#005E60' : '#fff',
                  '&:hover': {
                    backgroundColor: currentScreen === screen ? '#fff' : 'rgba(255,255,255,0.3)',
                  }
                }}
              >
                {screen}
              </Button>
            ))}
          </ButtonGroup>
        </Box>

        <Button
          variant="contained"
          size="small"
          disabled={currentScreen === 3}
          onClick={() => scrollToScreen(currentScreen + 1)}
          endIcon={<ChevronRightIcon />}
          sx={{ minWidth: 100 }}
        >
          Next
        </Button>

        <Typography variant="caption" sx={{ ml: 2, opacity: 0.8 }}>
          Total Width: {screenWidth * 3}px
        </Typography>
      </Paper>
    </Fade>
  );
};

export default ScreenNavigator;

