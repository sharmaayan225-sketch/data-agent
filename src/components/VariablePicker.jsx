// src/components/VariablePicker.jsx
import { useEffect } from 'react'
import { VARIABLE_PICKER_CONFIG } from '../engines/prompts.js'

export default function VariablePicker({ category, profile, choices, onChange }) {
  const config = VARIABLE_PICKER_CONFIG[category]
  if (!config || !profile) return null
  const allColumns = Object.entries(profile.columns).map(([name, meta]) => ({ name, ...meta }))

  useEffect(() => {
    const defaults = {}
    Object.entries(config).forEach(([key, cfg]) => {
      if (choices[key]) return
      if (cfg.options) { defaults[key] = cfg.options[0]; return }
      const eligible = getEligible(allColumns, cfg.types)
      if (!eligible.length) return
      defaults[key] = cfg.multi ? eligible.filter(c => !c.isDerived).slice(0,2).map(c => c.name)
                                : (eligible.find(c => !c.isDerived) || eligible[0])?.name
    })
    if (Object.keys(defaults).length) onChange({ ...choices, ...defaults })
  }, [category])

  return (
    <div style={{ marginBottom:14 }}>
      {Object.entries(config).map(([key, cfg]) => (
        <PickerRow key={key} label={cfg.label} isMulti={cfg.multi||false} optional={cfg.optional||false}
          options={cfg.options} columnOptions={cfg.options ? null : getEligible(allColumns, cfg.types)}
          selected={choices[key]} onChange={val => onChange({ ...choices, [key]: val })} />
      ))}
    </div>
  )
}

function getEligible(cols, types) { return types ? cols.filter(c => types.includes(c.type)) : cols }

function PickerRow({ label, isMulti, optional, options, columnOptions, selected, onChange }) {
  const toggle = (val) => {
    if (isMulti) {
      const cur = Array.isArray(selected) ? selected : []
      onChange(cur.includes(val) ? cur.filter(c => c !== val) : [...cur, val])
    } else onChange(val)
  }
  const isSel = (val) => isMulti ? (Array.isArray(selected) && selected.includes(val)) : selected === val
  const items = options ? options.map(o => ({ name:o, isDerived:false })) : (columnOptions||[])

  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:10 }}>
      <div style={{ minWidth:100, paddingTop:4 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.04em' }}>{label}</div>
        {isMulti && <div style={{ fontSize:9, color:'#aaa', marginTop:2 }}>multi-select</div>}
        {optional && <div style={{ fontSize:9, color:'#aaa', marginTop:2 }}>optional</div>}
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
        {items.map(item => {
          const active = isSel(item.name)
          const base = { padding:'4px 10px', borderRadius:999, fontSize:11, cursor:'pointer', userSelect:'none', transition:'all 0.11s', fontFamily: item.isDerived ? 'inherit' : 'monospace' }
          if (active && item.isDerived) return <div key={item.name} onClick={() => toggle(item.name)} style={{ ...base, background:'#534AB7', border:'0.5px solid #534AB7', color:'#fff' }}>{item.name}</div>
          if (active) return <div key={item.name} onClick={() => toggle(item.name)} style={{ ...base, background:'#185FA5', border:'0.5px solid #185FA5', color:'#fff' }}>{item.name}</div>
          if (item.isDerived) return <div key={item.name} onClick={() => toggle(item.name)} style={{ ...base, background:'#EEEDFE', border:'0.5px solid #AFA9EC', color:'#3C3489' }}>{item.name}</div>
          return <div key={item.name} onClick={() => toggle(item.name)} style={{ ...base, background:'white', border:'0.5px solid #ccc', color:'#555' }}>{item.name}</div>
        })}
        {items.length === 0 && <div style={{ fontSize:11, color:'#aaa', fontStyle:'italic' }}>No suitable columns found</div>}
      </div>
    </div>
  )
}
