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
import { CHART_MIN_HEIGHT, CHART_MIN_WIDTH, COMPARE_COLOR, DATA_SAMPLING_STEP, MAIN_COLOR, TIME_PRECISION } from '../../config';

// extract the relevant columns
const filterColumns = (mainDataList, compareDataList) => {
  console.log('CompareGeneratorFFTComponent filterColumns called');
  let columns = [];
  let resolution = 1;
  let minFreq = 2;
  let maxFreq = 60;
  for(let i=2; i< mainDataList.length; i= i + resolution ) {
    if (i < mainDataList.length - 1 && i < compareDataList.length - 1 && 
        mainDataList[i]["frequency_FFT (Hz)"] >= minFreq && 
        mainDataList[i]["frequency_FFT (Hz)"] <= maxFreq )  { 
      let mainData = mainDataList[i];
      let compareData = compareDataList[i];
      columns.push({
        "frequency_FFT (Hz)": mainData["frequency_FFT (Hz)"].toFixed(TIME_PRECISION) || 0,
        "main_magnitude_FFT": mainData["magnitude_FFT - torque"] || 0,
        "compare_magnitude_FFT": compareData["magnitude_FFT - torque"] || 0,
      });
    }
  }
  return columns;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload != null && payload.length > 0) {
    return (
      <div className="p-4 bg-slate-900 flex flex-col gap-4 rounded-md">

        <p className="text-medium text-lg"> frequency_FFT (Hz): {label || ''}</p>

        <p className="text-sm text-indigo-400">
          main_magnitude_FFT: <span className="ml-2"> {payload[0].value || 0}</span>
        </p>
        <p className="text-sm text-indigo-400">
          compare_magnitude_FFT: <span className="ml-2"> {payload[1].value || 0}</span>
        </p>

      </div>
    );
  }
};

const CompareGeneratorFFTChartComponent = React.memo(({ mainDataArray, compareDataArray, doShowData }) => {

  return (
    <div style={{ textAlign: 'center', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography sx={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '2px' }}>
        FFT Of Mechanical Torque
      </Typography>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          width={"100%"}
          height={"100%"}
          responsive
          data={filterColumns(mainDataArray, compareDataArray)}
          margin={{
            right: 30,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={(dataObj) => dataObj["frequency_FFT (Hz)"]}
                 scale="log"
                 domain={[2, 60]}
                 ticks={[2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 40, 50, 60]}
                 tickFormatter={(value) => {
                   if (typeof value !== 'number') return value;
                   return value.toFixed(0);
                 }}
                 style={{ fontSize: '1rem'}}
                 label={{
                   content: ({ viewBox }) => {
                     const { x, y, width, height } = viewBox;
                     return (
                       <text 
                         x={x + width - 10} 
                         y={y + height +10} 
                         fill="#999999" 
                         fontSize="1rem"
                         textAnchor="end"
                       >
                         Frequency (Hz)
                       </text>
                     );
                   }
                 }}
          />
          <YAxis domain={[0, 'auto']}
                 tickFormatter={(value) => typeof value === 'number' ? value.toFixed(0) : value}
                 style={{ fontSize: '1rem'}}
                 label={{ 
                   value: 'Amplitude', 
                   angle: -90, 
                   position: 'insideLeft',
                   offset: 10,
                   style: { fontSize: '1rem', fill: '#999999', textAnchor: 'middle' } 
                 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontFamily: 'Roboto, sans-serif', fontSize: '16px' }}
            verticalAlign="bottom"
            height={36}
          />

          {doShowData && (<div>
              <Line name="Without BESS" type="monotone"
                    dataKey={(dataObj) => dataObj["main_magnitude_FFT"]}
                    stroke={MAIN_COLOR} strokeWidth={2} dot={false}  />

              <Line name="With BESS" type="monotone"
                  dataKey={(dataObj) => dataObj["compare_magnitude_FFT"]}
                  stroke={COMPARE_COLOR} strokeWidth={2} dot={false}  />

          </div>)}

        </LineChart>

      </ResponsiveContainer>
    </div>
  );
});

export default CompareGeneratorFFTChartComponent;
