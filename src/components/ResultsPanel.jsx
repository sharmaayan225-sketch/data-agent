// src/components/ResultsPanel.jsx
import { BarChart, Bar, LineChart, Line, ScatterChart, Scatter, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'

const COLORS = ['#185FA5','#0F6E56','#534AB7','#993C1D','#854F0B','#A32D2D']
const LABELS = { charts:'Charts', eda:'EDA', data_quality:'Data quality', report:'Report', regression:'Regression', ml_models:'ML models', stats_tests:'Statistical tests', financial:'Financial', marketing:'Marketing', hr:'HR & people', operations:'Operations', text_nlp:'Text & NLP' }

export default function ResultsPanel({ result, onNextStep, onChartBarClick }) {
  if (!result) return null
  const { category, explanation, chartConfig, result: data, nextSteps, rowCount, timestamp } = result

  return (
    <div style={{ border:'0.5px solid #ddd', borderRadius:14, padding:'16px 18px', marginBottom:14, background:'white', animation:'fadeIn 0.15s ease' }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}`}</style>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:6 }}>
        <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', padding:'2px 8px', background:'#E6F1FB', color:'#0C447C', borderRadius:999 }}>{LABELS[category]||category}</div>
        <div style={{ fontSize:10, color:'#aaa' }}>{(rowCount||0).toLocaleString()} rows · {new Date(timestamp).toLocaleTimeString()}</div>
      </div>

      {explanation && (
        <div style={{ background:'#E1F5EE', borderLeft:'3px solid #0F6E56', borderRadius:'0 8px 8px 0', padding:'10px 12px', fontSize:13, color:'#085041', lineHeight:1.6, marginBottom:14 }}>
          {explanation}
        </div>
      )}

      <ChartRenderer chartConfig={chartConfig} data={data} onBarClick={onChartBarClick} />
      <MetricCards data={data} category={category} />

      {Array.isArray(nextSteps) && nextSteps.length > 0 && (
        <div style={{ marginTop:14 }}>
          <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#888', marginBottom:7 }}>What to do next</div>
          {nextSteps.map((step, i) => (
            <div key={i} onClick={() => onNextStep && onNextStep(step, category)}
              style={{ padding:'7px 12px', borderRadius:8, border:'0.5px solid #eee', marginBottom:4, fontSize:12, cursor:'pointer', background:'#fafaf8', transition:'all 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background='#E6F1FB'; e.currentTarget.style.borderColor='#185FA5'; e.currentTarget.style.color='#0C447C' }}
              onMouseLeave={e => { e.currentTarget.style.background='#fafaf8'; e.currentTarget.style.borderColor='#eee'; e.currentTarget.style.color='inherit' }}>
              → {step}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ChartRenderer({ chartConfig, data, onBarClick }) {
  const [hiddenSeries, setHiddenSeries] = useState([])
  const [refArea, setRefArea] = useState({ left: '', right: '' })
  const [zoomDomain, setZoomDomain] = useState(null)
  const [isSelecting, setIsSelecting] = useState(false)

  if (!chartConfig || !data?.chartData || !Array.isArray(data.chartData) || data.chartData.length === 0) return null

  const { type, xKey, yKeys, colorBy } = chartConfig
  const yList = Array.isArray(yKeys) ? yKeys : (chartConfig.yKey ? [chartConfig.yKey] : [])
  if (!xKey || yList.length === 0) return null

  const chartData = data.chartData
  const visibleData = zoomDomain
    ? chartData.filter((_, i) => i >= zoomDomain[0] && i <= zoomDomain[1])
    : chartData

  const toggleSeries = (dataKey) => {
    setHiddenSeries(prev =>
      prev.includes(dataKey) ? prev.filter(s => s !== dataKey) : [...prev, dataKey]
    )
  }

  const handleMouseDown = (e) => {
    if (!e) return
    setIsSelecting(true)
    setRefArea({ left: e.activeLabel, right: '' })
  }

  const handleMouseMove = (e) => {
    if (!isSelecting || !e) return
    setRefArea(prev => ({ ...prev, right: e.activeLabel }))
  }

  const handleMouseUp = () => {
    if (!isSelecting) return
    setIsSelecting(false)
    if (refArea.left === refArea.right || !refArea.right) {
      setRefArea({ left: '', right: '' })
      return
    }
    const leftIdx = chartData.findIndex(d => String(d[xKey]) === String(refArea.left))
    const rightIdx = chartData.findIndex(d => String(d[xKey]) === String(refArea.right))
    if (leftIdx !== -1 && rightIdx !== -1) {
      const [l, r] = leftIdx < rightIdx ? [leftIdx, rightIdx] : [rightIdx, leftIdx]
      setZoomDomain([l, r])
    }
    setRefArea({ left: '', right: '' })
  }

  const resetZoom = () => { setZoomDomain(null); setRefArea({ left: '', right: '' }) }

  // Format X axis labels — show date if available
  const formatXAxis = (val) => {
    if (!val) return ''
    const str = String(val)
    // If it looks like a date string, shorten it
    if (str.includes('-') && str.length > 8) {
      try {
        const d = new Date(str)
        if (!isNaN(d)) return `${d.getDate()}-${d.toLocaleString('default',{month:'short'})}`
      } catch { }
    }
    // If numeric index, just show every 20th
    return str.length > 10 ? str.slice(0, 8) + '..' : str
  }

  // Custom legend with click-to-toggle
  const renderLegend = () => (
    <div style={{ display:'flex', justifyContent:'center', gap:16, marginTop:8, flexWrap:'wrap' }}>
      {yList.map((key, i) => {
        const hidden = hiddenSeries.includes(key)
        return (
          <div key={key} onClick={() => toggleSeries(key)}
            style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer',
              opacity: hidden ? 0.35 : 1, transition:'opacity 0.2s',
              padding:'3px 10px', borderRadius:999,
              border: `1px solid ${COLORS[i % COLORS.length]}`,
              background: hidden ? 'transparent' : `${COLORS[i % COLORS.length]}18`
            }}>
            <div style={{ width:10, height:10, borderRadius:2, background: hidden ? '#ccc' : COLORS[i % COLORS.length] }} />
            <span style={{ fontSize:11, color: hidden ? '#aaa' : '#555' }}>{key}</span>
            <span style={{ fontSize:9, color:'#aaa' }}>{hidden ? '(hidden)' : '(click to hide)'}</span>
          </div>
        )
      })}
    </div>
  )

  const commonProps = {
    data: visibleData,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
  }

  const wrap = (children) => (
    <div style={{ marginBottom:14, userSelect:'none' }}>
      {data.title && <div style={{ fontSize:12, fontWeight:600, color:'#555', marginBottom:4 }}>{data.title}</div>}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, flexWrap:'wrap', gap:6 }}>
        <div style={{ fontSize:10, color:'#aaa' }}>
          🔍 Click and drag on chart to zoom in
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {zoomDomain && (
            <button onClick={resetZoom} style={{ fontSize:10, padding:'2px 8px', borderRadius:999, border:'0.5px solid #185FA5', background:'#E6F1FB', color:'#185FA5', cursor:'pointer' }}>
              Reset zoom
            </button>
          )}
          {onBarClick && (
            <div style={{ fontSize:10, color:'#aaa' }}>💡 Click a bar to filter</div>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        {children}
      </ResponsiveContainer>
      {renderLegend()}
    </div>
  )

  if (type === 'pie') return wrap(
    <PieChart>
      <Pie data={visibleData} dataKey={yList[0]} nameKey={xKey} cx="50%" cy="50%" outerRadius={90}
        label={e => `${e[xKey]}: ${Math.round((e.percent||0)*100)}%`}>
        {visibleData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
      </Pie>
      <Tooltip />
    </PieChart>
  )

  if (type === 'scatter') return wrap(
    <ScatterChart {...commonProps}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
      <XAxis dataKey={xKey} tick={{ fontSize:10 }} tickFormatter={formatXAxis} />
      <YAxis tick={{ fontSize:10 }} />
      <Tooltip />
      <Scatter data={visibleData} fill={COLORS[0]} />
    </ScatterChart>
  )

  if (type === 'line' || type === 'area') return wrap(
    <LineChart {...commonProps}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
      <XAxis dataKey={xKey} tick={{ fontSize:9 }} tickFormatter={formatXAxis} interval="preserveStartEnd" />
      <YAxis tick={{ fontSize:10 }} />
      <Tooltip labelFormatter={(label) => `Date: ${label}`} />
      {yList.map((k, i) => (
        !hiddenSeries.includes(k) &&
        <Line key={k} dataKey={k} stroke={COLORS[i % COLORS.length]}
          dot={false} strokeWidth={2} hide={hiddenSeries.includes(k)} />
      ))}
      {refArea.left && refArea.right && (
        <ReferenceArea x1={refArea.left} x2={refArea.right} strokeOpacity={0.3} fill="#185FA5" fillOpacity={0.1} />
      )}
    </LineChart>
  )

  // Default bar chart
  return wrap(
    <BarChart {...commonProps} onClick={(e) => { if (e?.activeLabel && onBarClick) onBarClick(xKey, e.activeLabel) }}
      style={{ cursor: onBarClick ? 'pointer' : 'default' }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
      <XAxis dataKey={xKey} tick={{ fontSize:9 }} tickFormatter={formatXAxis} interval="preserveStartEnd" />
      <YAxis tick={{ fontSize:10 }} />
      <Tooltip labelFormatter={(label) => `${xKey}: ${label}`} />
      {yList.map((k, i) => (
        !hiddenSeries.includes(k) &&
        <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} />
      ))}
      {refArea.left && refArea.right && (
        <ReferenceArea x1={refArea.left} x2={refArea.right} strokeOpacity={0.3} fill="#185FA5" fillOpacity={0.1} />
      )}
    </BarChart>
  )
}

function MetricCards({ data, category }) {
  if (!data) return null
  const metrics = []
  if (category==='regression') {
    if (data.r_squared!=null) metrics.push({label:'R²',value:Number(data.r_squared).toFixed(3)})
    if (data.adj_r_squared!=null) metrics.push({label:'Adj R²',value:Number(data.adj_r_squared).toFixed(3)})
  }
  if (category==='ml_models') {
    if (data.accuracy_or_r2!=null) metrics.push({label:data.task_type==='regression'?'R²':'Accuracy',value:(Number(data.accuracy_or_r2)*100).toFixed(1)+'%'})
    if (data.n_train!=null) metrics.push({label:'Train rows',value:data.n_train})
  }
  if (category==='financial') {
    if (data.sharpe_ratio!=null) metrics.push({label:'Sharpe',value:Number(data.sharpe_ratio).toFixed(3)})
    if (data.var_95!=null) metrics.push({label:'VaR 95%',value:(Number(data.var_95)*100).toFixed(2)+'%'})
    if (data.max_drawdown!=null) metrics.push({label:'Max DD',value:(Number(data.max_drawdown)*100).toFixed(1)+'%'})
  }
  if (category==='marketing') {
    if (data.churn_rate!=null) metrics.push({label:'Churn rate',value:(Number(data.churn_rate)*100).toFixed(1)+'%'})
    if (data.active_customers!=null) metrics.push({label:'Active',value:data.active_customers})
  }
  if (category==='hr') {
    if (data.attrition_rate!=null) metrics.push({label:'Attrition',value:Number(data.attrition_rate).toFixed(1)+'%'})
    if (data.headcount!=null) metrics.push({label:'Headcount',value:data.headcount})
  }
  if (category==='stats_tests') {
    if (data.p_value!=null) metrics.push({label:'p-value',value:Number(data.p_value)<0.001?'<0.001':Number(data.p_value).toFixed(4)})
    metrics.push({label:'Significant?',value:data.reject_null?'Yes ✓':'No ✗'})
  }
  if (category==='data_quality') {
    if (data.quality_score!=null) metrics.push({label:'Quality score',value:Number(data.quality_score).toFixed(0)+'/100'})
    if (data.duplicate_count!=null) metrics.push({label:'Duplicates',value:data.duplicate_count})
  }
  if (!metrics.length) return null
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
      {metrics.map((m,i) => (
        <div key={i} style={{ background:'#f4f3f0', borderRadius:8, padding:'8px 14px', minWidth:80 }}>
          <div style={{ fontSize:10, color:'#888', marginBottom:3 }}>{m.label}</div>
          <div style={{ fontSize:16, fontWeight:600, color:'#1a1a18' }}>{m.value}</div>
        </div>
      ))}
    </div>
  )
}
