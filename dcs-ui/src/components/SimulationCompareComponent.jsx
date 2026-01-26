import React from "react";

import { useState, useEffect, useMemo, use } from "react";
import { csv2JSON } from "../utils";

import { useAtomValue } from 'jotai';

import {
  Box,
  Button,
  Grid,
  ListItem,
  LinearProgress,
  Typography,
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


import { compareConfigAtom, getDataFilePath, getJsonDataList, mainConfigAtom, SIM_CONFIG_OPTIONS } from "../state/state";
import CompareGeneratorFFTChartComponent from "./charts/CompareGeneratorFFTChartComponent";
import CompareMechanicalTorqueChartComponent from "./charts/CompareMechanicalTorqueChartComponent";
import CompareDataCenterLoadChartComponent from "./charts/CompareDataCenterLoadChartComponent";

const SimulationCompareComponent = ({
  title,
  doShowComparisonData,
  mainConfig,
  compareConfig

}) => {
  const [mainDataJson, setMainDataJson] = useState(null);
  const [compareDataJson, setCompareDataJson] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [subtitle, setSubtitle] = useState('');
  const [chartHeight, setChartHeight] = useState(400);


  useEffect(() => {
    // Calculate chart height based on screen height
    const calculateHeight = () => {
      const screenHeight = window.innerHeight;
      const headerHeight = 64; // Approximate header height
      const titleHeight = 80; // Space for title and subtitle
      const footerHeight = 50; // Approximate footer height
      const gaps = 16; // Total gap space between charts
      const availableHeight = screenHeight - headerHeight - titleHeight - footerHeight - gaps;
      const heightPerChart = Math.floor(availableHeight / 3.3);
      setChartHeight(heightPerChart);
    };

    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    
    return () => window.removeEventListener('resize', calculateHeight);
  }, []);


  useEffect( () => {
    console.log(`SimulationCompareComponent: useEffect() called with ${mainConfig}, ${compareConfig}:`);
    loadSimulationData();
    setSubtitle(`${mainConfig} vs ${compareConfig}`);
  }, [mainConfig, compareConfig]);

  const getSubtitle = () => {
    if (mainConfig != null && compareConfig != null)
      return `${mainConfig} vs ${compareConfig}`;
    return null;
  }

  const loadSimulationData = async () => {
    console.log("SimulationCompareComponent: loadSimulationData() called");
    setIsLoading(true);

    // let mainFilePath = getDataFilePath(mainConfig);
    // let compareFilePath = getDataFilePath(compareConfig);

    // let mainResponse = null;
    // mainResponse = await fetch(mainFilePath);
    // let mainResponseText = await mainResponse.text();
    // let mainJsonContent = await csv2JSON(mainResponseText);

    let mainJsonContent = await getJsonDataList(mainConfig);
    
    // let compareResponse = null;
    // compareResponse = await fetch(compareFilePath);
    // let compareResponseText = await compareResponse.text();
    // let compareJsonContent = await csv2JSON(compareResponseText);
    
    let compareJsonContent = await getJsonDataList(compareConfig);


    setCompareDataJson(compareJsonContent);
    setMainDataJson(mainJsonContent);

    setIsLoading(false);
  };


  return (
    <Box sx={{ width: '100%', height: '100%' }}>

{/* ---------------------- Loading spinner --------------------- */}

      {isLoading && (
        <Box sx={{  display: 'flex',
                    justifyContent: 'center',
                    width: '100%',
                    p: 2
                }}>
            <CircularProgress size="100px" />
        </Box>
      )}


      {!isLoading && mainDataJson != null && compareDataJson != null && (
        <Box sx={{ width: '100%' }}>

          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Typography sx={{ fontSize: "1.5rem", fontWeight: "bold" }} >
              {title}
            </Typography>

            <Typography sx={{ fontSize: "1rem", fontWeight: "bold" }} >
              {subtitle}
            </Typography>
          </Box>


{/* ---------------------- Comparatives Simulation charts --------------------- */}

          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 2,
            width: '100%',
            alignItems: 'center',
            flex: 1
          }}>
            <Box sx={{ width: '100%', maxWidth: '100%', height: `${chartHeight}px` }}>
              <CompareMechanicalTorqueChartComponent doShowData={doShowComparisonData} mainDataArray={mainDataJson} compareDataArray={compareDataJson}/>
            </Box>

            <Box sx={{ width: '100%', maxWidth: '100%', height: `${chartHeight}px` }}>
              <CompareDataCenterLoadChartComponent doShowData={doShowComparisonData} mainDataArray={mainDataJson} compareDataArray={compareDataJson}/>
            </Box>

            <Box sx={{ width: '100%', maxWidth: '100%', height: `${chartHeight}px` }}>
              <CompareGeneratorFFTChartComponent doShowData={doShowComparisonData} mainDataArray={mainDataJson} compareDataArray={compareDataJson}/>
            </Box>
          </Box>

{/* ---------------------- End Comparative Simulation charts --------------------- */}

        </Box>
      )}
    </Box>
  );
};

export default SimulationCompareComponent;
