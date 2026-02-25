export interface LogDataPoint {
  epoch: number;
  [key: string]: number | string;
}

export interface ParsedLog {
  args: Record<string, string>;
  data: LogDataPoint[];
  keys: string[];
}

export const parseLogContent = (content: string): ParsedLog => {
  const lines = content.split('\n');
  const dataMap = new Map<number, LogDataPoint>();
  let args: Record<string, string> = {};
  const allKeys = new Set<string>();

  const extractKeyValue = (text: string) => {
    // Matches key=value where value can be number, string, or scientific notation
    const regex = /(\w+)=([-\d.eE]+|[\w]+)/g;
    let match;
    const result: Record<string, number | string> = {};
    
    while ((match = regex.exec(text)) !== null) {
      const key = match[1];
      const valueStr = match[2];
      const numValue = parseFloat(valueStr);
      
      // If it's a valid number and not just a string that looks like a number (unless it is actually a number)
      // The log contains mostly numbers.
      result[key] = isNaN(numValue) ? valueStr : numValue;
      if (key !== 'epoch' && key !== 'step') {
          allKeys.add(key);
      }
    }
    return result;
  };

  lines.forEach((line) => {
    // Parse Args
    if (line.includes('Args: Namespace')) {
      // Basic extraction for Args namespace
      const argsContent = line.substring(line.indexOf('Namespace') + 10, line.lastIndexOf(')'));
      // This part is a bit tricky because args can be comma separated key=value
      // Let's try a simple split
      const argPairs = argsContent.split(', ');
      argPairs.forEach(pair => {
        const [k, v] = pair.split('=');
        if (k && v) {
            args[k.trim()] = v.replace(/'/g, "").trim();
        }
      });
      return;
    }

    // Determine line type
    const isMetric = line.includes('METRIC:');
    const isRoute = line.includes('ROUTE:');
    const isDistr = line.includes('DISTR:');
    
    // Also support the simple "ACC=..." line if it exists separately, though the sample shows it duplicates METRIC usually
    // But we focus on the tagged lines for reliability.

    if (isMetric || isRoute || isDistr) {
      const kv = extractKeyValue(line);
      
      if (kv.epoch !== undefined) {
        const epoch = Number(kv.epoch);
        const existing = dataMap.get(epoch) || { epoch };
        
        dataMap.set(epoch, { ...existing, ...kv });
      }
    }
  });

  // Convert map to array and sort
  const sortedData = Array.from(dataMap.values()).sort((a, b) => a.epoch - b.epoch);

  return {
    args,
    data: sortedData,
    keys: Array.from(allKeys)
  };
};