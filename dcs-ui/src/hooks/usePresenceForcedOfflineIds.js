import { useMemo } from 'react';
import { computePresenceDeenergization } from '../utils/variableDrivenPresence';

/**
 * Matches embedded spark semantics: prefers downsampled `simulationDataForCanvas` for single-member rows.
 */
export function usePresenceForcedOfflineIds({
  variableDrivenPresence,
  simulationDataForCanvas,
  simulationData,
  ensembleMemberSimulationData,
  simulationTime,
  canvasComponents,
}) {
  return useMemo(() => {
    const { componentIds, connectionIds } = computePresenceDeenergization(variableDrivenPresence, {
      simulationRowsSparkAligned: simulationDataForCanvas,
      simulationData,
      ensembleMemberSimulationData,
      simulationTime,
      canvasComponents,
    });
    return {
      presenceForcedOfflineIds: componentIds,
      presenceForcedOfflineConnectionIds: connectionIds,
    };
  }, [
    variableDrivenPresence,
    simulationDataForCanvas,
    simulationData,
    ensembleMemberSimulationData,
    simulationTime,
    canvasComponents,
  ]);
}
