
import { LogDataPoint } from './logParser';
import { formatToMatch } from './math';

export interface ExportResult {
  newContent: string;
  modifiedEpochs: number[];
  modifiedKeys: string[];
}

/**
 * Updates the original log content with modified data points.
 * Preserves formatting, spaces, and line structure.
 * Also recalculates and updates the footer summary stats.
 */
export const updateLogContent = (
  originalContent: string,
  modifiedData: LogDataPoint[],
  modifiedKeys: string[]
): ExportResult => {
  let lines = originalContent.split('\n');
  const modifiedEpochs: number[] = [];
  const validKeys = new Set(modifiedKeys);

  // Create a quick lookup for modified data by epoch
  const dataMap = new Map<number, LogDataPoint>();
  modifiedData.forEach(d => dataMap.set(d.epoch, d));

  // Regex to find METRIC lines and capture epoch
  const metricLineRegex = /METRIC:.*epoch=(\d+)/;
  
  // Robust number matching regex: 
  // Supports: 123, -123, 123.456, .456, 1.23e-4, -1.23E+4
  const numberRegexStr = '[-+]?(?:\\d*\\.?\\d+|\\d+\\.?\\d*)(?:[eE][-+]?\\d+)?';
  const keyValRegex = new RegExp(`(\\w+)=(${numberRegexStr})`, 'g');

  // Helper to replace key=value in a line
  const replaceValuesInLine = (line: string, sourceData: Record<string, any>): string => {
    // We use a callback replace to safely handle all occurrences
    return line.replace(keyValRegex, (match, key, oldValueStr) => {
      // Check if we have a new value for this key
      const newValue = sourceData[key];
      
      // We only replace if newValue is defined and is a valid number
      if (newValue !== undefined && newValue !== null && !isNaN(Number(newValue))) {
        const formattedValue = formatToMatch(Number(newValue), oldValueStr);
        return `${key}=${formattedValue}`;
      }
      
      // If no new value, return original match
      return match;
    });
  };

  // 1. Update per-epoch lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Identify if this is a METRIC line
    const match = line.match(metricLineRegex);
    if (match) {
      const epoch = parseInt(match[1], 10);
      const epochData = dataMap.get(epoch);

      // If we have modified data for this epoch
      if (epochData) {
        modifiedEpochs.push(epoch);

        // Update the METRIC line
        lines[i] = replaceValuesInLine(line, epochData);

        // Look Back: Check if previous line is a Summary line (timestamp + metrics, no tag)
        if (i > 0) {
          const prevLine = lines[i - 1];
          const isSummaryLine = !prevLine.includes('METRIC:') && 
                                !prevLine.includes('ROUTE:') && 
                                !prevLine.includes('DISTR:') &&
                                prevLine.includes('='); // Heuristic
          
          if (isSummaryLine) {
            lines[i - 1] = replaceValuesInLine(prevLine, epochData);
          }
        }
      }
    }
  }

  // 2. Update Footer Stats (Average, Final, Best)
  
  // Calculate Stats for ALL numeric metrics present in the data
  // Filter out non-numeric keys like 'epoch', 'step', or any potential string args
  const firstPoint = modifiedData[0] || {};
  const allMetrics = Object.keys(firstPoint).filter(k => 
      k !== 'epoch' && k !== 'step' && typeof firstPoint[k] === 'number'
  );
  
  const averages: Record<string, number> = {};
  if (modifiedData.length > 0) {
      allMetrics.forEach(m => {
          const sum = modifiedData.reduce((acc, d) => acc + (Number(d[m]) || 0), 0);
          averages[m] = sum / modifiedData.length;
      });
  }

  const lastEpoch = modifiedData[modifiedData.length - 1];
  
  // Find Best Epoch. Heuristic: Maximize ACC/NMI/ARI/F1/PUR, Minimize L_*
  // Default to ACC if present, otherwise first key.
  const targetMetric = allMetrics.find(m => ['ACC', 'NMI', 'F1', 'ARI', 'PUR'].includes(m)) || allMetrics[0];
  const isLoss = targetMetric && targetMetric.startsWith('L_');
  
  let bestEpoch = modifiedData[0];
  let bestVal = bestEpoch ? Number(bestEpoch[targetMetric]) : -Infinity;
  if (isLoss) bestVal = Infinity;

  modifiedData.forEach(d => {
      const val = Number(d[targetMetric]);
      if (isLoss ? val < bestVal : val > bestVal) {
          bestVal = val;
          bestEpoch = d;
      }
  });

  // Iterate lines again to find footer sections
  // We use strict string includes to find the headers
  for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 1. Average
      if (line.includes('Average over all epochs::')) {
          if (i + 1 < lines.length) {
              lines[i+1] = replaceValuesInLine(lines[i+1], averages);
          }
      }
      
      // 2. Final Evaluation
      if (line.includes('Final Evaluation (Last Epoch):')) {
          if (i + 1 < lines.length && lastEpoch) {
              lines[i+1] = replaceValuesInLine(lines[i+1], lastEpoch);
          }
      }
      
      // 3. Best Evaluation
      if (line.includes('Best Evaluation (Epoch') && bestEpoch) {
          // Update the header line itself to reflect new best epoch number
          lines[i] = line.replace(/Epoch \d+/, `Epoch ${bestEpoch.epoch}`);
          // Update the metrics line below it
          if (i + 1 < lines.length) {
              lines[i+1] = replaceValuesInLine(lines[i+1], bestEpoch);
          }
      }
  }

  return {
    newContent: lines.join('\n'),
    modifiedEpochs: [...new Set(modifiedEpochs)],
    modifiedKeys: Array.from(validKeys)
  };
};
