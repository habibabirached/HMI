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

import ActivePowerChartComponent from "./charts/ActivePowerChartComponent";
import ReactivePowerChartComponent from "./charts/ReactivePowerChartComponent";
import GeneratorFrequencyChartComponent from "./charts/GeneratorFrequencyChartComponent";
import RMSVoltageChartComponent from "./charts/RMSVoltageChartComponent";
import RMSCurrentChartComponent from "./charts/RMSCurrentChartComponent";
import MechanicalTorqueChartComponent from "./charts/MechanicalTorqueChartComponent";
import GeneratorInstVoltChartComponent from "./charts/GeneratorInstVoltChartComponent";
import GeneratorInstCurrentChartComponent from "./charts/GeneratorInstCurrentChartComponent";

import DataCenterLoadChartComponent from "./charts/DataCenterLoadChartComponent";
import GeneratorAndBatteryChartComponent from "./charts/GeneratorAndBatteryChartComponent";
import GeneratorFFTChartComponent from "./charts/GeneratorFFTChartComponent";
import BESSVoltageChartComponent from "./charts/BESSVoltageChartComponent";
import BESSCurrentChartComponent from "./charts/BESSCurrentChartComponent";
import BESSPowerChartComponent from "./charts/BESSPowerChartComponent";
import { animationDurationAtom, getJsonDataList, mainConfigAtom, SIM_CONFIG_OPTIONS } from "../state/state";
import { CHART_MIN_HEIGHT, CHART_MIN_WIDTH } from "../config";

