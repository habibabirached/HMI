import React from "react";

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
} from "@mui/material";
import { CHART_MIN_HEIGHT, CHART_MIN_WIDTH, DATA_SAMPLING_STEP } from '../../config';

// extract the relevant columns
const filterColumns = (dataArray) => {
  let columns = [];
  let resolution = DATA_SAMPLING_STEP;
  for(let i=0; i< dataArray.length; i=i+resolution ) {
    let data = dataArray[i];
    columns.push({
      "frequency_FFT (Hz)": data["frequency_FFT (Hz)"],
      "magnitude_FFT":data["magnitude_FFT"],     
    })
  }
  return columns;
}


const GeneratorFFTChartComponent = ({ dataArray, run, animationDuration }) => {

  return (
    <div style={{ textAlign: 'center' }}>
      <Typography sx={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '2px' }}>
          FFT of generator frequency 
      </Typography>
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
          <XAxis dataKey={(dataObj) => dataObj["frequency_FFT (Hz)"]} 
            style={{
                fontSize: '1rem'
            }}
          />
          <YAxis style={{
                fontSize: '1rem'
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontFamily: 'Roboto, sans-serif', fontSize: '16px' }}
            verticalAlign="bottom"
            height={36}
          />
          
          {run && (<div>
              <Line name="magnitude_FFT" type="monotone"
                    dataKey={(dataObj) => dataObj["magnitude_FFT"]} 
                    stroke="#3b82f6" strokeWidth={2} dot={false} animationDuration={animationDuration} />
            
          </div>)}

        </LineChart>

      </ResponsiveContainer>
    </div>
  );
};

export default GeneratorFFTChartComponent;

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-4 bg-slate-900 flex flex-col gap-4 rounded-md">
        
        <p className="text-medium text-lg"> frequency_FFT (Hz): {label}</p>

        <p className="text-sm text-indigo-400">
          magnitude_FFT: <span className="ml-2"> {payload[0].value}</span>
        </p>
        
      </div>
    );
  }
};