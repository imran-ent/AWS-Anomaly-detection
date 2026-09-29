import { useRef, useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, TriangleAlert, Loader2 } from 'lucide-react';
import { parseCSV, validateDataset, formatBytes } from '../services/csv';

/* Premium glass drag-and-drop zone.
   Parses the CSV LOCALLY and reports genuine validation results.
   No fake progress: states are idle → reading → validated / error. */
export default function UploadDropzone({ onValidated }) {
  const [dragOver, setDragOver] = useState(false);
  const [reading, setReading] = useState(false);
  const [fileMeta, setFileMeta] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleFile = (file) => {
    setError(null);
    setFileMeta(null);
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      setError(`Unsupported file type: ${file.name}. Please choose a .csv file.`);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError(`${file.name} is ${formatBytes(file.size)} — files over 25 MB are not supported in the browser preview.`);
      return;
    }
    setReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { headers, rows } = parseCSV(String(reader.result || ''));
        if (!headers.length || !rows.length) {
          setError(`${file.name} contains no readable rows. Check the file and try again.`);
          setReading(false);
          return;
        }
        const report = validateDataset(headers, rows);
        const meta = {
          name: file.name,
          size: formatBytes(file.size),
          headers, rows, report,
        };
        setFileMeta(meta);
        if (!report.valid) {
          setError(
            report.rowCount === 0
              ? `${file.name} has headers but no data rows.`
              : `${file.name} was read (${report.rowCount} rows) but no temperature, humidity or pressure columns were detected. Expected columns like Station_ID, Datetime, Temp_2m_C, Humidity_Percent, Pressure_MSL_hPa.`
          );
        }
        if (onValidated) onValidated(report.valid ? meta : null);
      } catch (e) {
        setError(`Could not parse ${file.name}: ${e.message}`);
      } finally {
        setReading(false);
      }
    };
    reader.onerror = () => { setError(`Could not read ${file.name}.`); setReading(false); };
    reader.readAsText(file);
  };

  return (
    <div>
      <div
        className={`dropzone${dragOver ? ' drag-over' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Upload weather data CSV"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
      >
        <span className="dropzone-icon">
          {reading ? <Loader2 size={22} className="spin" /> : <UploadCloud size={22} />}
        </span>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Upload Weather Data</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          {reading ? 'Reading file…' : 'Drag & drop your CSV here'}
        </p>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 14px' }}>or</div>
        <span className="btn btn-primary" style={{ pointerEvents: 'none' }}>
          <FileText size={15} /> Browse Files
        </span>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 12 }}>Supported format: CSV · max 25 MB · parsed locally in your browser</div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          aria-label="Choose CSV file"
          onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
        />
      </div>

      {error && (
        <div className="note-box mt-4 flex-row" style={{ borderColor: '#FECACA', color: '#B91C1C' }} role="alert">
          <TriangleAlert size={14} style={{ flexShrink: 0 }} /> {error}
        </div>
      )}

      {fileMeta && fileMeta.report.valid && (
        <div className="note-box mt-4" role="status">
          <div className="pipeline-check">
            <span className="check-icon done"><CheckCircle2 size={13} /></span>
            <span><strong>{fileMeta.name}</strong> · {fileMeta.size} · {fileMeta.report.rowCount.toLocaleString()} rows read</span>
          </div>
          <div className="pipeline-check">
            <span className="check-icon done"><CheckCircle2 size={13} /></span>
            <span>Sensor columns detected: {[fileMeta.report.cols.temperature, fileMeta.report.cols.humidity, fileMeta.report.cols.pressure].filter(Boolean).join(' · ')}</span>
          </div>
          <div className="pipeline-check">
            <span className={`check-icon ${fileMeta.report.missing > 0 ? 'warn' : 'done'}`}>
              {fileMeta.report.missing > 0 ? <TriangleAlert size={13} /> : <CheckCircle2 size={13} />}
            </span>
            <span>{fileMeta.report.missing > 0 ? `${fileMeta.report.missing} rows with missing sensor values (treated as communication gaps)` : 'No missing sensor values'}</span>
          </div>
          <div className="pipeline-check">
            <span className={`check-icon ${fileMeta.report.outOfRange > 0 ? 'warn' : 'done'}`}>
              {fileMeta.report.outOfRange > 0 ? <TriangleAlert size={13} /> : <CheckCircle2 size={13} />}
            </span>
            <span>{fileMeta.report.outOfRange > 0 ? `${fileMeta.report.outOfRange} rows outside physical plausibility ranges` : 'All rows within physical plausibility ranges'}</span>
          </div>
        </div>
      )}
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
