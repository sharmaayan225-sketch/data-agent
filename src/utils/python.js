export async function runPython(code, data) {
  if (!pyodideInstance) throw new Error('Python not initialised')

  // Aggressive cleaning — remove ALL markdown artifacts
  let cleanCode = code
  cleanCode = cleanCode.replace(/^```python\s*/gim, '')
  cleanCode = cleanCode.replace(/^```\s*/gim, '')
  cleanCode = cleanCode.replace(/`/g, '')
  cleanCode = cleanCode.replace(/^\s*return\s+(\S)/gm, '$1')

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
