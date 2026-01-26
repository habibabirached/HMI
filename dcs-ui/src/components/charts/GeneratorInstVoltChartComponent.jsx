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
} from '@mui/material';
import {  CHART_MIN_HEIGHT, CHART_MIN_WIDTH, DATA_SAMPLING_STEP, TIME_PRECISION, TIME_AXIS_TICKS } from '../../config';

// extract the relevant columns
const filterColumns = (dataArray) => {
  let columns = [];
  let resolution = DATA_SAMPLING_STEP;
  for(let i=0; i< dataArray.length; i=i+resolution ) {
    let data = dataArray[i];
    columns.push({
      "Time (s)": parseFloat(data["Time (s)"]).toFixed(TIME_PRECISION),
      "Va_gen (kV)":data["Va_gen (kV)"],
      "Vb_gen (kV)": data["Vb_gen (kV)"],
      "Vc_gen (kV)": data["Vc_gen (kV)"],
    })
  }
  return columns;
}


const GeneratorInstVoltChartComponent = ({ dataArray, run, animationDuration }) => {

  return (
    <div style={{ textAlign: 'center' }}>
      <Typography sx={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '2px' }}> Inst. Volt. Generator (kV) </Typography>
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
          <YAxis tickFormatter={(value) => value.toFixed(1)}
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
              <Line name="Va_gen (kV)" type="monotone"
                    dataKey={(dataObj) => dataObj["Va_gen (kV)"]} 
                    stroke="#3b82f6" strokeWidth={2} dot={false} animationDuration={animationDuration} />
              <Line name="Vb_gen (kV)" type="monotone"
                    dataKey={(dataObj) => dataObj["Vb_gen (kV)"]}  
                    stroke="#8b5cf6" strokeWidth={2} dot={false} animationDuration={animationDuration} />
              <Line name="Vc_gen (kV)" type="monotone"  
                    dataKey={(dataObj) => dataObj["Vc_gen (kV)"]}  
                    stroke="#5cf6d2ff" strokeWidth={2} dot={false} animationDuration={animationDuration} />
          </div>)}

        </LineChart>

      </ResponsiveContainer>
    </div>
  );
};

export default GeneratorInstVoltChartComponent;

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-4 bg-slate-900 flex flex-col gap-4 rounded-md">
        
        <p className="text-medium text-lg"> Time (s): {label}</p>

        <p className="text-sm text-indigo-400">
          Va_gen (kV):
          <span className="ml-2"> {payload[0].value}</span>
        </p>
        
        <p className="text-sm text-indigo-400">
          Vb_gen (kV):
          <span className="ml-2"> {payload[1].value}</span>
        </p>

        <p className="text-sm text-indigo-400">
          Vc_gen (kV):
          <span className="ml-2"> {payload[2].value}</span>
        </p>
      </div>
    );
  }
};