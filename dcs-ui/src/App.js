import logo from './logo.svg';
import './App.css';
import React, { useState, useEffect, useMemo, use } from "react";
import { csv2JSON } from './utils';
import {
  Box,
  Button,
  Grid,
  ListItem,
  LinearProgress,
  Typography,
  AppBar,
  Toolbar,
  CircularProgress,
  Switch,
  FormControlLabel,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  BottomNavigationAction,
  BottomNavigation,
} from "@mui/material";

import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';


import { createTheme, ThemeProvider } from '@mui/material/styles';

import SimulationRunComponent from './components/SimulationRunComponent';

function App() {
  
  const [ doUseBESS, setDoUseBESS] = useState(true);
  const [ selectedTabId, setSelectedTabId] = useState(0);

  const customTheme = createTheme({
    palette: {
      primary: {
        main: '#1976d2',
      },
    },
  });

  const handleSwitchBessChange = async (event) => {
    setDoUseBESS(event.target.checked);
  }

  const handleTabSelected = (event, index) => {
    setSelectedTabId(index);
  }


  return (
    <div className="App">
      <header className="App-header">

        <ThemeProvider theme={customTheme}>
          <div>

            <Tabs
              value={selectedTabId}
              indicatorColor="inherit"
              textColor="inherit"
              onChange={handleTabSelected}
              aria-label="disabled tabs example"
            >
              <Tab label="HD No BESS"/> 
              <Tab label="HD & BESS"/>
            </Tabs>
            
            <Box>
              {selectedTabId === 0 && (<SimulationRunComponent title='Using Hybrid Diesel Generator without BESS'
                  dataFilePath={'./HD_No_BESS.csv'}
                  runningImagePath={'./HD_No_BESS_Running.gif'}
                  notRunningImagePath={'./HD_No_BESS_Still.jpg'}
                ></SimulationRunComponent>)} 

                {selectedTabId === 1 && (<SimulationRunComponent title='Using Hybrid Diesel Generator with BESS Supplying Data Center Load'
                  dataFilePath={'./HD_BESS.csv'}
                  runningImagePath={'./HD_BESS_Running.gif'}
                  notRunningImagePath={'./HD_BESS_Still.jpg'}
                ></SimulationRunComponent>)}
            </Box>

          </div>


        </ThemeProvider>

      </header>
    </div>
  );
}

export default App;
