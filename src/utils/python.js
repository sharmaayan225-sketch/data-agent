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
    onProgress?.('Installing financial libraries...')
    try {
      await pyodideInstance.runPythonAsync(`
import micropip
await micropip.install('arch')
await micropip.install('lifetimes')
      `)
    } catch(e) { console.warn('Optional packages failed:', e.message) }
    onProgress?.('Python ready ✓')
    isLoading = false
    return pyodideInstance
  } catch(err) {
    isLoading = false
    onProgress?.('Python ready (basic mode)')
    return pyodideInstance
  }
}

function sanitisePython(code) {
  // Remove markdown code fences that AI sometimes includes
  code = code.replace(/```python\s*/gi, '').replace(/```\s*/gi, '')
  
  // Remove top-level return statements
  const lines = code.split('\n')
  return lines.map(line => {
    const trimmed = line.trimStart()
    const indent = line.length - trimmed.length
    if (indent === 0 && trimmed.startsWith('return ')) {
      return trimmed.slice(7)
    }
    return line
  }).join('\n')
}

export async function runPython(code, data) {
  if (!pyodideInstance) throw new Error('Python not initialised')

  const cleanCode = sanitisePython(code)
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
