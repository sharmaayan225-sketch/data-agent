// src/components/VariablePicker.jsx
import { useEffect } from 'react'
import { VARIABLE_PICKER_CONFIG } from '../engines/prompts.js'

export default function VariablePicker({ category, profile, choices, onChange }) {
  const config = VARIABLE_PICKER_CONFIG[category]
  if (!config || !profile) return null

  const allColumns = Object.entries(profile.columns).map(([name, meta]) => ({
    name, ...meta
  }))

  useEffect(() => {
    const defaults = {}
    Object.entries(config).forEach(([key, cfg]) => {
      if (choices[key]) return
      if (cfg.optional) return
      if (cfg.options) {
        defaults[key] = cfg.options[0]
        return
      }
      const eligible = getEligibleColumns(allColumns, cfg.types)
      if (eligible.length === 0) return
      if (cfg.multi) {
        defaults[key] = eligible.filter(c => !c.isDerived).slice(0, 2).map(c => c.name)
      } else {
        defaults[key] = (eligible.find(c => !c.isDerived) || eligible[0])?.name
      }
    })
    if (Object.keys(defaults).length > 0) {
      onChange({ ...choices, ...defaults })
    }
  }, [category])

  return (
    <div style={{ marginBottom: 14 }}>
      {Object.entries(config).map(([key, cfg]) => (
        <PickerRow
          key={key}
          label={cfg.label}
          isMulti={cfg.multi || false}
          optional={cfg.optional || false}
          options={cfg.options}
          columnOptions={cfg.options ? null : getEligibleColumns(allColumns, cfg.types)}
          selected={choices[key]}
          onChange={(val) => onChange({ ...choices, [key]: val })}
        />
      ))}
    </div>
  )
}

function getEligibleColumns(allColumns, types) {
  if (!types) return allColumns
  return allColumns.filter(c => types.includes(c.type))
}

function PickerRow({ label, isMulti, optional, options, columnOptions, selected, onChange }) {

  const toggleColumn = (colName) => {
    if (isMulti) {
      const current = Array.isArray(selected) ? selected : []
      const updated = current.includes(colName)
        ? current.filter(c => c !== colName)
        : [...current, colName]
      onChange(updated)
    } else if (optional && selected === colName) {
      onChange(null)
    } else {
      onChange(colName)
    }
  }

  const isSelected = (val) => {
    if (isMulti) return Array.isArray(selected) && selected.includes(val)
    return selected === val
  }

  const items = options
    ? options.map(o => ({ name: o, isDerived: false, isOption: true }))
    : (columnOptions || [])

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
      <div style={{ minWidth: 120, paddingTop: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </div>
        {isMulti && <div style={{ fontSize: 9, color: '#aaa', marginTop: 2 }}>multi-select</div>}
        {optional && <div style={{ fontSize: 9, color: '#aaa', marginTop: 2 }}>optional — click to deselect</div>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {items.map(item => {
          const active = isSelected(item.name)
          const base = {
            padding: '4px 10px', borderRadius: 999, fontSize: 11,
            cursor: 'pointer', userSelect: 'none', transition: 'all 0.11s',
            fontFamily: item.isOption ? 'inherit' : 'monospace'
          }

          if (active && item.isDerived)
            return <div key={item.name} onClick={() => toggleColumn(item.name)}
              style={{ ...base, background: '#534AB7', border: '0.5px solid #534AB7', color: '#fff' }}>
              {item.name} ×
            </div>

          if (active)
            return <div key={item.name} onClick={() => toggleColumn(item.name)}
              style={{ ...base, background: '#185FA5', border: '0.5px solid #185FA5', color: '#fff' }}>
              {item.name}{optional && ' ×'}
            </div>

          if (item.isDerived)
            return <div key={item.name} onClick={() => toggleColumn(item.name)}
              style={{ ...base, background: '#EEEDFE', border: '0.5px solid #AFA9EC', color: '#3C3489' }}>
              {item.name}
            </div>

          return <div key={item.name} onClick={() => toggleColumn(item.name)}
            style={{ ...base, background: 'white', border: '0.5px solid #ccc', color: '#555' }}>
            {item.name}
          </div>
        })}

        {items.length === 0 &&
          <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic' }}>No suitable columns found</div>
        }
      </div>
    </div>
  )
}
