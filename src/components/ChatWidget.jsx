import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'
 
const PROXY_URL = '/api/chat'   // Vercel serverless function
 
const CHIPS = [
  { label: 'iWS Libraries',  prompt: 'Tell me about the iYunivesithi Walter Sisulu Libraries — locations, hours, and services.' },
  { label: 'LibGuides page', prompt: 'What resources are available on the Walter Sisulu University LibGuides page?' },
  { label: 'Research tools', prompt: 'What research tools does iWS Library offer for students and researchers?' },
]
 
const css = `
  .chat-fab {
    position: fixed; bottom: 28px; right: 28px;
    width: 56px; height: 56px; border-radius: 50%;
    background: #551516; border: 3px solid #CF8029;
    color: #fff; cursor: pointer;
    box-shadow: 0 4px 18px rgba(85,21,22,.35);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000; transition: transform .15s;
  }
  .chat-fab:hover { transform: scale(1.08); }
  .chat-panel {
    position: fixed; bottom: 96px; right: 28px;
    width: 360px; max-height: 520px;
    display: flex; flex-direction: column;
    background: #fff;
    border: 1px solid #E4DFD6; border-top: 4px solid #CF8029;
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(43,41,38,.18);
    z-index: 999; overflow: hidden;
    transition: opacity .2s, transform .2s;
  }
  .chat-panel.hidden { opacity: 0; pointer-events: none; transform: translateY(12px); }
  .chat-hdr {
    background: #551516; color: #fff;
    padding: 12px 16px;
    display: flex; align-items: center; gap: 8px;
    font-family: Inter, sans-serif;
  }
  .chat-dot { width:8px; height:8px; border-radius:50%; background:#CF8029; flex-shrink:0; }
  .chat-hdr-text { flex:1; }
  .chat-hdr-title { font-size:.9rem; font-weight:700; }
  .chat-hdr-sub { font-size:.72rem; color:#E0A35E; margin-top:1px; }
  .chat-close { background:none; border:none; color:#D8D2C9; cursor:pointer; display:flex; }
  .chat-chips { display:flex; flex-wrap:wrap; gap:6px; padding:10px 12px 4px; border-bottom:1px solid #E4DFD6; }
  .chip {
    font-family: Inter, sans-serif; font-size:.74rem;
    padding: 5px 11px; border: 1.5px solid #CF8029;
    border-radius: 16px; color: #551516; background: #F7F3EA;
    cursor: pointer; transition: background .12s, color .12s;
  }
  .chip:hover { background:#CF8029; color:#fff; }
  .chat-msgs {
    flex:1; overflow-y:auto; padding:14px;
    display:flex; flex-direction:column; gap:10px;
    font-family: Inter, sans-serif; font-size:.88rem;
  }
  .msg { max-width:88%; padding:9px 13px; border-radius:14px; line-height:1.45; word-break:break-word; }
  .msg.bot { background:#F7F3EA; border:1px solid #E4DFD6; align-self:flex-start; border-bottom-left-radius:4px; color:#2B2926; }
  .msg.user { background:#551516; color:#fff; align-self:flex-end; border-bottom-right-radius:4px; }
  .msg.typing { color:#6E6660; font-style:italic; }
  .chat-input-row {
    display:flex; gap:8px; padding:10px 12px;
    border-top:1px solid #E4DFD6; background:#fff;
  }
  .chat-input {
    flex:1; padding:9px 12px; border:2px solid #E4DFD6;
    border-radius:20px; font-size:.88rem; font-family:Inter,sans-serif; outline:none;
  }
  .chat-input:focus { border-color:#CF8029; }
  .chat-send {
    background:#551516; border:none; border-radius:50%;
    width:36px; height:36px; display:flex; align-items:center; justify-content:center;
    cursor:pointer; color:#fff; flex-shrink:0; transition:background .15s;
  }
  .chat-send:hover { background:#7A2426; }
  .chat-send:disabled { background:#E4DFD6; cursor:not-allowed; }
  @media(max-width:420px){ .chat-panel{width:calc(100vw - 24px);right:12px;} }
`
 
export default function ChatWidget() {
  const [open, setOpen]       = useState(false)
  const [msgs, setMsgs]       = useState([{ role:'bot', text:'Hi! I\'m LibAI, the iWS Library Assistant. Ask me anything about library and information services.' }])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const history               = useRef([])
  const msgsEl                = useRef(null)
 
  useEffect(() => { if (msgsEl.current) msgsEl.current.scrollTop = msgsEl.current.scrollHeight }, [msgs])
 
  async function send(text) {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    setMsgs(m => [...m, { role:'user', text:q }])
    history.current.push({ role:'user', content:q })
    setLoading(true)
    setMsgs(m => [...m, { role:'bot typing', text:'Thinking…' }])
 
    try {
      const res  = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: history.current, model:'gpt-4o' })
      })
      const data = await res.json()
 
      // Azure AI Foundry Responses API — try every known shape
      const reply =
        // output_text type (most common in Foundry agents)
        data?.output?.find?.(o => o.type === 'message')
          ?.content?.find?.(c => c.type === 'output_text' || c.type === 'text')?.text ||
        // flat output array
        data?.output?.[0]?.content?.[0]?.text ||
        // OpenAI chat completions fallback
        data?.choices?.[0]?.message?.content ||
        // last resort: dump raw so we can debug
        (data ? `[Unexpected format: ${JSON.stringify(data).slice(0, 200)}]` : 'Sorry, no response received.')
 
      history.current.push({ role:'assistant', content:reply })
      setMsgs(m => [...m.slice(0,-1), { role:'bot', text:reply }])
    } catch {
      setMsgs(m => [...m.slice(0,-1), { role:'bot', text:'⚠️ Could not reach the assistant. Please check your connection.' }])
    }
    setLoading(false)
  }
 
  return (
    <>
      <style>{css}</style>
 
      <button className="chat-fab" onClick={() => setOpen(o => !o)} title="Ask LibAI">
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
 
      <div className={`chat-panel${open ? '' : ' hidden'}`}>
        <div className="chat-hdr">
          <div className="chat-dot" />
          <div className="chat-hdr-text">
            <div className="chat-hdr-title">iWS Library Assistant</div>
            <div className="chat-hdr-sub">iYunivesithi Walter Sisulu Library</div>
          </div>
          <button className="chat-close" onClick={() => setOpen(false)}><X size={18}/></button>
        </div>
 
        <div className="chat-chips">
          {CHIPS.map(c => (
            <button key={c.label} className="chip" onClick={() => send(c.prompt)}>{c.label}</button>
          ))}
        </div>
 
        <div className="chat-msgs" ref={msgsEl}>
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>{m.text}</div>
          ))}
        </div>
 
        <div className="chat-input-row">
          <input
            className="chat-input"
            type="text"
            placeholder="Message the agent…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            maxLength={500}
          />
          <button className="chat-send" onClick={() => send()} disabled={loading}>
            <Send size={15} />
          </button>
        </div>
      </div>
    </>
  )
}