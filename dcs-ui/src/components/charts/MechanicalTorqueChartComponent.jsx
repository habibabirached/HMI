import React, {useEffect, useState} from "react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend, 
  ResponsiveContainer,
} from 'recharts';

import {
  Typography, 
  Button, 
  Box
} from "@mui/material";

import { CHART_MIN_HEIGHT, CHART_MIN_WIDTH, DATA_SAMPLING_STEP, MECHANICAL_TORQUE_THRESHOLD, THRESHOLD_COLOR, TIME_PRECISION, TIME_AXIS_TICKS } from '../../config';

// extract the relevant columns
const filterColumns = (dataArray) => {
  let columns = [];
  let resolution = DATA_SAMPLING_STEP;
  for(let i=0; i< dataArray.length; i=i+resolution ) {
    let data = dataArray[i];
    columns.push({
      "Time (s)": parseFloat(data["Time (s)"]).toFixed(TIME_PRECISION),
      "T_mech (p.u.)": parseFloat(data["MOD Torque (p.u.)"]).toFixed(3), //data["T_mech (p.u.)"],
      "threshold": MECHANICAL_TORQUE_THRESHOLD,
    })
  }
  return columns;
}


const MechanicalTorqueChartComponent = React.memo(({ dataArray, run, animationDuration, lineColor, config }) => {

  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    console.log('MechanicalTorqueChartComponent run changed:', run);
    setShowAlert(false)
    let timer = null;
    let excess = 0;
    if (run === true) {
      let columns = filterColumns(dataArray);
      // Check if config contains "Aero" (case-insensitive)
      let timeIntervalDuration = (config && config.toLowerCase().includes('aero')) ? 7 : 6;
      // let timeIntervalDuration = dataArray.length / animationDuration;
      let index = 0;

      timer = setInterval(() => { 
        let element = columns[index];        
        if ( element != null && element["T_mech (p.u.)"] > (element["threshold"])) {           
          excess ++;        
          if (excess > 1) {
            setShowAlert(true);
          }
        } 
        if (index < columns.length - 1 ) index++;
      }, timeIntervalDuration);
    } else {
      // not running
      setShowAlert(false);
    }

    return () => {
        if (timer != null) clearTimeout(timer);
    };

  }, [run]);


  return (
    <Box style={{ textAlign: 'center', position: 'relative' }}>
      <Typography sx={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '2px' }}>
        Mechanical Torque (p.u.)
      </Typography>
      
      {run && showAlert && (    
        <Button sx={{ 
          position: 'absolute', 
          top: '-8px', 
          right: '10px', 
          zIndex: 10,
          padding: '2px 8px',
          fontSize: '0.7rem',
          minHeight: '24px',
          height: '24px'
        }} color="error" size="small" variant="contained">
          Exceeded Threshold!
        </Button>
      )}
      
      {run && ! showAlert && (    
        <Button sx={{ 
          position: 'absolute', 
          top: '-8px', 
          right: '10px', 
          zIndex: 10,
          padding: '2px 8px',
          fontSize: '0.7rem',
          minHeight: '24px',
          height: '24px'
        }} color="success" size="small" variant="contained">
          Within Threshold
        </Button>
      )}

      

      <ResponsiveContainer minWidth={CHART_MIN_WIDTH} minHeight={CHART_MIN_HEIGHT}  
                           width="100%" height="100%">
        <LineChart
          width={"100%"}
          height={"100%"}
          responsive
          data={filterColumns(dataArray)}
          margin={{
            right: 30,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={(dataObj) => dataObj["Time (s)"]}
            type="number"
            domain={[0, 30]}
            ticks={TIME_AXIS_TICKS}
            style={{
                fontSize: '1rem'
            }}
          />
          <YAxis domain={[0.95, 1.12]} 
                 ticks={[0.95, 0.98, 1.01, 1.04, 1.07, 1.10, 1.12]}
                 tickFormatter={(value) => value.toFixed(2)}
                 style={{ fontSize: '1rem' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontFamily: 'Roboto, sans-serif', fontSize: '16px' }}
            verticalAlign="bottom"
            height={36}
          />

          {run && (<div>
              <Line name="T_mech (p.u.)" type="monotone"
                    dataKey={(dataObj) => dataObj["T_mech (p.u.)"]}
                    stroke={lineColor} strokeWidth={2} dot={false} animationDuration={animationDuration} />
              <Line name="threshold" type="monotone"
                    dataKey={(dataObj) => dataObj["threshold"]}
                    stroke={THRESHOLD_COLOR} strokeWidth={3} dot={false}  />

          </div>)}

        </LineChart>

      </ResponsiveContainer>
      
      
    </Box>
  );
});

export default MechanicalTorqueChartComponent;

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-4 bg-slate-900 flex flex-col gap-4 rounded-md">

        <p className="text-medium text-lg"> Time (s): {label}</p>

        <p className="text-sm text-indigo-400">
          T_mech (p.u.):
          <span className="ml-2"> {payload[0].value}</span>
        </p>
        <p className="text-sm text-indigo-400">
          threashold:
          <span className="ml-2"> {payload[1].value}</span>
        </p>

      </div>
    );
  }
};
