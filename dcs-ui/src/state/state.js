import { atom } from 'jotai';
import { csv2JSON } from '../utils';

// these are for the old toolbar...
export const TURBINE_OPTIONS = ['HD', 'Aero'];
export const BESS_OPTIONS = ['With_BESS', 'Without_BESS'];

// Now we have 4 hard-coded simulation results to choose from
export const SIM_CONFIG_OPTIONS = ['HD_ONLY', 'HD_BESS', 'AERO_ONLY', 'AERO_BESS'];

// -------------------------- Atoms shared by all components --------------------------

export const simulationDurationAtom = atom(23); // in seconds - fixed at 20s

export const animationDurationAtom = atom((get) => get(simulationDurationAtom) * 1000);

// this app compares the results of two simulations, the main and the compare one
// keep track of the config of the main and compare simulations
export const mainConfigAtom = atom(SIM_CONFIG_OPTIONS[0]); // Starts with HD_ONLY (without BESS)
export const compareConfigAtom = atom(SIM_CONFIG_OPTIONS[1]); // Starts with HD_BESS (with BESS)

// keep track of the config of the execution state of the simulations we want to compare
export const mainSimulationIsDoneAtom = atom(false);
export const compareSimulationIsDoneAtom = atom(false);

// -------------------------- Helper functions --------------------------

// each simulation data is stored in a CSV file, this function returns the file path based on the config option
export const getDataFilePath = (configOption) => {
    switch(configOption) {
        case SIM_CONFIG_OPTIONS[0]:
            // return '/HD_No_BESS_Mod.csv';
            // return '/HD_noBESS.csv';
            return '/HD_noBESS.Jan8.csv';
        case SIM_CONFIG_OPTIONS[1]:
            // return '/HD_BESS_Mod.csv';
            // return '/HD_BESSJan7.csv';
            return '/HD_BESS.Jan8.csv';
        case SIM_CONFIG_OPTIONS[2]:
            // return '/Aero_No_BESS_Mod.csv';
            // return '/Aero_noBESS.csv';
            return '/Aero_noBESS.Jan8.csv';
        case SIM_CONFIG_OPTIONS[3]:
            // return '/Aero_BESS_Mod.csv';
            // return '/Aero_BESSJan7.csv';
            return '/Aero_BESS.Jan8.csv';
        default:
            // return '/HD_BESS_Mod.csv';
            // return '/HD_BESSJan7.csv';
            return '/HD_BESS.Jan8.csv';
    }
};

const dataCache = {};

export const loadDataFromFileAsJson = async (filePath) => {
    console.log('Loading data from file:', filePath);
    let response = null;
    response = await fetch(filePath);
    let responseText = await response.text();

    let jsonContent = await csv2JSON(responseText);
    return jsonContent;
}

export const getJsonDataList = async (configOption) => {
    if (! dataCache[configOption]) {
        const jsonData = await loadDataFromFileAsJson(getDataFilePath(configOption));
        dataCache[configOption] = jsonData;
    }    
    return dataCache[configOption];
};
