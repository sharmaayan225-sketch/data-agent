// src/components/CategoryPanel.jsx
import { useState } from 'react'
import VariablePicker from './VariablePicker.jsx'

const LABELS = { charts:'Charts', eda:'EDA', data_quality:'Data quality', report:'Report & export', regression:'Regression', ml_models:'ML models', stats_tests:'Statistical tests', financial:'Financial analysis', marketing:'Marketing analysis', hr:'HR & people', operations:'Operations', text_nlp:'Text & NLP' }

export default function CategoryPanel({ category, profile, filteredData, onRun, onBack, loading }) {
  const [choices, setChoices] = useState({})

  return (
    <div style={{ border:'0.5px solid #ddd', borderRadius:14, padding:'16px 18px', marginBottom:14, background:'white' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <button onClick={onBack} style={{ padding:'4px 12px', borderRadius:999, border:'0.5px solid #ccc', background:'transparent', cursor:'pointer', fontSize:11, color:'#555' }}>← Back</button>
        <div style={{ fontSize:14, fontWeight:600, color:'#1a1a18' }}>{LABELS[category]}</div>
        <div style={{ marginLeft:'auto', fontSize:11, color:'#888', padding:'3px 10px', background:'#f4f3f0', borderRadius:999 }}>{(filteredData||[]).length.toLocaleString()} rows selected</div>
      </div>

      <VariablePicker category={category} profile={profile} choices={choices} onChange={setChoices} />

      <button onClick={() => onRun({ ...choices, filterDescription:`${(filteredData||[]).length} rows` })} disabled={loading}
        style={{ padding:'10px 24px', borderRadius:999, border:'none', background: loading ? '#ccc' : '#185FA5', color:'#fff', fontSize:13, fontWeight:600, cursor: loading ? 'not-allowed' : 'pointer' }}>
        {loading ? '⏳ Running analysis...' : `Run ${LABELS[category]} ↗`}
      </button>
    </div>
  )
}
