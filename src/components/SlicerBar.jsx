// src/components/SlicerBar.jsx
export default function SlicerBar({ slicers, slicerState, onChange, totalRows, filteredRows }) {
  if (!slicers || slicers.length === 0) return null
  const hasFilter = filteredRows < totalRows
  return (
    <div style={{ background:'#f4f3f0', border:'0.5px solid #ddd', borderRadius:12, padding:'10px 14px', marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, flexWrap:'wrap', gap:8 }}>
        <span style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>🔽 Filters</span>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:11, color:'#555' }}>Showing <strong style={{ color:'#1a1a18' }}>{filteredRows.toLocaleString()}</strong> of {totalRows.toLocaleString()} rows</span>
          {hasFilter && <button onClick={() => onChange({})} style={{ fontSize:10, padding:'2px 8px', borderRadius:999, border:'0.5px solid #A32D2D', background:'transparent', color:'#A32D2D', cursor:'pointer' }}>Clear all</button>}
        </div>
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:16 }}>
        {slicers.map(slicer => (
          <div key={slicer.column}>
            <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5, color: slicer.isDerived ? '#534AB7' : '#888' }}>
              {slicer.column}{slicer.isDerived && <span style={{ marginLeft:4, fontSize:8, background:'#EEEDFE', color:'#534AB7', padding:'1px 4px', borderRadius:4 }}>derived</span>}
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
              {slicer.options.map(opt => {
                const isActive = (slicerState[slicer.column] || 'All') === opt
                return (
                  <div key={opt} onClick={() => onChange({ ...slicerState, [slicer.column]: opt })}
                    style={{ padding:'3px 9px', borderRadius:999, fontSize:11, cursor:'pointer', userSelect:'none',
                      background: isActive ? '#185FA5' : 'white', color: isActive ? '#fff' : '#555',
                      border: `0.5px solid ${isActive ? '#185FA5' : '#ccc'}`, transition:'all 0.12s' }}>
                    {opt}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
