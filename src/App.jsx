// src/App.jsx
import { useState, useEffect, useRef } from 'react'
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
  const [pythonReady, setPythonReady]       = useState(false)
  const [pythonStatus, setPythonStatus]     = useState('Loading Python...')
  const [filename, setFilename]             = useState(null)
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

  // Use a ref so handleRunAnalysis always sees latest memoryData
  const memoryRef = useRef([])
  const profileRef = useRef(null)

  useEffect(() => {
    memoryRef.current = memoryData
  }, [memoryData])

  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  useEffect(() => {
    initPython(s => setPythonStatus(s))
      .then(() => setPythonReady(true))
      .catch(e => setPythonStatus('Python error: ' + e.message))
  }, [])

  useEffect(() => {
    if (memoryData.length > 0) {
      setFilteredData(applySlicers(memoryData, slicerState))
    }
  }, [slicerState, memoryData])

  const handleDataLoaded = async (data, fname) => {
    setFilename(fname)
    setMemoryData(data)
    memoryRef.current = data
    setFilteredData(data)
    setSlicerState({})
    setResults([])
    setActiveCategory(null)
    setAnalysisError(null)
    const prof = profileData(data)
    setProfile(prof)
    profileRef.current = prof
    setSlicers(detectSlicerColumns(data, prof))
    setLoadingCats(true)
    try { setCategories(await getRecommendedCategories(prof)) }
    catch { setCategories(['charts','eda','data_quality','report']) }
    setLoadingCats(false)
  }

  const handleRunAnalysis = async (choices) => {
    setAnalysisLoading(true)
    setAnalysisError(null)
    try {
      const currentData = memoryRef.current
      const currentProfile = profileRef.current

      const result = await runAnalysis({
        category: activeCategory,
        choices,
        filteredData: applySlicers(currentData, slicerState),
        profile: currentProfile
      })

      setResults(prev => [result, ...prev])

      // ── EXTRACT ALL PER-ROW ARRAYS AND SAVE TO MEMORY ──────
      const rawResult = result.result || {}
      const numRows = currentData.length
      let updated = [...currentData]
      const newColNames = []

      // Scan every key in the result for arrays matching row count
      Object.entries(rawResult).forEach(([key, values]) => {
        if (!Array.isArray(values)) return
        if (values.length !== numRows) return
        if (['chartData', '__error', '__code'].includes(key)) return

        // Clean column name
        const colName = [
          'GARCH_volatility','Returns','Volatility_series',
          'RFM_segment','CLV_estimated','Churn_risk',
          'ML_prediction','Regression_predicted','Regression_residual'
        ].includes(key) ? key : `${activeCategory}_${key}`

        updated = updated.map((row, i) => ({
          ...row,
          [colName]: values[i] !== undefined ? values[i] : null
        }))
        newColNames.push(colName)
        console.log(`✓ Saved column: ${colName} (${values.length} values)`)
      })

      // Also check known column names by alias
      const aliases = {
        financial: {
          'GARCH_volatility': rawResult.garch_volatility || rawResult.GARCH_volatility,
          'Returns':          rawResult.volatility_series || rawResult.Returns,
        },
        regression: {
          'Regression_predicted': rawResult.predicted || rawResult.Regression_predicted,
          'Regression_residual':  rawResult.residuals || rawResult.Regression_residual,
        },
        ml_models: {
          'ML_prediction': rawResult.predictions || rawResult.ML_prediction,
        },
        marketing: {
          'RFM_segment':   rawResult.rfm_values,
          'CLV_estimated': rawResult.clv_values,
          'Churn_risk':    rawResult.churn_values,
        }
      }

      const catAliases = aliases[activeCategory] || {}
      Object.entries(catAliases).forEach(([colName, values]) => {
        if (!Array.isArray(values)) return
        if (newColNames.includes(colName)) return  // already saved
        // Pad or trim to match row count
        let padded = [...values]
        while (padded.length < numRows) padded.unshift(null)
        padded = padded.slice(-numRows)
        updated = updated.map((row, i) => ({ ...row, [colName]: padded[i] }))
        newColNames.push(colName)
        console.log(`✓ Saved aliased column: ${colName} (${padded.length} values)`)
      })

      // Update state with new columns
      if (newColNames.length > 0) {
        console.log('All new columns saved to memory:', newColNames)
        const newProf = reprofileWithDerived(updated, currentProfile, newColNames)
        // Update refs immediately so next render uses correct data
        memoryRef.current = updated
        profileRef.current = newProf
        // Then update state
        setMemoryData(updated)
        setProfile(newProf)
        setSlicers(detectSlicerColumns(updated, newProf))
      } else {
        console.warn('No per-row arrays found in result. Nothing saved to memory.')
        console.log('Result keys:', Object.keys(rawResult))
      }

      // Small delay before returning to Layer 1 so state updates settle
      await new Promise(r => setTimeout(r, 150))
      setActiveCategory(null)

    } catch(e) {
      console.error('Analysis error:', e)
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
    else if (s.includes('export')||s.includes('report')) cat='report'
    setActiveCategory(cat)
    setAnalysisError(null)
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
          {/* Session bar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f4f3f0', border:'0.5px solid #ddd', borderRadius:10, padding:'8px 14px', marginBottom:12, flexWrap:'wrap', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:13, fontWeight:500 }}>📁 {filename}</span>
              <span style={{ fontSize:11, color:'#888' }}>{memoryData.length.toLocaleString()} rows · {profile?.columnCount} cols</span>
              {results.length > 0 && <span style={{ fontSize:10, background:'#E1F5EE', color:'#085041', padding:'1px 7px', borderRadius:999, fontWeight:700 }}>{results.length} {results.length===1?'analysis':'analyses'} run</span>}
            </div>
            <button onClick={() => { setFilename(null); setMemoryData([]); setResults([]); setProfile(null); setCategories([]) }}
              style={{ fontSize:11, padding:'3px 10px', borderRadius:999, border:'0.5px solid #ccc', background:'transparent', cursor:'pointer', color:'#555' }}>
              Upload different file
            </button>
          </div>

          {/* Memory strip — shows derived columns */}
          {profile && Object.values(profile.columns).some(c => c.isDerived) && (
            <div style={{ background:'#EEEDFE', border:'0.5px solid #AFA9EC', borderRadius:8, padding:'7px 12px', marginBottom:12, display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
              <span style={{ fontSize:9, fontWeight:700, color:'#3C3489', textTransform:'uppercase', letterSpacing:'0.05em' }}>🧠 Memory</span>
              {Object.entries(profile.columns).filter(([,m]) => m.isDerived).map(([col]) => (
                <span key={col} style={{ fontSize:10, fontFamily:'monospace', background:'white', border:'0.5px solid #AFA9EC', color:'#3C3489', padding:'2px 7px', borderRadius:4 }}>{col}</span>
              ))}
            </div>
          )}

          {/* Slicer bar */}
          <SlicerBar slicers={slicers} slicerState={slicerState} onChange={setSlicerState} totalRows={memoryData.length} filteredRows={filteredData.length} />

          {loadingCats && <div style={{ fontSize:12, color:'#888', marginBottom:12, fontStyle:'italic' }}>Agent is reading your data...</div>}

          {/* Layer 1 grid */}
          {!activeCategory && categories.length > 0 && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:500, color:'#555', marginBottom:10 }}>
                {results.length === 0 ? 'Select an analysis type to begin:' : 'Select another analysis (previous results saved below):'}
              </div>
              <Layer1Grid recommendedIds={categories} onSelect={cat => { setActiveCategory(cat); setAnalysisError(null) }} runHistory={results} />
            </div>
          )}

          {/* Category panel */}
          <div id="analysis-panel">
            {activeCategory && (
              <CategoryPanel category={activeCategory} profile={profile} filteredData={filteredData}
                onRun={handleRunAnalysis} onBack={() => setActiveCategory(null)} loading={analysisLoading} />
            )}
          </div>

          {analysisError && (
            <div style={{ background:'#FCEBEB', border:'0.5px solid #A32D2D', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#501313' }}>
              ⚠️ {analysisError}
            </div>
          )}

          {/* All results */}
          {results.length > 0 && (
            <div>
              <div style={{ fontSize:12, fontWeight:500, color:'#555', marginBottom:10, marginTop:4 }}>
                Results ({results.length} {results.length===1?'run':'runs'}):
              </div>
              {results.map(r => (
                <ResultsPanel key={r.id} result={r} onNextStep={handleNextStep}
                  onChartBarClick={(col, val) => setSlicerState(prev => applyChartClick(prev, col, val))} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
