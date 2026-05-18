// src/utils/slicers.js
export function detectSlicerColumns(data, profile) {
  if (!data || !profile) return []
  return Object.entries(profile.columns)
    .filter(([colName, meta]) => {
      const isCategorical = meta.type === 'category' || meta.type === 'date'
      const hasFewOptions = meta.uniqueCount >= 2 && meta.uniqueCount <= 30
      const notAnId = !colName.toLowerCase().match(/\b(id|uuid|guid|key|index|_id)\b/)
      const notEmpty = meta.nullPct < 80
      return isCategorical && hasFewOptions && notAnId && notEmpty
    })
    .map(([colName]) => ({
      column: colName,
      isDerived: profile.columns[colName]?.isDerived || false,
      options: ['All', ...[...new Set(data.map(r => r[colName])
        .filter(v => v !== null && v !== undefined && v !== ''))]
        .map(String).sort((a,b) => {
          const na = Number(a), nb = Number(b)
          return !isNaN(na) && !isNaN(nb) ? na - nb : a.localeCompare(b)
        })]
    }))
}

export function applySlicers(data, slicerState) {
  if (!data || !slicerState || Object.keys(slicerState).length === 0) return data
  return data.filter(row =>
    Object.entries(slicerState).every(([col, val]) => {
      if (!val || val === 'All') return true
      return String(row[col]) === String(val)
    })
  )
}

export function applyChartClick(currentSlicerState, column, value) {
  const current = currentSlicerState[column]
  return { ...currentSlicerState, [column]: current === String(value) ? 'All' : String(value) }
}

export function describeFilters(slicerState) {
  const active = Object.entries(slicerState).filter(([,val]) => val && val !== 'All')
  if (active.length === 0) return 'No filters — showing all data'
  return 'Filtered by: ' + active.map(([col,val]) => `${col} = "${val}"`).join(', ')
}
