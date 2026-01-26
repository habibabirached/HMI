import React, { useState, useEffect, useMemo, use } from "react";
import SimulationRunComponent from '../../components/SimulationRunComponent';
import {useAtom, useAtomValue} from 'jotai';

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
import { compareConfigAtom, compareSimulationIsDoneAtom, getDataFilePath, mainConfigAtom, mainSimulationIsDoneAtom, SIM_CONFIG_OPTIONS } from "../../state/state";
import SimulationConfigComponent from "../../components/SimulationConfigComponent";
import SimulationCompareComponent from "../../components/SimulationCompareComponent";
import { COMPARE_COLOR, MAIN_COLOR } from "../../config";


const Home = () => {

    const [ doUseBESS, setDoUseBESS] = useState(true);
    const [ selectedTabId, setSelectedTabId] = useState(0);

    const [showCompareConfig, setShowCompareConfig] = useState(false);
    const [showHideLabel, setShowHideLabel] = useState("Show Compare Config");

    const [doShowComparisonData, setDoShowComparisonData] = useState(false);

    // ------------------------------------------- State Atoms -------------------------------------------

    const [mainConfig, setMainConfig] = useAtom(mainConfigAtom);
    const [compareConfig, setCompareConfig] = useAtom(compareConfigAtom);

    const [mainSimulationIsDone, setMainSimulationIsDone] = useAtom(mainSimulationIsDoneAtom);
    const [compareSimulationIsDone, setCompareSimulationIsDone] = useAtom(compareSimulationIsDoneAtom);

    // ------------------------------------- Auxiliary Functions -------------------------------------
    
    // const handleTabSelected = (event, index) => {
    //     setSelectedTabId(index);
    //     setMainConfig(SIM_CONFIG_OPTIONS[index]);
    // }

    const toggleShowCompareConfig = (event) => {
        setShowCompareConfig(prev => !prev);
        if (showCompareConfig) {
          setShowHideLabel("Hide Compare Config");
        } else {
          setShowHideLabel("Show Compare Config");
        }
    }

    useEffect(() => {
      console.log('Home: mainSimulationIsDone=', mainSimulationIsDone, 'compareSimulationIsDone=', compareSimulationIsDone);
      if (mainSimulationIsDone === true && compareSimulationIsDone === true) {
        setDoShowComparisonData(true)
      } else {
        setDoShowComparisonData(false);
      }

    }, [mainSimulationIsDone, compareSimulationIsDone]);

    return (
        <Box >

          {/* <Tabs
            value={selectedTabId}
            indicatorColor="inherit"
            textColor="inherit"
            onChange={handleTabSelected}
            aria-label="disabled tabs example"
          >
            <Tab label="HD Only"/>
            <Tab label="HD & BESS"/>
            <Tab label="Aero Only"/>
            <Tab label="Aero & BESS"/>
          </Tabs> */}

{/* ------------------ Main Simulation Panel 3,6,3 ------------------ */}
          <Grid container spacing={2}>
            <Grid item xs={3} sx={{ m: 2, mt:10 }}>
              <SimulationConfigComponent setConfig={setMainConfig}/>
            </Grid>

            <Grid item xs={6} sx={{ m: 2}}>
              <Box sx={{ m: 2 }}>
                  {mainConfig === SIM_CONFIG_OPTIONS[0] && (<SimulationRunComponent title='Using HD Generator without BESS'
                    dataFilePath={ getDataFilePath(mainConfig) }
                    runningImagePath={'./HD_No_BESS_Running.gif'}
                    notRunningImagePath={'./HD_No_BESS_Still.jpg'}
                    config = {mainConfig}
                    setIsDone = {setMainSimulationIsDone}
                    simulationLineColor={MAIN_COLOR}
                  ></SimulationRunComponent>)}

                  {mainConfig === SIM_CONFIG_OPTIONS[1] && (<SimulationRunComponent title='Using HD Generator with BESS Supplying Data Center Load'
                    dataFilePath={getDataFilePath(mainConfig)}
                    runningImagePath={'./HD_BESS_Running.gif'}
                    notRunningImagePath={'./HD_BESS_Still.jpg'}
                    config = {mainConfig}
                    setIsDone = {setMainSimulationIsDone}
                    simulationLineColor={MAIN_COLOR}
                  ></SimulationRunComponent>)}

                  {mainConfig === SIM_CONFIG_OPTIONS[2] && (<SimulationRunComponent title='Using Aero Derivative Generator without BESS'
                    dataFilePath={getDataFilePath(mainConfig)}
                    runningImagePath={'./Aero_No_BESS_Running.gif'}
                    notRunningImagePath={'./Aero_No_BESS_Still.jpg'}
                    config = {mainConfig}
                    setIsDone = {setMainSimulationIsDone}
                    simulationLineColor={MAIN_COLOR}
                  ></SimulationRunComponent>)}

                  {mainConfig === SIM_CONFIG_OPTIONS[3] && (<SimulationRunComponent title='Using Aero Derivative Generator with BESS Supplying Data Center Load'
                    dataFilePath={getDataFilePath(mainConfig)}
                    runningImagePath={'./Aero_BESS_Running.gif'}
                    notRunningImagePath={'./Aero_BESS_Still.jpg'}
                    config = {mainConfig}
                    setIsDone = {setMainSimulationIsDone}
                    simulationLineColor={MAIN_COLOR}
                  ></SimulationRunComponent>)}
              </Box>
            </Grid>

            {showCompareConfig === true && (
              <Grid item xs={3} sx={{ m: 2}}>
                <SimulationCompareComponent title='Compare Simulations'
                  doShowComparisonData={doShowComparisonData}
                  mainConfig={mainConfig}
                  compareConfig={compareConfig} />
              </Grid>
            )}

          </Grid>

{/* ------------------ Show/hide compare panel ------------------ */}

          <Grid container spacing={2}>
            <Grid item xs={3} sx={{ m: 2 }}>
              <Button variant="contained" onClick={toggleShowCompareConfig}> {showHideLabel} </Button>
            </Grid>
          </Grid>

{/* ------------------ Compare Simulation Panel 3,6,3 ------------------ */}
          {showCompareConfig === true && (
            <Grid container spacing={2}>

              <Grid item xs={3} sx={{ m: 2, mt:10 }}>
                <SimulationConfigComponent setConfig={setCompareConfig}/>
              </Grid>

              <Grid item xs={6} sx={{ m: 2 }}>
                <Box sx={{ m: 2 }}>
                    {compareConfig === SIM_CONFIG_OPTIONS[0] && (<SimulationRunComponent title='Using HD Generator without BESS'
                      dataFilePath={getDataFilePath(compareConfig)}
                      runningImagePath={'./HD_No_BESS_Running.gif'}
                      notRunningImagePath={'./HD_No_BESS_Still.jpg'}
                      config = {compareConfig}
                      setIsDone = {setCompareSimulationIsDone}
                      simulationLineColor={COMPARE_COLOR}
                    ></SimulationRunComponent>)}

                    {compareConfig === SIM_CONFIG_OPTIONS[1] && (<SimulationRunComponent title='Using HD Generator with BESS Supplying Data Center Load'
                      dataFilePath={getDataFilePath(compareConfig)}
                      runningImagePath={'./HD_BESS_Running.gif'}
                      notRunningImagePath={'./HD_BESS_Still.jpg'}
                      config = {compareConfig}
                      setIsDone = {setCompareSimulationIsDone}
                      simulationLineColor={COMPARE_COLOR}
                    ></SimulationRunComponent>)}

                    {compareConfig === SIM_CONFIG_OPTIONS[2] && (<SimulationRunComponent title='Using Aero Derivative Generator without BESS'
                      dataFilePath={getDataFilePath(compareConfig)}
                      runningImagePath={'./Aero_No_BESS_Running.gif'}
                      notRunningImagePath={'./Aero_No_BESS_Still.jpg'}
                      config = {compareConfig}
                      setIsDone = {setCompareSimulationIsDone}
                      simulationLineColor={COMPARE_COLOR}
                    ></SimulationRunComponent>)}

                    {compareConfig === SIM_CONFIG_OPTIONS[3] && (<SimulationRunComponent title='Using Aero Derivative Generator with BESS Supplying Data Center Load'
                      dataFilePath ={getDataFilePath(compareConfig)}
                      runningImagePath={'./Aero_BESS_Running.gif'}
                      notRunningImagePath={'./Aero_BESS_Still.jpg'}
                      config = {compareConfig}
                      setIsDone = {setCompareSimulationIsDone}
                      simulationLineColor={COMPARE_COLOR}
                    ></SimulationRunComponent>)}
                </Box>
              </Grid>

          </Grid>
        )}


        </Box>

    );
};

export default Home;
