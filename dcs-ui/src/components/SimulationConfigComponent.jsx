import React, {useState, useEffect} from "react";
import { Box, Grid, Paper,
        MenuItem, FormControl, 
        InputLabel, Select, 
        Typography, TextField } from "@mui/material";
import { BESS_OPTIONS, mainConfigAtom, SIM_CONFIG_OPTIONS, TURBINE_OPTIONS } from "../state/state";


const SimulationConfigComponent = ({
    setConfig,
    isCompare = false,
    title = "Simulation Configuration"
}) => {

    const [turbineType, setTurbineType] = useState(TURBINE_OPTIONS[1]); // Default to Aero
    const [batteryType, setBatteryType] = useState(isCompare ? BESS_OPTIONS[0] : BESS_OPTIONS[1]); // If compare panel, default to With_BESS

    const handleTurbineChange = (event) => {
        setTurbineType(event.target.value);
    }

    const handleBatteryChange = (event) => {
        setBatteryType(event.target.value);
    }

    useEffect(() => {
        console.log('Turbine:', turbineType, 'Battery:', batteryType);

        if (turbineType === TURBINE_OPTIONS[0]) {

            if (batteryType === BESS_OPTIONS[0]) {
                setConfig(SIM_CONFIG_OPTIONS[1]); // HD_BESS
            } else if (batteryType === BESS_OPTIONS[1]) {
                // HD_Only
                setConfig(SIM_CONFIG_OPTIONS[0]); // HD_ONLY
            }

        } else if (turbineType === TURBINE_OPTIONS[1]) {
            
            if (batteryType === BESS_OPTIONS[0]) {
                setConfig(SIM_CONFIG_OPTIONS[3]); // Aero_BESS
            } else if (batteryType === BESS_OPTIONS[1]) {
                // HD_Only
                setConfig(SIM_CONFIG_OPTIONS[2]); // Aero_ONLY
            }
        }

    }, [turbineType, batteryType]);

    return (
        
        <Box sx={{ position: 'relative', p: 2 }}>
            
            <Grid container justifyContent="center" sx={{ mb: 3 }}>
                <Grid item xs={12} sx={{textAlign: "center" }}>
                    <Typography sx={{ fontSize: "2rem", fontWeight: "bold" }} >
                        {title}
                    </Typography>
                </Grid>
            </Grid>

            {/* Main Flow Container */}
            <Box sx={{ position: 'relative' }}>
                
                {/* Top Row: Turbine -> Generator -> Data Center Load */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                    
                    {/* Turbine Box */}
                    <Paper elevation={6} sx={{
                        width: '28%',
                        p: 2,
                        background: 'linear-gradient(145deg, #1e1e1e 0%, #2a2a2a 100%)',
                        border: '2px solid rgba(94, 183, 255, 0.3)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(94, 183, 255, 0.15)',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                            border: '2px solid rgba(94, 183, 255, 0.6)',
                            boxShadow: '0 12px 40px rgba(94, 183, 255, 0.25)',
                            transform: 'translateY(-2px)'
                        }
                    }}>
                        <Typography sx={{ 
                            color: '#5EB7FF', 
                            fontWeight: 600, 
                            mb: 1.5,
                            fontSize: '0.95rem',
                            textAlign: 'center',
                            letterSpacing: '0.5px'
                        }}>
                            TURBINE
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
                            <img src={'/Turbine_and_Shaft.png'} alt="Turbine and Shaft" 
                                style={{ width: '100%', maxWidth: '140px', height: 'auto' }} />
                        </Box>
                        <FormControl fullWidth size="small" sx={{
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: 'rgba(94, 183, 255, 0.05)',
                                '&:hover': {
                                    backgroundColor: 'rgba(94, 183, 255, 0.1)',
                                },
                                '& fieldset': {
                                    borderColor: 'rgba(94, 183, 255, 0.3)',
                                },
                                '&:hover fieldset': {
                                    borderColor: 'rgba(94, 183, 255, 0.5)',
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: '#5EB7FF',
                                }
                            },
                            '& .MuiInputLabel-root': {
                                color: 'rgba(255, 255, 255, 0.6)',
                            },
                            '& .MuiSelect-select': {
                                color: '#fff',
                            }
                        }}>
                            <InputLabel id="turbine-select-label">Type</InputLabel>
                            <Select
                                labelId="turbine-select-label"
                                id="turbine-select"
                                value={turbineType}
                                label="Type"
                                onChange={handleTurbineChange}
                            >
                                {TURBINE_OPTIONS.map((option) => (
                                    <MenuItem key={option} value={option}>
                                        {option}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Paper>

                    {/* Mechanical Shaft: Turbine -> Generator */}
                    <Box sx={{ 
                        width: '8%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                    }}>
                        {/* Main shaft body with 3D effect and spinning animation */}
                        <Box sx={{
                            width: '100%',
                            height: '14px',
                            background: 'linear-gradient(180deg, rgba(120, 200, 255, 0.9) 0%, rgba(94, 183, 255, 0.6) 30%, rgba(60, 150, 220, 0.8) 50%, rgba(94, 183, 255, 0.6) 70%, rgba(120, 200, 255, 0.9) 100%)',
                            borderRadius: '7px',
                            boxShadow: '0 4px 12px rgba(94, 183, 255, 0.5), inset 0 2px 0 rgba(200, 255, 255, 0.6), inset 0 -2px 4px rgba(0, 50, 100, 0.3)',
                            position: 'relative',
                            overflow: 'hidden',
                            '&::before': {
                                content: '""',
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                top: '20%',
                                height: '2px',
                                background: 'rgba(220, 255, 255, 0.8)',
                                boxShadow: '0 1px 2px rgba(255, 255, 255, 0.4)',
                            },
                            '&::after': {
                                content: '""',
                                position: 'absolute',
                                left: '-20px',
                                right: 0,
                                top: 0,
                                bottom: 0,
                                background: 'repeating-linear-gradient(90deg, transparent 0px, transparent 15px, rgba(0, 50, 100, 0.2) 15px, rgba(0, 50, 100, 0.2) 18px, transparent 18px, transparent 20px, rgba(200, 255, 255, 0.15) 20px, rgba(200, 255, 255, 0.15) 22px)',
                                animation: 'shaftSpin 2s linear infinite',
                            }
                        }} />
                        {/* Keyframes for spinning animation */}
                        <style>
                            {`
                                @keyframes shaftSpin {
                                    0% {
                                        transform: translateX(0);
                                    }
                                    100% {
                                        transform: translateX(40px);
                                    }
                                }
                            `}
                        </style>
                    </Box>

                    {/* Generator Box */}
                    <Paper elevation={6} sx={{
                        width: '28%',
                        p: 2,
                        background: 'linear-gradient(145deg, #1e1e1e 0%, #2a2a2a 100%)',
                        border: '2px solid rgba(94, 183, 255, 0.3)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(94, 183, 255, 0.15)',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                            border: '2px solid rgba(94, 183, 255, 0.6)',
                            boxShadow: '0 12px 40px rgba(94, 183, 255, 0.25)',
                            transform: 'translateY(-2px)'
                        }
                    }}>
                        <Typography sx={{ 
                            color: '#5EB7FF', 
                            fontWeight: 600, 
                            mb: 1.5,
                            fontSize: '0.95rem',
                            textAlign: 'center',
                            letterSpacing: '0.5px'
                        }}>
                            GENERATOR
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                            <img src={'/Generator.png'} alt="Generator" 
                                style={{ width: '100%', maxWidth: '140px', height: 'auto' }} />
                        </Box>
                    </Paper>

                    {/* Connector: Generator -> Data Center Load */}
                    <Box sx={{ 
                        width: '8%', 
                        height: '2px',
                        background: 'linear-gradient(90deg, rgba(94, 183, 255, 0.6) 0%, rgba(94, 183, 255, 0.4) 100%)',
                        position: 'relative',
                        '&::after': {
                            content: '""',
                            position: 'absolute',
                            right: '-6px',
                            top: '-4px',
                            width: 0,
                            height: 0,
                            borderLeft: '10px solid rgba(94, 183, 255, 0.6)',
                            borderTop: '5px solid transparent',
                            borderBottom: '5px solid transparent',
                        }
                    }} />

                    {/* Data Center Load Box */}
                    <Paper elevation={6} sx={{
                        width: '28%',
                        p: 2,
                        background: 'linear-gradient(145deg, #1e1e1e 0%, #2a2a2a 100%)',
                        border: '2px solid rgba(94, 183, 255, 0.3)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(94, 183, 255, 0.15)',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                            border: '2px solid rgba(94, 183, 255, 0.6)',
                            boxShadow: '0 12px 40px rgba(94, 183, 255, 0.25)',
                            transform: 'translateY(-2px)'
                        }
                    }}>
                        <Typography sx={{ 
                            color: '#5EB7FF', 
                            fontWeight: 600, 
                            mb: 1.5,
                            fontSize: '0.95rem',
                            textAlign: 'center',
                            letterSpacing: '0.5px'
                        }}>
                            DATA CENTER LOAD
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                            <img src={'/DataCenterLoad.png'} alt="Data Center Load" 
                                style={{ width: '100%', maxWidth: '140px', height: 'auto' }} />
                        </Box>
                    </Paper>
                </Box>

                {/* BESS Box - Below and to the left, with connector */}
                <Box sx={{ position: 'relative', pl: 0, pt: 2 }}>

                    {/* BESS Box */}
                    <Paper elevation={6} sx={{
                        width: '28%',
                        p: 2,
                        background: 'linear-gradient(145deg, #1e1e1e 0%, #2a2a2a 100%)',
                        border: '2px solid rgba(200, 255, 8, 0.3)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(200, 255, 8, 0.15)',
                        transition: 'all 0.3s ease',
                        position: 'relative',
                        '&:hover': {
                            border: '2px solid rgba(200, 255, 8, 0.6)',
                            boxShadow: '0 12px 40px rgba(200, 255, 8, 0.25)',
                            transform: 'translateY(-2px)'
                        }
                    }}>
                        {/* First horizontal segment from right side of BESS */}
                        <Box sx={{
                            position: 'absolute',
                            left: '100%',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '360px',
                            height: '2px',
                            background: 'rgba(200, 255, 8, 0.6)',
                        }} />

                        {/* Vertical segment going up with arrow */}
                        <Box sx={{
                            position: 'absolute',
                            left: 'calc(100% + 360px)',
                            top: 'calc(50% - 250px)',
                            width: '2px',
                            height: '250px',
                            background: 'rgba(200, 255, 8, 0.6)',
                            '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: '-6px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: 0,
                                height: 0,
                                borderBottom: '10px solid rgba(200, 255, 8, 0.6)',
                                borderLeft: '5px solid transparent',
                                borderRight: '5px solid transparent',
                            }
                        }} />

                        {/* Final horizontal segment to Data Center Load box */}
                       
                    
                        <Typography sx={{ 
                            color: '#C8FF08', 
                            fontWeight: 600, 
                            mb: 1.5,
                            fontSize: '0.95rem',
                            textAlign: 'center',
                            letterSpacing: '0.5px'
                        }}>
                            BATTERY STORAGE
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
                            <img src={'/BatteryEnergyStorage.png'} alt="Battery Energy Storage" 
                                style={{ width: '100%', maxWidth: '140px', height: 'auto' }} />
                        </Box>
                        <FormControl fullWidth size="small" sx={{
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: 'rgba(200, 255, 8, 0.05)',
                                '&:hover': {
                                    backgroundColor: 'rgba(200, 255, 8, 0.1)',
                                },
                                '& fieldset': {
                                    borderColor: 'rgba(200, 255, 8, 0.3)',
                                },
                                '&:hover fieldset': {
                                    borderColor: 'rgba(200, 255, 8, 0.5)',
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: '#C8FF08',
                                }
                            },
                            '& .MuiInputLabel-root': {
                                color: 'rgba(255, 255, 255, 0.6)',
                            },
                            '& .MuiSelect-select': {
                                color: '#fff',
                            }
                        }}>
                            <InputLabel id="battery-select-label">BESS</InputLabel>
                            <Select
                                labelId="battery-select-label"
                                id="battery-select"
                                value={batteryType}
                                label="BESS"
                                onChange={handleBatteryChange}
                            >
                                {BESS_OPTIONS.map((option) => (
                                    <MenuItem key={option} value={option}>
                                        {option}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Paper>
                </Box>

            </Box>

        </Box>);

};

export default SimulationConfigComponent;
