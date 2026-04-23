import React, { useSyncExternalStore } from 'react';
import {
  subscribeSimulationFetchActivity,
  getSimulationFetchActivitySnapshot,
  getServerSnapshot,
  formatSimulationFetchActivityLine,
} from '../../utils/simulationFetchActivity';
import './SimulationFetchStatusBar.css';

export default function SimulationFetchStatusBar() {
  const activities = useSyncExternalStore(
    subscribeSimulationFetchActivity,
    getSimulationFetchActivitySnapshot,
    getServerSnapshot,
  );

  if (!activities.length) return null;

  const last = activities[activities.length - 1];
  const more = activities.length - 1;
  const line = formatSimulationFetchActivityLine(last);
  const suffix = more > 0 ? `  (+${more} more in flight)` : '';

  return (
    <div className="simulation-fetch-status-bar" role="status" aria-live="polite">
      <div className="simulation-fetch-status-bar__track" aria-hidden>
        <div className="simulation-fetch-status-bar__shuttle" />
      </div>
      <div className="simulation-fetch-status-bar__text" title={`${line}${suffix}`}>
        <span className="simulation-fetch-status-bar__label">Loading simulation data</span>
        <span className="simulation-fetch-status-bar__detail">
          {line}
          {suffix}
        </span>
      </div>
    </div>
  );
}
