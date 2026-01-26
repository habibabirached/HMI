import React, { useState, useEffect } from "react";
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
import { DATA_SAMPLING_STEP, TIME_PRECISION, TIME_AXIS_TICKS } from '../../config';
import { csv2JSON } from "../../utils";

// extract the relevant columns
const filterColumns = (dataArray) => {
  let columns = [];
  let resolution = DATA_SAMPLING_STEP;
  for(let i=0; i< dataArray.length; i=i+resolution ) {
    let data = dataArray[i];
    columns.push({
      "Time (s)": parseFloat(data["Time (s)"]).toFixed(TIME_PRECISION),
      "Data Center Load (kW)": data["Data Center Load (kW)"],
    })
  }
  return columns;
}

const StaticDataCenterLoadChartComponent = React.memo(({ config, lineColor }) => {
  const [dataArray, setDataArray] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      let filePath = '';
      if (config.toLowerCase().includes('hd') && config.toLowerCase().includes('bess')) {
        filePath = '/HD_BESS.Jan8.csv';
      } else if (config.toLowerCase().includes('hd')) {
        filePath = '/HD_noBESS.Jan8.csv';
      } else if (config.toLowerCase().includes('aero') && config.toLowerCase().includes('bess')) {
        filePath = '/Aero_BESS.Jan8.csv';
      } else if (config.toLowerCase().includes('aero')) {
        filePath = '/Aero_noBESS.Jan8.csv';
      } else {
        filePath = '/HD_BESS.Jan8.csv';
      }

      try {
        const response = await fetch(filePath);
        const csvText = await response.text();
        const jsonData = await csv2JSON(csvText);
        setDataArray(jsonData);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    if (config) {
      loadData();
    }
  }, [config]);

  return (
    <div style={{ textAlign: 'center', width: '100%', height: '250px' }}>
      <Typography sx={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '4px' }}> 
        Data Center Load (kW) 
      </Typography>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart
          width="100%"
          height="100%"
          data={filterColumns(dataArray)}
          margin={{
            top: 5,
            right: 10,
            left: 0,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={(dataObj) => dataObj["Time (s)"]} 
            type="number"
            domain={[0, 30]}
            ticks={TIME_AXIS_TICKS}
            style={{
                fontSize: '0.75rem'
            }}
          />
          <YAxis 
            domain={[0, 1600]}
            tickFormatter={(value) => value.toFixed(0)}
            style={{
                fontSize: '0.75rem'
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px' }}
            verticalAlign="bottom"
            height={24}
          />
          
          <Line 
            name="Data Center Load (kW)" 
            type="monotone"
            dataKey={(dataObj) => dataObj["Data Center Load (kW)"]} 
            stroke={lineColor || '#5FB7FF'} 
            strokeWidth={2} 
            dot={false}
          />

        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

export default StaticDataCenterLoadChartComponent;

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-4 bg-slate-900 flex flex-col gap-4 rounded-md">
        
        <p className="text-medium text-lg"> Time (s): {label}</p>

        <p className="text-sm text-indigo-400">
          Data Center Load (kW):
          <span className="ml-2"> {payload[0].value}</span>
        </p>
        
      </div>
    );
  }
};

