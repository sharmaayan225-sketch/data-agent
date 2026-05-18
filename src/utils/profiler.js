// src/utils/profiler.js
export function profileData(data) {
  if (!data || data.length === 0) return null
  const columns = Object.keys(data[0])
  const colProfiles = {}

  columns.forEach(col => {
    const allValues = data.map(r => r[col])
    const values = allValues.filter(v => v !== null && v !== undefined && v !== '')
    const sample = values.slice(0, 200)

    const numericCount = sample.filter(v => {
      const n = Number(v)
      return !isNaN(n) && v !== '' && v !== null && typeof v !== 'boolean'
    }).length

    const dateCount = sample.filter(v => {
      const s = String(v)
      return s.length >= 6 &&
        (!isNaN(Date.parse(s)) || /\d{2}-[A-Za-z]{3}-\d{2,4}/.test(s)) &&
        (s.includes('-') || s.includes('/'))
    }).length

    const textCount = sample.filter(v => typeof v === 'string' && v.length > 30).length
    const uniqueVals = [...new Set(values.map(String))]

    let type
    if (dateCount > sample.length * 0.5)         type = 'date'
    else if (numericCount > sample.length * 0.75) type = 'numeric'
    else if (textCount > sample.length * 0.2)     type = 'text'
    else                                          type = 'category'

    let min = null, max = null, mean = null
    if (type === 'numeric') {
      const nums = values.map(Number).filter(n => !isNaN(n))
      if (nums.length) {
        min = Math.min(...nums)
        max = Math.max(...nums)
        mean = Math.round(nums.reduce((a, b) => a + b, 0) / nums.length * 100) / 100
      }
    }

    colProfiles[col] = {
      type,
      uniqueCount: uniqueVals.length,
      nullCount: allValues.length - values.length,
      nullPct: Math.round((allValues.length - values.length) / allValues.length * 100),
      min, max, mean,
      sampleValues: uniqueVals.slice(0, 8),
      isLikelySlicer: (type === 'category' || type === 'date') && uniqueVals.length <= 30,
      isDerived: col.includes('_predicted') || col.includes('_residual') ||
                 col.includes('GARCH_') || col.includes('RFM_') ||
                 col.includes('CLV_') || col.includes('Churn_') ||
                 col.includes('_score') || col.includes('_cluster') ||
                 col.includes('_log') || col.includes('_lag') ||
                 col.includes('ML_') || col.includes('FIN_') ||
                 col.includes('REG_') || col.includes('MKT_') ||
                 col.includes('HR_') || col.includes('OPS_') ||
                 col.includes('NLP_') || col.includes('EDA_') ||
                 col.includes('STAT_') || col.includes('Volatility_') ||
                 col.includes('Returns')
    }
  })

  return {
    rowCount: data.length,
    columnCount: columns.length,
    columns: colProfiles,
    summary: buildSummary(columns, colProfiles, data.length)
  }
}

function buildSummary(columns, profiles, rowCount) {
  const lines = [`Dataset: ${rowCount} rows, ${columns.length} columns`, '']
  columns.forEach(col => {
    const p = profiles[col]
    let line = `• ${col} [${p.type}] — ${p.uniqueCount} unique, ${p.nullPct}% nulls`
    if (p.type === 'numeric') line += `, range ${p.min}–${p.max}`
    if (p.sampleValues.length) line += `, e.g.: ${p.sampleValues.slice(0, 4).join(', ')}`
    lines.push(line)
  })
  return lines.join('\n')
}

export function reprofileWithDerived(data, previousProfile, newColNames) {
  if (!data || data.length === 0) return previousProfile

  const newProfile = profileData(data)
  if (!newProfile) return previousProfile

  // Force-mark all new columns as derived and ensure numeric type
  newColNames.forEach(col => {
    if (newProfile.columns[col]) {
      newProfile.columns[col].isDerived = true
      const vals = data.map(r => r[col]).filter(v => v != null)
      const numCount = vals.filter(v => !isNaN(Number(v))).length
      if (numCount > vals.length * 0.7) {
        newProfile.columns[col].type = 'numeric'
      }
    }
  })

  // Preserve isDerived flags from previous profile
  if (previousProfile) {
    Object.entries(previousProfile.columns).forEach(([col, meta]) => {
      if (meta.isDerived && newProfile.columns[col]) {
        newProfile.columns[col].isDerived = true
      }
    })
  }

  return newProfile
}
