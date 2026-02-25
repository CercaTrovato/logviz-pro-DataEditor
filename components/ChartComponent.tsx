
import React, { forwardRef } from 'react';
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
import { LogDataPoint } from '../utils/logParser';
import { Edit2 } from 'lucide-react';

interface Props {
  data: LogDataPoint[];
  metrics: string[];
  colors?: string[];
  title: string;
  description?: string;
  syncId?: string;
  onEdit?: () => void;
}

const DEFAULT_COLORS = [
  "#2563eb", "#16a34a", "#dc2626", "#d97706", "#9333ea", 
  "#0891b2", "#be123c", "#4f46e5", "#1e293b", "#059669"
];

const ChartComponent = forwardRef<HTMLDivElement, Props>(({ data, metrics, colors, title, description, syncId, onEdit }, ref) => {
  // Filter metrics that actually exist in the data to avoid empty lines
  const validMetrics = metrics.filter(m => data.some(d => d[m] !== undefined));

  if (validMetrics.length === 0) return null;

  return (
    <div ref={ref} className="bg-white p-4 rounded-lg shadow border border-slate-200 flex flex-col h-[400px] relative group">
      <div className="mb-4 flex justify-between items-start">
        <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{title}</h3>
            {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
        </div>
        {onEdit && (
            <button 
                onClick={onEdit}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full"
                title="Edit Chart Data"
            >
                <Edit2 className="w-4 h-4" />
            </button>
        )}
      </div>
      
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            syncId={syncId || "training-sync"}
            margin={{
              top: 5,
              right: 30,
              left: 0,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey="epoch" 
              tick={{ fontSize: 10, fill: '#64748b' }}
              stroke="#cbd5e1"
            />
            <YAxis 
              tick={{ fontSize: 10, fill: '#64748b' }}
              stroke="#cbd5e1"
              domain={['auto', 'auto']}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                fontSize: '12px'
              }}
              labelStyle={{ color: '#0f172a', fontWeight: 'bold', marginBottom: '4px' }}
            />
            <Legend 
              verticalAlign="top" 
              height={36} 
              iconType="circle"
              wrapperStyle={{ fontSize: '11px', paddingTop: '0px' }}
            />
            {validMetrics.map((metric, index) => (
              <Line
                key={metric}
                type="monotone"
                dataKey={metric}
                stroke={(colors && colors[index]) || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4 }}
                animationDuration={500}
                connectNulls={true}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

ChartComponent.displayName = 'ChartComponent';

export default ChartComponent;