const SimulationRunComponent = ({
  title,
  dataFilePath,
  runningImagePath,
  notRunningImagePath,
  config,
  setIsDone,
  simulationLineColor,
}) => {
  const [dataJson, setDataJson] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [doAnimate, setDoAnimate] = useState(true);
  const [runButtonLabel, setRunButtonLabel] = useState("Run Simulation");

  const animationDuration = useAtomValue(animationDurationAtom);

  //const currentConfig = useAtomValue(currentConfigAtom);


  useEffect(() => {
    console.log('SimulationPanelComponent: loadSimulationData() called');
    resetSimulation();
    loadSimulationData();
  }, []);


  const loadSimulationData = async () => {
    console.log("loadSimulationData() called");
    setIsLoading(true);

    // let response = null;
    // response = await fetch(dataFilePath);
    // let responseText = await response.text();
    // let jsonContent = await csv2JSON(responseText);

    let jsonContent = await getJsonDataList(config)
    setDataJson(jsonContent);
    setIsLoading(false);
  };


  const resetSimulation = () => {
    console.log("resetSimulation() called");
    setIsDone(false);
    setDoAnimate(false);
    setRunButtonLabel("Run Simulation");
  }


  const toggleSimulation = () => {
    console.log("toggleSimulation() called");
    if (!isRunning) {
      setRunButtonLabel("Reset");
      console.log("start animation");
      setIsDone(false);
      setDoAnimate(true);
      setTimeout(() => {
        console.log("end animation");
        setDoAnimate(false);
        setIsDone(true);
      }, 1 * 1000 + animationDuration);
    } else {
      setRunButtonLabel("Run Simulation");
    }
    setIsRunning((prev) => !prev);
  };

  return (
    <Box sx={{ width: '100%' }}>

{/* ------------------- Start / Stop Simulation --------------------- */}
      {dataJson != null && (
        <Box sx={{  display: 'flex',
                    justifyContent: 'center',
                    width: '100%'
                }}>
          <Button sx={{ m: 2 }} variant="contained" onClick={toggleSimulation}>
            {runButtonLabel}
          </Button>
        </Box>
      )}

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


      {!isLoading && dataJson != null && (
        <Box sx={{ width: '100%' }}>

          {/* <Grid container justifyContent="center">
            <Grid item xs={12} sx={{textAlign: "center" }}>
              <Typography sx={{ fontSize: "1rem", fontWeight: "bold" }} >
                {title}
              </Typography>
            </Grid>
          </Grid> */}


{/* ----------------------Simulation charts --------------------- */}
          <Grid container spacing={2} sx={{ width: '100%' }}>
            <Grid item xs={12} sx={{ m: 2, width: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', flexDirection: 'row', width: '100%'}}>
                <Box sx={{ ml: 2, display: 'flex', alignItems: 'center', flexDirection: 'column'}}>
                  <Typography>Generator</Typography>
                  <img src={'/Generator.png'} alt="Generator" width="150" height="100"  />
                </Box>
                <GeneratorFrequencyChartComponent run={isRunning} dataArray={dataJson} animationDuration={animationDuration} lineColor={simulationLineColor} config={config}/>
                <MechanicalTorqueChartComponent run={isRunning} dataArray={dataJson} animationDuration={animationDuration} lineColor={simulationLineColor} config={config} />
                {/* <GeneratorInstVoltChartComponent run={isRunning} dataArray={dataJson} />
                <GeneratorInstCurrentChartComponent run={isRunning} dataArray={dataJson} />
                <GeneratorFFTComponent run={isRunning} dataArray={dataJson} /> */}
              </Box>
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ width: '100%' }}>
            <Grid item xs={12} sx={{ m: 2, width: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', flexDirection: 'row', width: '100%'}}>

                <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column'}} >
                  <Typography>To Data Center</Typography>
                  <img src={'/DataCenterLoad.png'} alt="Data Center Load" width="150" height="100"  />
                </Box>
                <DataCenterLoadChartComponent run={isRunning} dataArray={dataJson} animationDuration={animationDuration} lineColor={simulationLineColor}/>
                {/* ----------------------Simulation animation --------------------- */}
                <Box sx={{ m: 2 }}>
                  {isRunning && doAnimate && (
                    <img
                      sx={{verticalAlign:'middle', margin:'5px'}}
                      src={runningImagePath}
                      alt="Running"
                      width='100%'
                      height={300}
                      loading="eager"
                    />
                  )}
                  {! doAnimate && (
                    <img
                      src={notRunningImagePath}
                      style={{verticalAlign:'middle', margin:'5px'}}
                      alt="Not Running"
                      width='100%'
                      height={300}
                      loading="eager"
                    />
                  )}
                </Box>

              </Box>
            </Grid>
          </Grid>

            {(config === SIM_CONFIG_OPTIONS[1] || config === SIM_CONFIG_OPTIONS[3]) && (
              <Grid container spacing={2} sx={{ width: '100%' }}>
                <Grid item xs={12} sx={{ m: 2, width: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', flexDirection: 'row', width: '100%'}}>
                    <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column'}}>
                      <Typography>BESS</Typography>
                      <img src={'/BatteryEnergyStorage.png'} alt="Battery Energy Storage System" width="150" height="100"  />
                    </Box>
                    <BESSVoltageChartComponent run={isRunning} dataArray={dataJson} animationDuration={animationDuration} lineColor={simulationLineColor} config={config} />
                    <BESSPowerChartComponent run={isRunning} dataArray={dataJson} animationDuration={animationDuration} lineColor={simulationLineColor}/>
                  </Box>
                </Grid>
              </Grid>
            )}

{/* ---------------------- Comparatives Simulation charts --------------------- */}

          {/* <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column'}}>
              <Typography sx={{fontSize:'16px'}}>Comparatives</Typography>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={4} sx={{ m: 2 }}>
              <GeneratorAndBatteryComponent run={isRunning} dataArray={dataJson}/>
            </Grid>
            <Grid item xs={4} sx={{ m: 2 }}>
              <ActivePowerComponent run={isRunning} dataArray={dataJson} />
            </Grid>
            <Grid item xs={4} sx={{ m: 2 }}>
              <ReactivePowerChartComponent run={isRunning} dataArray={dataJson} />
            </Grid>
            <Grid item xs={4} sx={{ m: 2 }}>
              <RMSVoltageChartComponent run={isRunning} dataArray={dataJson} />
            </Grid>
            <Grid item xs={4} sx={{ m: 2 }}>
              <RMSCurrentChartComponent run={isRunning} dataArray={dataJson} />
            </Grid>
        </Grid> */}

{/* ---------------------- End Comparative Simulation charts --------------------- */}

        </Box>
      )}
    </Box>
  );
};

export default SimulationRunComponent;
