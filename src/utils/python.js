// src/utils/python.js
let pyodideInstance = null
let isLoading = false

export async function initPython(onProgress) {
  if (pyodideInstance) return pyodideInstance
  if (isLoading) {
    while (isLoading) await new Promise(r => setTimeout(r, 200))
    return pyodideInstance
  }
  isLoading = true
  try {
    onProgress?.('Loading Python runtime...')
    pyodideInstance = await loadPyodide()
    onProgress?.('Installing pandas, numpy, scipy...')
    await pyodideInstance.loadPackage(['pandas','numpy','scipy','scikit-learn','statsmodels','matplotlib'])
    onProgress?.('Python ready ✓')
    isLoading = false
    return pyodideInstance
  } catch(err) {
    isLoading = false
    onProgress?.('Python ready (basic mode)')
    return pyodideInstance
  }
}

export async function runPython(code, data) {
  if (!pyodideInstance) throw new Error('Python not initialised')

  // Aggressive cleaning — strip ALL markdown artifacts
  let cleanCode = code
  cleanCode = cleanCode.replace(/^```python\s*/gim, '')
  cleanCode = cleanCode.replace(/^```\s*/gim, '')
  cleanCode = cleanCode.replace(/`/g, '')
  // Remove top-level return statements
  cleanCode = cleanCode.split('\n').map(line => {
    const trimmed = line.trimStart()
    const indent = line.length - trimmed.length
    if (indent === 0 && trimmed.startsWith('return ')) return trimmed.slice(7)
    return line
  }).join('\n')

  pyodideInstance.globals.set('_data_json', JSON.stringify(data))

  const fullScript = `
import pandas as pd
import numpy as np
import json
import warnings
warnings.filterwarnings('ignore')

df = pd.DataFrame(json.loads(_data_json))

for col in df.columns:
    if df[col].dtype == object:
        try: df[col] = pd.to_datetime(df[col])
        except: pass

${cleanCode}
`

  try {
    const result = await pyodideInstance.runPythonAsync(fullScript)
    if (result === null || result === undefined) return {}
    if (typeof result.toJs === 'function') {
      return result.toJs({ dict_converter: Object.fromEntries })
    }
    return result
  } catch(err) {
    return { __error: err.message, __code: cleanCode }
  }
}
