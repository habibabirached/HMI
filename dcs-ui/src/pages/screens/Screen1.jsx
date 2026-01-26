import React from 'react';
import { Box, Button } from '@mui/material';
import SimulationConfigComponent from '../../components/SimulationConfigComponent';
import ScreenHeader from '../../components/ScreenHeader';
import Footer from '../../Footer';
import { useBroadcast } from '../../contexts/BroadcastContext';

const Screen1 = () => {
  const { setMainConfig, setCompareConfig, setShowCompareConfig, showCompareConfig } = useBroadcast();

  const toggleShowCompareConfig = () => {
    setShowCompareConfig(!showCompareConfig);
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#121212' }}>
      <ScreenHeader screenNumber={1} title="Configuration" />
      
      <Box sx={{ p: 2 }}>
        <SimulationConfigComponent setConfig={setMainConfig} />
        
        {/* Show/Hide Compare Config Button */}
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
          <Button 
            variant="contained" 
            onClick={toggleShowCompareConfig}
            sx={{ minWidth: 250 }}
          >
            {showCompareConfig ? "Hide Compare Config" : "Show Compare Config"}
          </Button>
        </Box>
        
        {showCompareConfig && (
          <Box sx={{ mt: 4 }}>
            <SimulationConfigComponent setConfig={setCompareConfig} isCompare={true} />
          </Box>
        )}
      </Box>
      <Footer />
    </Box>
  );
};

export default Screen1;

