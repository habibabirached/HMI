import React, { useState } from 'react';
import { Box, Button, Typography, Paper, Alert } from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import MonitorIcon from '@mui/icons-material/Monitor';

const LaunchPage = () => {
  const [launched, setLaunched] = useState(false);

  const launchThreeScreens = () => {
    // Open 3 tabs with different screen content
    const baseUrl = window.location.origin;
    
    // Open Screen 1 (Configuration)
    const screen1 = window.open(`${baseUrl}/screen/1`, '_blank');
    
    // Small delay to prevent popup blocker
    setTimeout(() => {
      // Open Screen 2 (Simulation)
      const screen2 = window.open(`${baseUrl}/screen/2`, '_blank');
      
      setTimeout(() => {
        // Open Screen 3 (Comparison)
        const screen3 = window.open(`${baseUrl}/screen/3`, '_blank');
        
        if (screen1 && screen2 && screen3) {
          setLaunched(true);
        } else {
          alert('Popup blocker detected! Please allow popups for this site and try again.');
        }
      }, 100);
    }, 100);
  };

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #005E60 0%, #003840 100%)',
      }}
    >
      <Paper
        elevation={10}
        sx={{
          padding: 6,
          maxWidth: 600,
          textAlign: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
        }}
      >
        <Box sx={{ mb: 3 }}>
          <img 
            src="/gevernova_white.png" 
            alt="GE Vernova" 
            style={{ 
              height: 60, 
              marginBottom: 20,
              filter: 'invert(1)'
            }} 
          />
        </Box>

        <Typography variant="h3" gutterBottom sx={{ fontWeight: 'bold', color: '#005E60' }}>
          Data Center Simulator
        </Typography>

        <Typography variant="h6" gutterBottom sx={{ color: '#666', mb: 4 }}>
          Multi-Screen Presentation Mode
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 4 }}>
          <MonitorIcon sx={{ fontSize: 60, color: '#005E60' }} />
          <MonitorIcon sx={{ fontSize: 60, color: '#005E60' }} />
          <MonitorIcon sx={{ fontSize: 60, color: '#005E60' }} />
        </Box>

        <Typography variant="body1" sx={{ mb: 4, color: '#555' }}>
          Click the button below to launch 3 browser tabs.
          <br />
          Position each tab on a different screen and press <strong>F11</strong> for fullscreen.
        </Typography>

        <Button
          variant="contained"
          size="large"
          startIcon={<RocketLaunchIcon />}
          onClick={launchThreeScreens}
          sx={{
            backgroundColor: '#005E60',
            padding: '15px 40px',
            fontSize: '1.2rem',
            '&:hover': {
              backgroundColor: '#003840',
            },
          }}
        >
          Launch 3-Screen Presentation
        </Button>

        {launched && (
          <Alert severity="success" sx={{ mt: 3 }}>
            3 tabs launched successfully! Now position each tab on a different screen and press F11.
          </Alert>
        )}

        <Typography variant="caption" sx={{ display: 'block', mt: 4, color: '#888' }}>
          Note: Make sure popup blocker is disabled for this site
        </Typography>
      </Paper>
    </Box>
  );
};

export default LaunchPage;

