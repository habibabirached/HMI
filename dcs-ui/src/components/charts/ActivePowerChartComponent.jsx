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
  Typography
} from "@mui/material";

import { CHART_MIN_HEIGHT, CHART_MIN_WIDTH, DATA_SAMPLING_STEP, TIME_PRECISION, TIME_AXIS_TICKS } from '../../config';


// extract the relevant columns
const filterColumns = (dataArray) => {
  let columns = [];
  let resolution = DATA_SAMPLING_STEP;
  for(let i=0; i< dataArray.length; i=i+resolution ) {
    let data = dataArray[i];
    columns.push({
      "Time (s)": parseFloat(data["Time (s)"]).toFixed(TIME_PRECISION),
      "Data Center Load (kW)":data["Data Center Load (kW)"],
      "P_gen (kW)": data["P_gen (kW)"],
      "Q_gen (kW)": data["Q_gen (kW)"],
    })
  }
  return columns;
}


const ActivePowerChartComponent = ({ dataArray, run, animationDuration }) => {

  return (
    <div style={{ textAlign: 'center' }}>
      <Typography sx={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '2px' }}> Active Power (kW) </Typography>
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
          <YAxis tickFormatter={(value) => value.toFixed(0)}
                 style={{
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
              <Line name="Data Center Load (kW)" type="monotone"
                    dataKey={(dataObj) => dataObj["Data Center Load (kW)"]} 
                    stroke="#3b82f6" strokeWidth={2} dot={false} animationDuration={animationDuration} />
              <Line name="P_gen (kW)" type="monotone"
                    dataKey={(dataObj) => dataObj["P_gen (kW)"]}  
                    stroke="#8b5cf6" strokeWidth={2} dot={false} animationDuration={animationDuration} />
              <Line name="Q_gen (kW)" type="monotone"  
                    dataKey={(dataObj) => dataObj["Q_gen (kW)"]}  
                    stroke="#5cf6d2ff" strokeWidth={2} dot={false} animationDuration={animationDuration} />
          </div>)}

        </LineChart>

      </ResponsiveContainer>
    </div>
  );
};

export default ActivePowerChartComponent;

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-4 bg-slate-900 flex flex-col gap-4 rounded-md">
        
        <p className="text-medium text-lg"> Time (s): {label}</p>

        <p className="text-sm text-indigo-400">
          Data Center Load (kW):
          <span className="ml-2"> {payload[0].value}</span>
        </p>
        
        <p className="text-sm text-indigo-400">
          P_gen (kW):
          <span className="ml-2"> {payload[1].value}</span>
        </p>

        <p className="text-sm text-indigo-400">
          Q_gen (kW):
          <span className="ml-2"> {payload[2].value}</span>
        </p>
      </div>
    );
  }
};