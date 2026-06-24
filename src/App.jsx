import { useState, useEffect, useCallback } from 'react'
import { Search } from 'lucide-react'
import ChatWidget from './components/ChatWidget'
 
 
const s = {
  // Layout
  page:       { display:'flex', flexDirection:'column', minHeight:'100vh' },
  header:     { background:'var(--white)', borderBottom:'5px solid var(--ochre)', boxShadow:'0 2px 8px rgba(43,41,38,.08)' },
  headerInner:{ maxWidth:1000, margin:'0 auto', padding:'20px 24px', display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' },
  logo:       { height:52, width:'auto', flexShrink:0 },
  headerDiv:  { borderLeft:'2px solid var(--grey-light)', paddingLeft:20 },
  h1:         { fontFamily:"'Playfair Display', Georgia, serif", fontSize:'1.3rem', fontWeight:700, color:'var(--maroon)' },
  sub:        { fontSize:'0.88rem', color:'var(--grey)', marginTop:4 },
  main:       { maxWidth:1000, margin:'0 auto', padding:'32px 24px 60px', flex:1, width:'100%' },
 
  // Search card
  card:       { background:'var(--white)', border:'1px solid var(--grey-light)', borderLeft:'6px solid var(--ochre)', borderRadius:6, padding:24, boxShadow:'0 2px 10px rgba(43,41,38,.06)' },
  label:      { display:'block', fontSize:'0.74rem', textTransform:'uppercase', letterSpacing:'1px', color:'var(--maroon)', fontWeight:700, marginBottom:8 },
  row:        { display:'flex', gap:10, flexWrap:'wrap' },
  inputWrap:  { flex:1, minWidth:200, position:'relative', display:'flex', alignItems:'center' },
  searchIcon: { position:'absolute', left:14, color:'var(--grey)', pointerEvents:'none' },
  input:      { width:'100%', padding:'12px 14px 12px 42px', fontSize:'1rem', border:'2px solid var(--grey-light)', borderRadius:5, fontFamily:'Inter, sans-serif', outline:'none' },
  select:     { padding:'12px 14px', border:'2px solid var(--grey-light)', borderRadius:5, fontFamily:'Inter, sans-serif', background:'var(--white)', color:'var(--charcoal)', fontSize:'0.92rem' },
  hint:       { fontSize:'0.8rem', color:'var(--grey)', marginTop:10 },
 
  // Stats
  statsRow:   { display:'flex', gap:14, marginTop:22, flexWrap:'wrap' },
  statBox:    { flex:1, minWidth:130, background:'var(--white)', border:'1px solid var(--grey-light)', borderRadius:6, padding:'14px 16px', textAlign:'center' },
  statNum:    { fontSize:'1.5rem', fontWeight:800, color:'var(--maroon)' },
  statLbl:    { fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--grey)', marginTop:2 },
 
  // Results
  count:      { fontSize:'0.84rem', color:'var(--grey)', margin:'18px 2px 10px' },
  resultCard: { background:'var(--white)', border:'1px solid var(--grey-light)', borderLeft:'4px solid var(--terracotta)', borderRadius:6, padding:'18px 20px', marginBottom:12, display:'flex', justifyContent:'space-between', gap:16, alignItems:'flex-start', flexWrap:'wrap' },
  resultTitle:{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:'1.05rem', fontWeight:700, color:'var(--maroon)', marginBottom:6 },
  resultMeta: { fontSize:'0.84rem', color:'var(--grey)', lineHeight:1.6 },
  metaB:      { color:'var(--charcoal)', fontWeight:600 },
 
  // Badges
  badgeYes:   { background:'var(--sage)',    color:'var(--white)', fontWeight:700, fontSize:'0.74rem', textTransform:'uppercase', letterSpacing:'0.5px', padding:'7px 14px', borderRadius:20, whiteSpace:'nowrap' },
  badgeNo:    { background:'var(--red)',     color:'var(--white)', fontWeight:700, fontSize:'0.74rem', textTransform:'uppercase', letterSpacing:'0.5px', padding:'7px 14px', borderRadius:20, whiteSpace:'nowrap' },
  badgeAmber: { background:'#B97D1F',        color:'var(--white)', fontWeight:700, fontSize:'0.74rem', textTransform:'uppercase', letterSpacing:'0.5px', padding:'7px 14px', borderRadius:20, whiteSpace:'nowrap' },
 
  // Empty / welcome
  empty:      { textAlign:'center', padding:'50px 20px', color:'var(--grey)', fontSize:'0.92rem' },
 
  // Footer
  footer:     { background:'var(--maroon)', color:'var(--grey-light)', textAlign:'center', padding:22, fontSize:'0.8rem' },
  footerSpan: { color:'var(--ochre-light)' },
}
 
function Badge({ qualify }) {
  if (qualify === 'Yes') return <span style={s.badgeYes}>Accredited</span>
  if (qualify === 'No')  return <span style={s.badgeNo}>Not Accredited</span>
  return <span style={s.badgeAmber}>Check Status</span>
}
 
function Stats({ data }) {
  const total      = data.length
  const accredited = data.filter(r => r[4] === 'Yes').length
  const notAcc     = data.filter(r => r[4] === 'No').length
  const publishers = new Set(data.map(r => r[5]).filter(Boolean)).size
  const boxes = [
    { num: total,      lbl: 'Journals Listed', border: 'var(--maroon)' },
    { num: accredited, lbl: 'Accredited',       border: 'var(--sage)' },
    { num: notAcc,     lbl: 'Not Accredited',   border: 'var(--red)' },
    { num: publishers, lbl: 'Publishers',        border: 'var(--ochre)' },
  ]
  return (
    <div style={s.statsRow}>
      {boxes.map(b => (
        <div key={b.lbl} style={{ ...s.statBox, borderTop:`4px solid ${b.border}` }}>
          <div style={s.statNum}>{b.num.toLocaleString()}</div>
          <div style={s.statLbl}>{b.lbl}</div>
        </div>
      ))}
    </div>
  )
}
 
export default function App() {
  const [query, setQuery]     = useState('')
  const [type, setType]       = useState('title')
  const [results, setResults] = useState(null)
  const [data, setData]       = useState([])
 
  // Load journal data from public/journals_data.json
  useEffect(() => {
    fetch('journals_data.json')
      .then(r => r.json())
      .then(setData)
      .catch(err => console.error('Failed to load journal data:', err))
  }, [])
 
  const search = useCallback((q, t) => {
    if (!q.trim()) { setResults(null); return }
    const lower = q.toLowerCase()
    if (t === 'issn') {
      const qn = lower.replace(/[^0-9x]/g, '')
      setResults(data.filter(r => {
        const issn  = (r[1] || '').replace(/[^0-9x]/g, '')
        const eissn = (r[2] || '').replace(/[^0-9x]/g, '')
        return (issn && issn.includes(qn)) || (eissn && eissn.includes(qn))
      }))
    } else {
      setResults(data.filter(r => r[0] && r[0].toLowerCase().includes(lower)))
    }
  }, [data])
 
  useEffect(() => {
    const t = setTimeout(() => search(query, type), 120)
    return () => clearTimeout(t)
  }, [query, type, search])
 
  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <img src="logo.png" alt="iYunivesithi Walter Sisulu" style={s.logo} />
          <div style={s.headerDiv}>
            <h1 style={s.h1}>Library and Information Services</h1>
            <p style={s.sub}>DHET Accredited Journal List · 2026–2027</p>
          </div>
        </div>
      </header>
 
      {/* Main */}
      <main style={s.main}>
        {/* Search card */}
        <div style={s.card}>
          <label style={s.label}>Search by journal title or ISSN / eISSN</label>
          <div style={s.row}>
            <div style={s.inputWrap}>
              <Search size={17} style={s.searchIcon} />
              <input
                style={s.input}
                type="text"
                placeholder="e.g. South African Journal of Science, or 0038-2353"
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoComplete="off"
              />
            </div>
            <select style={s.select} value={type} onChange={e => setType(e.target.value)}>
              <option value="title">Title</option>
              <option value="issn">ISSN / eISSN</option>
            </select>
          </div>
          <p style={s.hint}>Start typing — results update as you go. Source: DHET Master Journal List.</p>
        </div>
 
        {/* Results */}
        {results === null ? (
          <>
            <p style={{ ...s.empty, paddingTop:40 }}>Search for a journal above to check its DHET accreditation status.</p>
            {data.length > 0 && <Stats data={data} />}
          </>
        ) : results.length === 0 ? (
          <p style={s.empty}>No journal found matching "{query}". Try a partial title or search by ISSN.</p>
        ) : (
          <>
            <p style={s.count}>{results.length.toLocaleString()} result{results.length !== 1 ? 's' : ''} found</p>
            {results.slice(0, 100).map((r, i) => {
              const [title, issn, eissn, status, qualify, publisher] = r
              return (
                <div key={i} style={s.resultCard}>
                  <div style={{ flex:1, minWidth:240 }}>
                    <p style={s.resultTitle}>{title}</p>
                    <div style={s.resultMeta}>
                      {issn  && <><span style={s.metaB}>ISSN:</span> {issn}&nbsp;&nbsp;</>}
                      {eissn && <><span style={s.metaB}>eISSN:</span> {eissn}<br /></>}
                      {!eissn && <br />}
                      {publisher && <><span style={s.metaB}>Publisher:</span> {publisher}<br /></>}
                      {status    && <><span style={s.metaB}>Status:</span> {status}</>}
                    </div>
                  </div>
                  <Badge qualify={qualify} />
                </div>
              )
            })}
            {results.length > 100 && (
              <p style={{ ...s.hint, textAlign:'center', marginTop:8 }}>
                Showing first 100 of {results.length.toLocaleString()} — refine your search for a precise match.
              </p>
            )}
          </>
        )}
      </main>
 
      {/* Footer */}
      <footer style={s.footer}>
        Walter Sisulu Library and Information Services &nbsp;·&nbsp;
        Contact your <span style={s.footerSpan}>Faculty Librarian</span> for accreditation queries &nbsp;·&nbsp;
        Source: DHET
      </footer>
 
      {/* Floating chat */}
      <ChatWidget />
    </div>
  )
}