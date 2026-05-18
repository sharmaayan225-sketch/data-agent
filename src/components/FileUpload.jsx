// src/components/FileUpload.jsx
import { useState } from 'react'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

export default function FileUpload({ onDataLoaded, pythonReady }) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleFile = (file) => {
    if (!file) return
    setError(null); setLoading(true)
    const ext = file.name.split('.').pop().toLowerCase()
    if (file.size > 50 * 1024 * 1024) { setError('File too large (max 50MB)'); setLoading(false); return }

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true, dynamicTyping: true, skipEmptyLines: true,
        complete: (r) => { setLoading(false); onDataLoaded(r.data, file.name) },
        error: (e) => { setError('CSV error: ' + e.message); setLoading(false) }
      })
    } else if (['xlsx','xls','xlsm','xlsb','ods','xlam'].includes(ext)) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type:'array', cellDates:true, dateNF:'yyyy-mm-dd' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const data = XLSX.utils.sheet_to_json(ws, { raw:false, defval:null })
          setLoading(false); onDataLoaded(data, file.name)
        } catch(err) { setError('Excel error: ' + err.message); setLoading(false) }
      }
      reader.readAsArrayBuffer(file)
    } else { setError(`Unsupported: .${ext}`); setLoading(false) }
  }

  return (
    <div style={{ marginBottom: 28 }}>
      {!pythonReady && (
        <div style={{ background:'#FAEEDA', border:'0.5px solid #854F0B', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:11, color:'#633806' }}>
          ⏳ Loading Python analysis engine (~15 seconds first time, then instant)...
        </div>
      )}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
        onClick={() => document.getElementById('file-input').click()}
        style={{
          border: `2px dashed ${dragging ? '#185FA5' : '#ccc'}`,
          borderRadius:16, padding:'48px 32px', textAlign:'center',
          background: dragging ? '#E6F1FB' : '#fafaf8', cursor:'pointer', transition:'all 0.2s'
        }}
      >
        <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
        {loading
          ? <p style={{ fontSize:14, color:'#185FA5', fontWeight:500 }}>Reading file...</p>
          : <>
              <p style={{ fontSize:15, fontWeight:500, color:'#1a1a18', marginBottom:6 }}>Drop your data file here, or click to browse</p>
              <p style={{ fontSize:12, color:'#888' }}>CSV · XLSX · XLS · XLSM · XLSB · ODS (max 50MB)</p>
            </>
        }
        <input id="file-input" type="file" accept=".csv,.xlsx,.xls,.xlsm,.xlsb,.ods" style={{ display:'none' }} onChange={(e) => handleFile(e.target.files[0])} />
      </div>
      {error && <div style={{ marginTop:10, background:'#FCEBEB', border:'0.5px solid #A32D2D', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#501313' }}>⚠️ {error}</div>}
    </div>
  )
}
