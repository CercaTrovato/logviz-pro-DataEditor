
import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import { parseLogContent, ParsedLog, LogDataPoint } from './utils/logParser';
import { updateLogContent } from './utils/logExporter';
import { FileUp, FileText, AlertCircle } from 'lucide-react';

// Example log content for demo purposes
const EXAMPLE_LOG = `2026-02-14 12:26:13.980: Args: Namespace(dataset='RGB-D', batch_size=256, lr=0.0001)
2026-02-14 12:27:30.391: ACC=0.3478 NMI=0.3323 PUR=0.5210 ARI=0.1940 F1=0.2873
2026-02-14 12:27:30.391: METRIC: epoch=1 step=1 ACC=0.3478 NMI=0.3323 PUR=0.5210 ARI=0.1940 F1=0.2873 gate=0.0000 L_total=18.923725
2026-02-14 12:27:30.391: ROUTE: epoch=1 neg_mode=batch U_size=49 neg_per_anchor=221.13 FN_ratio=0.0000
2026-02-14 12:27:36.304: ACC=0.2899 NMI=0.2587 PUR=0.4341 ARI=0.1351 F1=0.2346
2026-02-14 12:27:36.304: METRIC: epoch=2 step=2 ACC=0.2899 NMI=0.2587 PUR=0.4341 ARI=0.1351 F1=0.2346 gate=0.0101 L_total=18.509275
2026-02-14 12:27:36.304: ROUTE: epoch=2 neg_mode=batch U_size=49 neg_per_anchor=221.67 FN_ratio=0.0000
2026-02-14 12:27:42.217: ACC=0.2733 NMI=0.2569 PUR=0.4596 ARI=0.1406 F1=0.2386
2026-02-14 12:27:42.218: METRIC: epoch=3 step=3 ACC=0.2733 NMI=0.2569 PUR=0.4596 ARI=0.1406 F1=0.2386 gate=0.0202 L_total=17.673055
2026-02-14 12:27:42.218: ROUTE: epoch=3 neg_mode=batch U_size=49 neg_per_anchor=219.86 FN_ratio=0.0000
`;

const App: React.FC = () => {
  const [logContent, setLogContent] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParsedLog | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processLog = (content: string) => {
    try {
      const result = parseLogContent(content);
      if (result.data.length === 0) {
        setError("No valid metrics found in the provided log. Ensure lines contain 'METRIC:' or 'ROUTE:'.");
        setParsedData(null);
      } else {
        setError(null);
        setParsedData(result);
      }
    } catch (e) {
      setError("Failed to parse log file. Please check the format.");
      console.error(e);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setLogContent(text);
      processLog(text);
    };
    reader.readAsText(file);
  };

  const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLogContent(e.target.value);
  };

  const handleAnalyzeClick = () => {
    if (!logContent.trim()) {
      setError("Please paste a log content or upload a file first.");
      return;
    }
    processLog(logContent);
  };

  const loadExample = () => {
      setLogContent(EXAMPLE_LOG);
      processLog(EXAMPLE_LOG);
  }

  // --- New Logic for Editing & Exporting ---

  const handleUpdateData = (newData: LogDataPoint[], keysChanged: string[]) => {
      if (!parsedData) return;
      
      // Update the parsed state so Charts reflect changes immediately
      setParsedData({
          ...parsedData,
          data: newData
      });

      // Update the raw content string so subsequent exports or edits use the latest
      const result = updateLogContent(logContent, newData, keysChanged);
      setLogContent(result.newContent);
  };

  const handleExportLog = () => {
      const blob = new Blob([logContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'training_modified.log';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
  };

  if (parsedData) {
    return (
        <Dashboard 
            logData={parsedData} 
            onReset={() => setParsedData(null)} 
            onUpdateData={handleUpdateData}
            onExportLog={handleExportLog}
        />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 px-8 py-6 text-white text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-90" />
          <h1 className="text-2xl font-bold mb-2">Training Log Visualizer</h1>
          <p className="text-blue-100">Upload your training log to generate an instant performance dashboard.</p>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          
          {/* File Upload */}
          <div className="relative">
             <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-blue-300 border-dashed rounded-lg cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <FileUp className="w-8 h-8 text-blue-500 mb-2" />
                    <p className="text-sm text-slate-600"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                    <p className="text-xs text-slate-400 mt-1">.txt or .log files</p>
                </div>
                <input type="file" className="hidden" accept=".txt,.log" onChange={handleFileUpload} />
            </label>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-sm">OR PASTE CONTENT</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Text Area */}
          <div>
            <textarea
              value={logContent}
              onChange={handlePasteChange}
              placeholder="Paste your log content here (e.g., lines starting with METRIC: ...)"
              className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs font-mono text-slate-700 resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
             <button
              onClick={loadExample}
              className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors text-sm"
            >
              Try Example
            </button>
            <button
              onClick={handleAnalyzeClick}
              className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors shadow-blue-200"
            >
              Analyze Log
            </button>
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-slate-400 text-xs text-center">
        Processing is done entirely in your browser. Your data is not sent to any server.
      </p>
    </div>
  );
};

export default App;
