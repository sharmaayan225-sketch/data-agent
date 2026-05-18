// src/App.jsx
import { useState, useEffect } from 'react'
import { initPython } from './utils/python.js'
import { profileData, reprofileWithDerived } from './utils/profiler.js'
import { detectSlicerColumns, applySlicers, applyChartClick } from './utils/slicers.js'
import { getRecommendedCategories, runAnalysis } from './agents/orchestrator.js'
import FileUpload from './components/FileUpload.jsx'
import SlicerBar from './components/SlicerBar.jsx'
import Layer1Grid from './components/Layer1Grid.jsx'
import CategoryPanel from './components/CategoryPanel.jsx'
import ResultsPanel from './components/ResultsPanel.jsx'

export default function App() {
  const [pyodide, setPyodide]               = useState(null)
  const [pythonReady, setPythonReady]       = useState(false)
  const [pythonStatus, setPythonStatus]     = useState('Loading Python...')
  const [filename, setFilename]             = useState(null)
  const [rawData, setRawData]               = useState([])
  const [memoryData, setMemoryData]         = useState([])
  const [filteredData, setFilteredData]     = useState([])
  const [profile, setProfile]               = useState(null)
  const [slicers, setSlicers]               = useState([])
  const [slicerState, setSlicerState]       = useState({})
  const [categories, setCategories]         = useState([])
  const [loadingCats, setLoadingCats]       = useState(false)
  const [activeCategory, setActiveCategory] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError]   = useState(null)
  const [results, setResults]               = useState([])

  useEffect(() => {
    initPython(s => setPythonStatus(s)).then(py => { setPyodide(py); setPythonReady(true) }).catch(e => setPythonStatus('Python error: ' + e.message))
  }, [])

  useEffect(() => {
    if (memoryData.length > 0) setFilteredData(applySlicers(memoryData, slicerState))
  }, [slicerState, memoryData])

  const handleDataLoaded = async (data, fname) => {
    setFilename(fname); setRawData(data); setMemoryData(data); setFilteredData(data)
    setSlicerState({}); setResults([]); setActiveCategory(null); setAnalysisError(null)
    const prof = profileData(data); setProfile(prof)
    setSlicers(detectSlicerColumns(data, prof))
    setLoadingCats(true)
    try { setCategories(await getRecommendedCategories(prof)) }
    catch(e) { setCategories(['charts','eda','data_quality','report']) }
    setLoadingCats(false)
  }

 const handleRunAnalysis = async (choices) => {
  setAnalysisLoading(true); setAnalysisError(null)
  try {
    const result = await runAnalysis({ category: activeCategory, choices, filteredData, profile })
    setResults(prev => [result, ...prev])

    // ── MEMORY SYSTEM ──────────────────────────────────────────
    // Extract ALL array-type results and save them as new columns.
    // This includes GARCH_volatility, RFM_segment, predictions, etc.
    // We do this automatically — no need to rely on AI identifying columns.

    const rawResult = result.result || {}
    const numRows = memoryData.length
    let updated = [...memoryData]
    const newColNames = []

    // Strategy 1: columns explicitly identified by the AI
    if (result.newColumns && result.newColumns.length > 0) {
      result.newColumns.forEach(({ name }) => {
        const values = rawResult[name]
        if (Array.isArray(values) && values.length === numRows) {
          updated = updated.map((row, i) => ({ ...row, [name]: values[i] }))
          newColNames.push(name)
        }
      })
    }

    // Strategy 2: scan ALL result keys for arrays matching row count
    // This catches everything the AI missed — GARCH_volatility, predictions, etc.
    const categoryPrefix = {
      financial:   'FIN_',
      regression:  'REG_',
      ml_models:   'ML_',
      marketing:   'MKT_',
      hr:          'HR_',
      operations:  'OPS_',
      text_nlp:    'NLP_',
      eda:         'EDA_',
      stats_tests: 'STAT_',
    }
    const prefix = categoryPrefix[activeCategory] || ''

    Object.entries(rawResult).forEach(([key, values]) => {
      // Only save arrays that match the row count exactly
      if (!Array.isArray(values)) return
      if (values.length !== numRows) return
      // Skip keys already saved in Strategy 1
      if (newColNames.includes(key)) return
      // Skip internal/debug keys
      if (['chartData', '__error', '__code'].includes(key)) return

      // Name the column: use key directly if it already has a good name,
      // otherwise prefix it so the user knows where it came from
      const colName = key.startsWith('GARCH_') || key.startsWith('RFM_') ||
                      key.startsWith('CLV_') || key.startsWith('Churn_') ||
                      key.startsWith('ML_') || key.startsWith('Regression_')
                      ? key
                      : `${prefix}${key}`

      updated = updated.map((row, i) => ({ ...row, [colName]: values[i] }))
      newColNames.push(colName)
    })

    // Strategy 3: for financial, always extract key series by name
    if (activeCategory === 'financial') {
      const financialCols = {
        'GARCH_volatility':   rawResult.garch_volatility || rawResult.GARCH_volatility,
        'Volatility_series':  rawResult.volatility_series,
        'Returns':            rawResult.volatility_series,  // returns are stored here
      }
      Object.entries(financialCols).forEach(([colName, values]) => {
        if (Array.isArray(values) && values.length === numRows && !newColNames.includes(colName)) {
          updated = updated.map((row, i) => ({ ...row, [colName]: values[i] }))
          newColNames.push(colName)
        }
      })
    }

    // Strategy 4: for regression, extract predicted and residuals
    if (activeCategory === 'regression') {
      const target = choices.target || 'Value'
      const regCols = {
        [`${target}_predicted`]: rawResult.predicted || rawResult.Regression_predicted,
        [`${target}_residual`]:  rawResult.residuals || rawResult.Regression_residual,
      }
      Object.entries(regCols).forEach(([colName, values]) => {
        if (Array.isArray(values) && values.length === numRows && !newColNames.includes(colName)) {
          updated = updated.map((row, i) => ({ ...row, [colName]: values[i] }))
          newColNames.push(colName)
        }
      })
    }

    // Strategy 5: for marketing, extract RFM/CLV/Churn per-row values
    if (activeCategory === 'marketing') {
      const mktCols = {
        'RFM_segment':    rawResult.rfm_values,
        'CLV_estimated':  rawResult.clv_values,
        'Churn_risk':     rawResult.churn_values,
      }
      Object.entries(mktCols).forEach(([colName, values]) => {
        if (Array.isArray(values) && values.length === numRows && !newColNames.includes(colName)) {
          updated = updated.map((row, i) => ({ ...row, [colName]: values[i] }))
          newColNames.push(colName)
        }
      })
    }

    // Strategy 6: for ML, extract predictions and cluster labels
    if (activeCategory === 'ml_models') {
      const mlCols = {
        'ML_prediction': rawResult.predictions || rawResult.ML_prediction,
      }
      Object.entries(mlCols).forEach(([colName, values]) => {
        if (Array.isArray(values) && values.length === numRows && !newColNames.includes(colName)) {
          updated = updated.map((row, i) => ({ ...row, [colName]: values[i] }))
          newColNames.push(colName)
        }
      })
    }

    // ── UPDATE STATE ───────────────────────────────────────────
    if (newColNames.length > 0) {
      console.log('New columns saved to memory:', newColNames)
      setMemoryData(updated)
      const newProf = reprofileWithDerived(updated, profile, newColNames)
      setProfile(newProf)
      setSlicers(detectSlicerColumns(updated, newProf))
    }

    setActiveCategory(null)
  } catch(e) {
    setAnalysisError(e.message)
  }
  setAnalysisLoading(false)
}

  const handleNextStep = (step, fromCat) => {
    const s = step.toLowerCase()
    let cat = fromCat
    if (s.includes('chart')||s.includes('plot')||s.includes('visuali')) cat='charts'
    else if (s.includes('regress')) cat='regression'
    else if (s.includes('ml')||s.includes('model')||s.includes('classif')||s.includes('cluster')) cat='ml_models'
    else if (s.includes('garch')||s.includes('var')||s.includes('sharpe')||s.includes('monte')) cat='financial'
    else if (s.includes('rfm')||s.includes('clv')||s.includes('churn')) cat='marketing'
    else if (s.includes('t-test')||s.includes('anova')||s.includes('statistic')) cat='stats_tests'
    else if (s.includes('eda')||s.includes('distribut')||s.includes('correlat')) cat='eda'
    else if (s.includes('export')||s.includes('report')||s.includes('pdf')) cat='report'
    setActiveCategory(cat); setAnalysisError(null)
    setTimeout(() => document.getElementById('analysis-panel')?.scrollIntoView({behavior:'smooth',block:'start'}), 100)
  }

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:600, color:'#1a1a18', marginBottom:4 }}>AI Data Analysis Agent</h1>
        <p style={{ fontSize:13, color:'#888' }}>Upload any Excel or CSV file. The agent reads your data and recommends what to analyse.</p>
      </div>

      {!pythonReady && (
        <div style={{ background:'#EEEDFE', border:'0.5px solid #534AB7', borderRadius:8, padding:'8px 12px', marginBottom:16, fontSize:11, color:'#3C3489' }}>
          ⏳ {pythonStatus}
        </div>
      )}

      {!filename && <FileUpload onDataLoaded={handleDataLoaded} pythonReady={pythonReady} />}

      {filename && (
        <>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f4f3f0', border:'0.5px solid #ddd', borderRadius:10, padding:'8px 14px', marginBottom:12, flexWrap:'wrap', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:13, fontWeight:500 }}>📁 {filename}</span>
              <span style={{ fontSize:11, color:'#888' }}>{memoryData.length.toLocaleString()} rows · {profile?.columnCount} cols</span>
              {results.length > 0 && <span style={{ fontSize:10, background:'#E1F5EE', color:'#085041', padding:'1px 7px', borderRadius:999, fontWeight:700 }}>{results.length} {results.length===1?'analysis':'analyses'} run</span>}
            </div>
            <button onClick={() => { setFilename(null); setRawData([]); setMemoryData([]); setResults([]); setProfile(null); setCategories([]) }} style={{ fontSize:11, padding:'3px 10px', borderRadius:999, border:'0.5px solid #ccc', background:'transparent', cursor:'pointer', color:'#555' }}>Upload different file</button>
          </div>

          {profile && Object.values(profile.columns).some(c => c.isDerived) && (
            <div style={{ background:'#EEEDFE', border:'0.5px solid #AFA9EC', borderRadius:8, padding:'7px 12px', marginBottom:12, display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
              <span style={{ fontSize:9, fontWeight:700, color:'#3C3489', textTransform:'uppercase', letterSpacing:'0.05em' }}>🧠 Memory</span>
              {Object.entries(profile.columns).filter(([,m]) => m.isDerived).map(([col]) => (
                <span key={col} style={{ fontSize:10, fontFamily:'monospace', background:'white', border:'0.5px solid #AFA9EC', color:'#3C3489', padding:'2px 7px', borderRadius:4 }}>{col}</span>
              ))}
            </div>
          )}

          <SlicerBar slicers={slicers} slicerState={slicerState} onChange={setSlicerState} totalRows={memoryData.length} filteredRows={filteredData.length} />

          {loadingCats && <div style={{ fontSize:12, color:'#888', marginBottom:12, fontStyle:'italic' }}>Agent is reading your data and selecting analysis types...</div>}

          {!activeCategory && categories.length > 0 && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:500, color:'#555', marginBottom:10 }}>{results.length===0 ? 'Select an analysis type to begin:' : 'Select another analysis (previous results saved below):'}</div>
              <Layer1Grid recommendedIds={categories} onSelect={cat => { setActiveCategory(cat); setAnalysisError(null) }} runHistory={results} />
            </div>
          )}

          <div id="analysis-panel">
            {activeCategory && <CategoryPanel category={activeCategory} profile={profile} filteredData={filteredData} onRun={handleRunAnalysis} onBack={() => setActiveCategory(null)} loading={analysisLoading} />}
          </div>

          {analysisError && <div style={{ background:'#FCEBEB', border:'0.5px solid #A32D2D', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#501313' }}>⚠️ {analysisError}</div>}

          {results.length > 0 && (
            <div>
              <div style={{ fontSize:12, fontWeight:500, color:'#555', marginBottom:10, marginTop:4 }}>Results ({results.length} {results.length===1?'run':'runs'}):</div>
              {results.map(r => <ResultsPanel key={r.id} result={r} onNextStep={handleNextStep} onChartBarClick={(col,val) => setSlicerState(prev => applyChartClick(prev,col,val))} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
