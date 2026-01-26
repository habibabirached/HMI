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
import { CHART_MIN_HEIGHT, CHART_MIN_WIDTH, COMPARE_COLOR, DATA_SAMPLING_STEP, MAIN_COLOR, TIME_PRECISION, TIME_AXIS_TICKS } from '../../config';

// extract the relevant columns
const filterColumns = (mainDataList, compareDataList) => {
  console.log('CompareDataCenterLoadChartComponent filterColumns called');
  let columns = [];
  let resolution = DATA_SAMPLING_STEP;
  for(let i=0; i< mainDataList.length; i=i+resolution ) {
    if (i<mainDataList.length-1 && i<compareDataList.length-1) {
      let mainData = mainDataList[i];
      let compareData = compareDataList[i];
      columns.push({
        "Time (s)": parseFloat(mainData["Time (s)"]).toFixed(TIME_PRECISION) || 0,
        "main_Data_Center_Load_(kW)": mainData["P_gen (kW)"] || 0,
        "compare_Data_Center_Load_(kW)": compareData["P_gen (kW)"] || 0,        
      });
    }
  }
  return columns;
}


const CompareDataCenterLoadChartComponent = React.memo(({ mainDataArray, compareDataArray, doShowData }) => {

  return (
    <div style={{ textAlign: 'center', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography sx={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '2px' }}>  
        Generator Power Comparison (kW)
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
          <XAxis dataKey={(dataObj) => dataObj["Time (s)"]} 
                type="number"
                domain={[0, 30]}
                ticks={TIME_AXIS_TICKS}
                style={{fontSize: '1rem'}}
          />
          <YAxis tickFormatter={(value) => value.toFixed(0)}
                 style={{fontSize: '1rem'}}/>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontFamily: 'Roboto, sans-serif', fontSize: '16px' }}
            verticalAlign="bottom"
            height={36}
          />
          
          {doShowData === true && (<div>
              <Line name="Without BESS" type="monotone"
                    dataKey={(dataObj) => dataObj["main_Data_Center_Load_(kW)"]} 
                  stroke={MAIN_COLOR} strokeWidth={2} dot={false}  />
              <Line name="With BESS" type="monotone"
                    dataKey={(dataObj) => dataObj["compare_Data_Center_Load_(kW)"]} 
                    stroke={COMPARE_COLOR} strokeWidth={2} dot={false}  />
            
          </div>)}

        </LineChart>

      </ResponsiveContainer>
    </div>
  );
});

export default CompareDataCenterLoadChartComponent;

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload != null && payload.length > 0) {
    return (
      <div className="p-4 bg-slate-900 flex flex-col gap-4 rounded-md">
        
        <p className="text-medium text-lg"> Time (s): {label || ''}</p>

        <p className="text-sm text-indigo-400">
          main_Data_Center_Load_(kW): <span className="ml-2"> {payload[0].value || 0}</span>
        </p>
        <p className="text-sm text-indigo-400">
          compare_Data_Center_Load_(kW): <span className="ml-2"> {payload[1].value || 0}</span>
        </p>
        
      </div>
    );
  }
};