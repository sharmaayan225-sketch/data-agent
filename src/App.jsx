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
      const result = await runAnalysis({ category:activeCategory, choices, filteredData, profile })
      setResults(prev => [result, ...prev])
      if (result.newColumns?.length > 0) {
        const newColNames = result.newColumns.map(c => c.name)
        let updated = [...memoryData]
        newColNames.forEach(colName => {
          const values = result.result?.[colName] || []
          if (Array.isArray(values) && values.length === updated.length) {
            updated = updated.map((row,i) => ({ ...row, [colName]: values[i] }))
          }
        })
        setMemoryData(updated)
        const newProf = reprofileWithDerived(updated, profile, newColNames)
        setProfile(newProf); setSlicers(detectSlicerColumns(updated, newProf))
      }
      setActiveCategory(null)
    } catch(e) { setAnalysisError(e.message) }
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
