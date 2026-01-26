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
import { CHART_MIN_HEIGHT, CHART_MIN_WIDTH, COMPARE_COLOR, DATA_SAMPLING_STEP, MAIN_COLOR, MECHANICAL_TORQUE_THRESHOLD, THRESHOLD_COLOR, TIME_PRECISION, TIME_AXIS_TICKS } from '../../config';

// extract the relevant columns
const filterColumns = (mainDataList, compareDataList) => {
  console.log('CompareMechanicalTorqueChartComponent filterColumns called');
  let columns = [];
  let resolution = DATA_SAMPLING_STEP;
  for(let i=0; i< mainDataList.length; i=i+resolution ) {
    if (i<mainDataList.length-1 && i<compareDataList.length-1) {
      let mainData = mainDataList[i];
      let compareData = compareDataList[i];
      columns.push({
        "Time (s)": parseFloat(mainData["Time (s)"]).toFixed(TIME_PRECISION) || 0,
        "main_T_mech_(p.u.)": parseFloat(mainData["MOD Torque (p.u.)"]).toFixed(3) || 0, //mainData["T_mech (p.u.)"],
        "compare_T_mech_(p.u.)": parseFloat(compareData["MOD Torque (p.u.)"]).toFixed(3) || 0, //compareData["T_mech (p.u.)"],
        "threshold": MECHANICAL_TORQUE_THRESHOLD,
      });
    }
  }
  return columns;
}


const CompareMechanicalTorqueChartComponent = React.memo(({ 
  mainDataArray, 
  compareDataArray, 
  doShowData }) => {

  return (
    <div style={{ textAlign: 'center', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography sx={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '2px' }}>
        Mechanical Torque Comparison (p.u.)
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
                 style={{fontSize: '1rem'}}/>
          <YAxis domain={[0.95, 1.12]} 
                 ticks={[0.95, 0.98, 1.01, 1.04, 1.07, 1.10, 1.12]}
                 tickFormatter={(value) => value.toFixed(2)}
                 style={{fontSize: '1rem'}} />

          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontFamily: 'Roboto, sans-serif', fontSize: '16px' }}
            verticalAlign="bottom"
            height={36}
          />

          {doShowData && (<div>
              <Line name="Without BESS " type="monotone"
                    dataKey={(dataObj) => dataObj["main_T_mech_(p.u.)"]}
                    stroke={MAIN_COLOR} strokeWidth={2} dot={false}  />
              <Line name="With BESS" type="monotone"
                  dataKey={(dataObj) => dataObj["compare_T_mech_(p.u.)"]}
                  stroke={COMPARE_COLOR} strokeWidth={2} dot={false}  />
              <Line name="threshold" type="monotone"
                  dataKey={(dataObj) => dataObj["threshold"]}
                  stroke={THRESHOLD_COLOR} strokeWidth={1} dot={false}  />

          </div>)}

        </LineChart>

      </ResponsiveContainer>
    </div>
  );
});

export default CompareMechanicalTorqueChartComponent;

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload != null && payload.length > 0) {
    return (
      <div className="p-4 bg-slate-900 flex flex-col gap-4 rounded-md">

        <p className="text-medium text-lg"> Time (s): {label || ''}</p>

        <p className="text-sm text-indigo-400">
          main_T_mech_(p.u.): <span className="ml-2"> {payload[0].value || 0}</span>
        </p>
        <p className="text-sm text-indigo-400">
          compare_T_mech_(p.u.): <span className="ml-2"> {payload[1].value || 0}</span>
        </p>
        <p className="text-sm text-indigo-400">
          threashold: <span className="ml-2"> {payload[2].value || 0}</span>
        </p>

      </div>
    );
  }
};
