
import React, { useRef, useState } from 'react';
import { ParsedLog, LogDataPoint } from '../utils/logParser';
import { CHART_GROUPS, ChartConfig } from '../constants';
import ChartComponent from './ChartComponent';
import DataEditorModal from './DataEditorModal';
import { Download, Upload, FileText, Activity, Save } from 'lucide-react';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';

interface Props {
  logData: ParsedLog;
  onReset: () => void;
  onUpdateData: (newData: LogDataPoint[], keysChanged: string[]) => void;
  onExportLog: () => void;
}

const Dashboard: React.FC<Props> = ({ logData, onReset, onUpdateData, onExportLog }) => {
  const chartRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  
  // Editor Modal State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorConfig, setEditorConfig] = useState<ChartConfig | null>(null);

  const handleEditClick = (config: ChartConfig) => {
    setEditorConfig(config);
    setEditorOpen(true);
  };

  const handleEditorSave = (newData: LogDataPoint[], keysChanged: string[]) => {
    onUpdateData(newData, keysChanged);
    setEditorOpen(false);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const zip = new JSZip();
      // Generate timestamp for folder/filenames
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const folder = zip.folder(`logviz_export_${timestamp}`);

      if (!folder) throw new Error("Failed to create zip folder");

      let exportedCount = 0;

      // Process all charts
      const promises = CHART_GROUPS.map(async (group, idx) => {
        const element = chartRefs.current[idx];
        if (element) {
          try {
            const dataUrl = await toPng(element, { 
                cacheBust: true, 
                pixelRatio: 2, // High definition
                backgroundColor: '#ffffff' 
            });
            
            // Create a safe filename from the chart title
            const safeTitle = group.title
                .replace(/[^a-z0-9]/gi, '_') // Replace non-alphanumeric with underscore
                .replace(/_+/g, '_')         // Collapse multiple underscores
                .toLowerCase();
                
            const filename = `${String(idx + 1).padStart(2, '0')}_${safeTitle}.png`;
            folder.file(filename, dataUrl.split(',')[1], { base64: true });
            exportedCount++;
          } catch (e) {
            console.warn(`Failed to export chart: ${group.title}`, e);
          }
        }
      });

      await Promise.all(promises);

      if (exportedCount === 0) {
        alert("No charts found to export.");
        return;
      }

      // Generate zip and trigger download
      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `logviz_charts_${timestamp}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Failed to export images', err);
      alert('Failed to export images. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="flex-none bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
                <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">LogViz Pro</h1>
                <p className="text-xs text-slate-500">Training Metrics Analysis</p>
            </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end mr-4">
             <span className="text-xs font-medium text-slate-500">Total Epochs</span>
             <span className="text-sm font-bold text-slate-800">{logData.data.length}</span>
          </div>
          
          <button
            onClick={onExportLog}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Save className="w-4 h-4" />
            Export Log File
          </button>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isExporting ? 'Zipping...' : 'Export Images'}
            <Download className="w-4 h-4" />
          </button>
          
           <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            New
          </button>
        </div>
      </header>

      {/* Main Content (Scrollable) */}
      <div className="flex-1 overflow-auto p-6 bg-slate-100/50">
        <div 
            className="max-w-7xl mx-auto space-y-6 bg-slate-100/50 p-4"
        >
          {/* Args Section */}
          {Object.keys(logData.args).length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-bold uppercase text-slate-800 tracking-wide">Configuration Arguments</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                {Object.entries(logData.args).map(([key, value]) => (
                  <div key={key} className="flex gap-2 border-b border-slate-100 pb-1">
                    <span className="font-semibold text-slate-600">{key}:</span>
                    <span className="text-slate-800 font-mono break-all">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {CHART_GROUPS.map((group, idx) => (
              <ChartComponent
                key={idx}
                ref={(el) => { chartRefs.current[idx] = el; }}
                data={logData.data}
                title={group.title}
                description={group.description}
                metrics={group.metrics}
                colors={group.colors}
                onEdit={() => handleEditClick(group)}
              />
            ))}
          </div>

          <div className="text-center py-4 text-xs text-slate-400">
            Generated by LogViz Pro • {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* Editor Modal */}
      {editorOpen && editorConfig && (
        <DataEditorModal 
            isOpen={editorOpen}
            onClose={() => setEditorOpen(false)}
            onSave={handleEditorSave}
            initialData={logData.data}
            metrics={editorConfig.metrics}
            title={editorConfig.title}
        />
      )}
    </div>
  );
};

export default Dashboard;
