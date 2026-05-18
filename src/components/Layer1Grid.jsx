// src/components/Layer1Grid.jsx
const CATEGORY_META = {
  charts:       { label:'Charts',            icon:'📊', color:'#0C447C', bg:'#E6F1FB', border:'#185FA5', desc:'Visualise patterns · click bars to filter' },
  eda:          { label:'EDA',               icon:'🔍', color:'#633806', bg:'#FAEEDA', border:'#854F0B', desc:'Distributions · correlations · outliers' },
  data_quality: { label:'Data quality',      icon:'🧹', color:'#3C3489', bg:'#EEEDFE', border:'#534AB7', desc:'Nulls · duplicates · fix issues' },
  report:       { label:'Report & export',   icon:'📄', color:'#4A1B0C', bg:'#FAECE7', border:'#993C1D', desc:'Summary · insights · export' },
  regression:   { label:'Regression',        icon:'📈', color:'#085041', bg:'#E1F5EE', border:'#0F6E56', desc:'Predict numeric outcomes' },
  ml_models:    { label:'ML models',         icon:'🤖', color:'#3C3489', bg:'#EEEDFE', border:'#534AB7', desc:'Classify · cluster · forecast' },
  stats_tests:  { label:'Statistical tests', icon:'🧮', color:'#4A1B0C', bg:'#FAECE7', border:'#993C1D', desc:'t-test · ANOVA · chi-square · A/B' },
  financial:    { label:'Financial',         icon:'💰', color:'#501313', bg:'#FCEBEB', border:'#A32D2D', desc:'GARCH · VaR · Monte Carlo · Sharpe' },
  marketing:    { label:'Marketing',         icon:'📣', color:'#4B1528', bg:'#FBEAF0', border:'#993556', desc:'RFM · CLV · churn · attribution' },
  hr:           { label:'HR & people',       icon:'👥', color:'#04342C', bg:'#E1F5EE', border:'#1D9E75', desc:'Attrition · pay equity · workforce' },
  operations:   { label:'Operations',        icon:'⚙️', color:'#633806', bg:'#FAEEDA', border:'#854F0B', desc:'OEE · SPC · ABC · demand forecast' },
  text_nlp:     { label:'Text & NLP',        icon:'📝', color:'#2C2C2A', bg:'#F1EFE8', border:'#5F5E5A', desc:'Sentiment · keywords · topics' },
}
const ALWAYS = ['charts','eda','data_quality','report']

export default function Layer1Grid({ recommendedIds, onSelect, runHistory = [] }) {
  const ordered = [...ALWAYS, ...Object.keys(CATEGORY_META).filter(id => !ALWAYS.includes(id) && (recommendedIds||[]).includes(id))]
  const always = ordered.filter(id => ALWAYS.includes(id))
  const conditional = ordered.filter(id => !ALWAYS.includes(id))

  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#888', marginBottom:8 }}>Always available</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(145px,1fr))', gap:8, marginBottom:conditional.length ? 14 : 0 }}>
        {always.map(id => <CategoryCard key={id} id={id} onSelect={onSelect} runHistory={runHistory} />)}
      </div>
      {conditional.length > 0 && <>
        <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#888', marginBottom:8 }}>Detected in your data</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(145px,1fr))', gap:8 }}>
          {conditional.map(id => <CategoryCard key={id} id={id} onSelect={onSelect} runHistory={runHistory} />)}
        </div>
      </>}
    </div>
  )
}

function CategoryCard({ id, onSelect, runHistory }) {
  const meta = CATEGORY_META[id]; if (!meta) return null
  const timesRun = (runHistory||[]).filter(r => r.category === id).length
  return (
    <div onClick={() => onSelect(id)}
      style={{ background:meta.bg, border:`1.5px solid ${meta.border}`, borderRadius:12, padding:'10px 12px', cursor:'pointer', position:'relative', transition:'transform 0.13s', userSelect:'none' }}
      onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform='none'}>
      {timesRun > 0 && <div style={{ position:'absolute', top:6, right:7, fontSize:8, background:'#E1F5EE', color:'#085041', padding:'1px 5px', borderRadius:999, fontWeight:700 }}>ran {timesRun}×</div>}
      <div style={{ fontSize:20, marginBottom:4 }}>{meta.icon}</div>
      <div style={{ fontSize:12, fontWeight:600, color:meta.color, marginBottom:3 }}>{meta.label}</div>
      <div style={{ fontSize:10, color:meta.border, lineHeight:1.4 }}>{meta.desc}</div>
    </div>
  )
}
