
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  X, RotateCcw, Save, Activity, Undo, Redo, 
  Wand2, TrendingUp, Sliders, PenTool, MousePointer2
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ReferenceArea, Brush
} from 'recharts';
import { LogDataPoint } from '../utils/logParser';
import { SeededRandom, Easing } from '../utils/math';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newData: LogDataPoint[], keysChanged: string[]) => void;
  initialData: LogDataPoint[];
  metrics: string[];
  title: string;
}

const DataEditorModal: React.FC<Props> = ({ 
  isOpen, onClose, onSave, initialData, metrics, title 
}) => {
  // --- State ---
  const [data, setData] = useState<LogDataPoint[]>([]);
  // History for Undo/Redo
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const [selectedMetric, setSelectedMetric] = useState<string>(metrics[0] || '');
  
  // Range selection (start/end epoch)
  const [rangeStart, setRangeStart] = useState<number | ''>('');
  const [rangeEnd, setRangeEnd] = useState<number | ''>('');

  // Tools State
  const [activeTab, setActiveTab] = useState<'generate' | 'jitter' | 'offset'>('generate');
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Generation Params
  const [genStartVal, setGenStartVal] = useState<number>(0);
  const [genEndVal, setGenEndVal] = useState<number>(1);
  const [genEasing, setGenEasing] = useState<keyof typeof Easing>('Linear');
  
  // Jitter Params
  const [jitterSeed, setJitterSeed] = useState<number>(12345);
  const [jitterAmp, setJitterAmp] = useState<number>(0.05);
  const [jitterCorr, setJitterCorr] = useState<number>(0.0); // 0 = white noise, 0.9 = smooth
  
  // Offset Params
  const [offsetVal, setOffsetVal] = useState<number>(0);

  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Helper to force precision
  const cleanVal = (n: number) => parseFloat(n.toFixed(6));

  // --- Helpers ---
  const getRangeIndices = useCallback(() => {
    if (data.length === 0) return { startIdx: 0, endIdx: 0 };
    if (rangeStart === '' || rangeEnd === '') return { startIdx: 0, endIdx: data.length - 1 };
    
    const startIdx = data.findIndex(d => d.epoch >= rangeStart);
    let endIdx = data.findIndex(d => d.epoch > rangeEnd);
    if (endIdx === -1) endIdx = data.length;
    
    return { 
      startIdx: startIdx === -1 ? 0 : startIdx, 
      endIdx: endIdx === -1 ? data.length - 1 : endIdx - 1
    };
  }, [data, rangeStart, rangeEnd]);

  // --- Initialization ---
  useEffect(() => {
    if (isOpen && initialData.length > 0) {
      const cloned = JSON.parse(JSON.stringify(initialData));
      setData(cloned);
      setHistory([JSON.stringify(cloned)]);
      setHistoryIndex(0);
      
      const defaultMetric = metrics[0] || '';
      setSelectedMetric(defaultMetric);
      setRangeStart(cloned[0].epoch);
      setRangeEnd(cloned[cloned.length - 1].epoch);
    }
  }, [isOpen]); 

  // --- Auto-Sync Generation Values with Range ---
  // Whenever the range or selected metric changes, update the Start/End values for generation
  // to match the current data at those points. This makes interpolation easier.
  useEffect(() => {
    if (data.length === 0) return;
    const { startIdx, endIdx } = getRangeIndices();
    
    const startItem = data[startIdx];
    const endItem = data[endIdx];

    if (startItem) {
        const val = Number(startItem[selectedMetric]);
        if (!isNaN(val)) setGenStartVal(cleanVal(val));
    }
    
    if (endItem) {
        const val = Number(endItem[selectedMetric]);
        if (!isNaN(val)) setGenEndVal(cleanVal(val));
    }
  }, [rangeStart, rangeEnd, selectedMetric, data, getRangeIndices]);

  // --- History Management ---
  const pushHistory = useCallback((newData: LogDataPoint[]) => {
    const newSnap = JSON.stringify(newData);
    setHistory(prev => {
        const sliced = prev.slice(0, historyIndex + 1);
        sliced.push(newSnap);
        if (sliced.length > 20) sliced.shift();
        return sliced;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 19));
    setData(newData);
  }, [historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setData(JSON.parse(history[newIndex]));
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setData(JSON.parse(history[newIndex]));
    }
  };

  // Calculate Y-Domain for the chart
  const yDomain = useMemo(() => {
      const vals = data.map(d => Number(d[selectedMetric])).filter(v => !isNaN(v));
      if (vals.length === 0) return [0, 1];
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const span = max - min;
      // Add slight padding to prevent cutting off dots
      const padding = span === 0 ? 0.1 : span * 0.1;
      return [cleanVal(min - padding), cleanVal(max + padding)];
  }, [data, selectedMetric]);

  const getMetricStats = useMemo(() => {
    const values = data.map(d => Number(d[selectedMetric])).filter(v => !isNaN(v));
    if (values.length === 0) return { mean: 0, std: 0, min: 0, max: 0 };
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return {
      mean,
      std: Math.sqrt(variance),
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }, [data, selectedMetric]);

  // --- Operations ---
  const applyGeneration = () => {
    const { startIdx, endIdx } = getRangeIndices();
    const newData = [...data];
    const totalSteps = endIdx - startIdx;
    if (totalSteps <= 0) return;

    for (let i = 0; i <= totalSteps; i++) {
      const t = i / totalSteps;
      const easedT = Easing[genEasing](t);
      const val = genStartVal + (genEndVal - genStartVal) * easedT;
      newData[startIdx + i] = { 
        ...newData[startIdx + i], 
        [selectedMetric]: cleanVal(val) 
      };
    }
    pushHistory(newData);
  };

  const applyJitter = () => {
    const { startIdx, endIdx } = getRangeIndices();
    const newData = [...data];
    const rng = new SeededRandom(jitterSeed);
    let prevNoise = 0;

    for (let i = startIdx; i <= endIdx; i++) {
      const original = Number(newData[i][selectedMetric]) || 0;
      
      const whiteNoise = rng.nextGaussian(0, 1);
      const noise = jitterCorr * prevNoise + (1 - jitterCorr) * whiteNoise;
      prevNoise = noise;

      // Scale by amplitude and clean precision
      const val = original + noise * jitterAmp;
      
      newData[i] = { 
        ...newData[i], 
        [selectedMetric]: cleanVal(val) 
      };
    }
    pushHistory(newData);
  };

  const applyOffset = () => {
    const { startIdx, endIdx } = getRangeIndices();
    const newData = [...data];
    for (let i = startIdx; i <= endIdx; i++) {
      const original = Number(newData[i][selectedMetric]) || 0;
      newData[i] = { 
        ...newData[i], 
        [selectedMetric]: cleanVal(original + offsetVal)
      };
    }
    pushHistory(newData);
  };

  // --- Interaction (Drawing & Clicking) ---
  const handleChartMouseDown = (e: any) => {
      if (!isDrawMode) return;
      if (e) {
          setIsDragging(true);
          updateValueFromMouse(e);
      }
  };

  const handleChartMouseMove = (e: any) => {
      if (!isDrawMode || !isDragging) return;
      if (e) {
          updateValueFromMouse(e);
      }
  };

  const handleChartMouseUp = () => {
      if (isDragging) {
          setIsDragging(false);
          pushHistory(data);
      }
  };

  const handleChartClick = (e: any) => {
      // If Draw Mode is OFF, clicking a point sets the Start Value for generation
      // This is a quick way to pick a reference value.
      if (!isDrawMode && e && e.activePayload && e.activePayload.length > 0) {
          const payload = e.activePayload[0].payload;
          const val = Number(payload[selectedMetric]);
          if (!isNaN(val)) {
              setGenStartVal(cleanVal(val));
          }
      }
  };

  const updateValueFromMouse = (e: any) => {
      if (!e || e.activeLabel === undefined) return;
      if (!chartContainerRef.current) return;

      const epoch = e.activeLabel;
      const idx = data.findIndex(d => d.epoch === epoch);
      if (idx === -1) return;

      // Chart Margins defined in LineChart component
      const margin = { top: 5, bottom: 5 }; 
      
      // Calculate dynamic height
      const { height } = chartContainerRef.current.getBoundingClientRect();
      const chartAreaHeight = height - margin.top - margin.bottom;
      
      // Get Y coordinate (chartY is usually relative to the container)
      // Recharts events sometimes provide `chartY`, sometimes `activeCoordinate.y`
      const pixelY = e.chartY ?? e.activeCoordinate?.y;
      
      if (pixelY === undefined) return;

      const [min, max] = yDomain;
      const domainRange = max - min;
      
      // Normalize Y (0 at top of chart area, 1 at bottom)
      // Ensure we subtract top margin
      let normalizedY = (pixelY - margin.top) / chartAreaHeight;
      normalizedY = Math.max(0, Math.min(1, normalizedY)); 
      
      // Recharts Y Axis is inverted (max at top/0)
      const newValue = max - (normalizedY * domainRange);
      
      const newData = [...data];
      newData[idx] = { ...newData[idx], [selectedMetric]: cleanVal(newValue) };
      setData(newData);
  };

  const handleBrushChange = useCallback((range: any) => {
    if (!range || range.startIndex === undefined || range.endIndex === undefined) return;
    if (data.length === 0) return;

    const startItem = data[range.startIndex];
    const endItem = data[range.endIndex];

    if (startItem && endItem) {
        setRangeStart(prev => (prev !== startItem.epoch ? startItem.epoch : prev));
        setRangeEnd(prev => (prev !== endItem.epoch ? endItem.epoch : prev));
    }
  }, [data]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
         onMouseUp={handleChartMouseUp}
    >
      <div className="bg-white w-[95vw] h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-600" />
              Data Editor: <span className="text-blue-600">{title}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">Modify curve data and export back to log.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-200 rounded-lg p-1 mr-4">
              <button onClick={undo} disabled={historyIndex <= 0} className="p-2 hover:bg-white rounded disabled:opacity-30 transition-colors" title="Undo">
                <Undo className="w-4 h-4 text-slate-700" />
              </button>
              <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 hover:bg-white rounded disabled:opacity-30 transition-colors" title="Redo">
                <Redo className="w-4 h-4 text-slate-700" />
              </button>
            </div>
            
            <button 
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => onSave(data, metrics)}
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium shadow-md flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              Save & Apply
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex min-h-0">
          
          {/* Left: Chart Visualization */}
          <div className="flex-1 p-4 bg-slate-100/50 flex flex-col min-w-0">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex-1 min-h-0 flex flex-col relative">
              <div className="flex justify-between items-center mb-2">
                 <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-slate-700 uppercase">Preview</h3>
                    <button 
                        onClick={() => setIsDrawMode(!isDrawMode)}
                        className={`flex items-center gap-2 px-3 py-1 text-xs font-bold rounded-full border transition-colors ${isDrawMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                    >
                        {isDrawMode ? <PenTool className="w-3 h-3" /> : <MousePointer2 className="w-3 h-3" />}
                        {isDrawMode ? 'Draw Mode ON' : 'Draw Mode OFF'}
                    </button>
                 </div>
                 <div className="flex gap-4 text-xs font-mono text-slate-500">
                    <span>Mean: {getMetricStats.mean.toFixed(4)}</span>
                    <span>Std: {getMetricStats.std.toFixed(4)}</span>
                    <span>Range: [{getMetricStats.min.toFixed(4)}, {getMetricStats.max.toFixed(4)}]</span>
                 </div>
              </div>
              <div ref={chartContainerRef} className="flex-1 w-full min-h-0 relative select-none">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={data} 
                    onMouseDown={handleChartMouseDown}
                    onMouseMove={handleChartMouseMove}
                    onMouseUp={handleChartMouseUp}
                    onClick={handleChartClick}
                    margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                        dataKey="epoch" 
                        tick={{fontSize: 10}} 
                        allowDataOverflow 
                    />
                    <YAxis 
                        domain={yDomain} 
                        tick={{fontSize: 10}} 
                        allowDataOverflow
                        tickFormatter={(val) => Number(val).toFixed(3)}
                        width={40}
                    />
                    {!isDrawMode && <Tooltip contentStyle={{fontSize: '12px'}} formatter={(val: number) => val.toFixed(6)} />}
                    
                    {/* Render all lines, but highlight selected */}
                    {metrics.map((m, idx) => (
                      <Line 
                        key={m} 
                        type="monotone" 
                        dataKey={m} 
                        stroke={m === selectedMetric ? "#2563eb" : "#cbd5e1"} 
                        strokeWidth={m === selectedMetric ? 2.5 : 1}
                        dot={m === selectedMetric && isDrawMode ? { r: 4, strokeWidth: 0, fill: '#2563eb' } : false}
                        connectNulls
                        isAnimationActive={false}
                      />
                    ))}

                    {/* Reference Area for Range */}
                    {(rangeStart !== '' && rangeEnd !== '') && (
                      <ReferenceArea 
                        x1={rangeStart} 
                        x2={rangeEnd} 
                        fill="#2563eb" 
                        fillOpacity={0.05} 
                        ifOverflow="extendDomain"
                      />
                    )}
                    
                    <Brush 
                        dataKey="epoch" 
                        height={30} 
                        stroke="#94a3b8"
                        onChange={handleBrushChange}
                        startIndex={getRangeIndices().startIdx}
                        endIndex={getRangeIndices().endIdx}
                    />
                  </LineChart>
                </ResponsiveContainer>
                {isDrawMode && (
                    <div className="absolute top-2 right-2 bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded opacity-80 pointer-events-none">
                        Click & Drag to Draw
                    </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="w-80 bg-white border-l border-slate-200 p-6 overflow-y-auto flex-none z-10 shadow-lg">
            
            {/* 1. Select Metric */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Target Metric</label>
              <select 
                value={selectedMetric} 
                onChange={e => setSelectedMetric(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {metrics.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* 2. Range Select */}
            <div className="mb-6 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Epoch Range</label>
              <div className="flex gap-2 items-center">
                 <input 
                    type="number" 
                    value={rangeStart} 
                    onChange={e => setRangeStart(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded text-sm"
                    placeholder="Start"
                 />
                 <span className="text-slate-400">-</span>
                 <input 
                    type="number" 
                    value={rangeEnd} 
                    onChange={e => setRangeEnd(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded text-sm"
                    placeholder="End"
                 />
              </div>
              <button 
                onClick={() => { setRangeStart(data[0].epoch); setRangeEnd(data[data.length-1].epoch); }}
                className="text-xs text-blue-600 font-medium mt-2 hover:underline"
              >
                Select All
              </button>
            </div>

            {/* 3. Tools Tabs */}
            <div className="flex border-b border-slate-200 mb-4">
               {['generate', 'jitter', 'offset'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`flex-1 py-2 text-xs font-bold uppercase border-b-2 transition-colors ${
                        activeTab === tab 
                        ? 'border-blue-600 text-blue-600' 
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {tab}
                  </button>
               ))}
            </div>

            {/* Tool Content */}
            <div className="space-y-4">
                
                {activeTab === 'generate' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="flex gap-2">
                             <div className="flex-1">
                                <label className="text-xs text-slate-500">Start Value</label>
                                <input type="number" step="0.01" value={genStartVal} onChange={e => setGenStartVal(parseFloat(e.target.value))} className="w-full p-2 border rounded" />
                             </div>
                             <div className="flex-1">
                                <label className="text-xs text-slate-500">End Value</label>
                                <input type="number" step="0.01" value={genEndVal} onChange={e => setGenEndVal(parseFloat(e.target.value))} className="w-full p-2 border rounded" />
                             </div>
                        </div>
                        <div>
                             <label className="text-xs text-slate-500">Easing Function</label>
                             <select value={genEasing} onChange={e => setGenEasing(e.target.value as any)} className="w-full p-2 border rounded bg-white">
                                {Object.keys(Easing).map(k => <option key={k} value={k}>{k}</option>)}
                             </select>
                        </div>
                        <button onClick={applyGeneration} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex justify-center items-center gap-2">
                            <TrendingUp className="w-4 h-4" /> Apply Generation
                        </button>
                    </div>
                )}

                {activeTab === 'jitter' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                         <div>
                            <label className="text-xs text-slate-500 flex justify-between">
                                Amplitude (Std Dev) <span>{jitterAmp}</span>
                            </label>
                            <input type="range" min="0" max="1" step="0.001" value={jitterAmp} onChange={e => setJitterAmp(parseFloat(e.target.value))} className="w-full accent-indigo-600" />
                         </div>
                         <div>
                            <label className="text-xs text-slate-500 flex justify-between">
                                Smoothness (Correlation) <span>{jitterCorr}</span>
                            </label>
                            <input type="range" min="0" max="0.99" step="0.01" value={jitterCorr} onChange={e => setJitterCorr(parseFloat(e.target.value))} className="w-full accent-indigo-600" />
                         </div>
                         <div>
                            <label className="text-xs text-slate-500">Seed (Integer)</label>
                            <div className="flex gap-2">
                                <input type="number" value={jitterSeed} onChange={e => setJitterSeed(parseInt(e.target.value))} className="w-full p-2 border rounded" />
                                <button onClick={() => setJitterSeed(Math.floor(Math.random() * 99999))} className="p-2 border rounded hover:bg-slate-50"><RotateCcw className="w-4 h-4"/></button>
                            </div>
                         </div>
                         <button onClick={applyJitter} className="w-full py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 flex justify-center items-center gap-2">
                            <Activity className="w-4 h-4" /> Apply Noise
                         </button>
                    </div>
                )}

                {activeTab === 'offset' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div>
                            <label className="text-xs text-slate-500">Add/Subtract Value</label>
                            <input type="number" step="0.01" value={offsetVal} onChange={e => setOffsetVal(parseFloat(e.target.value))} className="w-full p-2 border rounded" />
                        </div>
                        <button onClick={applyOffset} className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex justify-center items-center gap-2">
                             <Wand2 className="w-4 h-4" /> Apply Offset
                        </button>
                    </div>
                )}
            </div>
            
            {/* Reset */}
            <div className="mt-8 pt-6 border-t border-slate-200">
                <button 
                    onClick={() => {
                        const original = JSON.parse(JSON.stringify(initialData));
                        pushHistory(original);
                    }}
                    className="w-full py-2 text-red-600 border border-red-200 bg-red-50 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                >
                    Reset All Changes
                </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default DataEditorModal;
