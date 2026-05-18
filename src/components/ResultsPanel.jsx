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
  if (!chartConfig || !data?.chartData || !Array.isArray(data.chartData) || data.chartData.length === 0) return null
  const { type, xKey, yKeys, colorBy } = chartConfig
  const yList = Array.isArray(yKeys) ? yKeys : (chartConfig.yKey ? [chartConfig.yKey] : [])
  if (!xKey || yList.length === 0) return null
  const chartData = data.chartData

  const wrap = (children) => (
    <div style={{ marginBottom:14 }}>
      {data.title && <div style={{ fontSize:12, fontWeight:600, color:'#555', marginBottom:8 }}>{data.title}</div>}
      <ResponsiveContainer width="100%" height={240}>{children}</ResponsiveContainer>
      {onBarClick && <div style={{ fontSize:10, color:'#aaa', marginTop:4 }}>💡 Click a bar to filter data by that value</div>}
    </div>
  )

  const handleClick = (e) => { if (e?.activeLabel && onBarClick) onBarClick(xKey, e.activeLabel) }

  if (type === 'pie') return wrap(
    <PieChart>
      <Pie data={chartData} dataKey={yList[0]} nameKey={xKey} cx="50%" cy="50%" outerRadius={90} label={e=>`${e[xKey]}: ${Math.round((e.percent||0)*100)}%`}>
        {chartData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
      </Pie><Tooltip />
    </PieChart>
  )
  if (type === 'scatter') return wrap(
    <ScatterChart><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
      <XAxis dataKey={xKey} tick={{fontSize:10}} /><YAxis dataKey={yList[0]} tick={{fontSize:10}} />
      <Tooltip /><Scatter data={chartData} fill={COLORS[0]} />
    </ScatterChart>
  )
  if (type === 'line' || type === 'area') return wrap(
    <LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
      <XAxis dataKey={xKey} tick={{fontSize:10}} /><YAxis tick={{fontSize:10}} />
      <Tooltip />{yList.length>1&&<Legend wrapperStyle={{fontSize:11}}/>}
      {yList.map((k,i) => <Line key={k} dataKey={k} stroke={COLORS[i%COLORS.length]} dot={false} strokeWidth={2} />)}
    </LineChart>
  )
  return wrap(
    <BarChart data={chartData} onClick={handleClick} style={{cursor:'pointer'}}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
      <XAxis dataKey={xKey} tick={{fontSize:10}} /><YAxis tick={{fontSize:10}} />
      <Tooltip />{yList.length>1&&<Legend wrapperStyle={{fontSize:11}}/>}
      {yList.map((k,i) => <Bar key={k} dataKey={k} fill={COLORS[i%COLORS.length]} />)}
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
