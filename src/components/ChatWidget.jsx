import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, BookOpen, Trash2 } from 'lucide-react'

const PROXY_URL = '/api/chat'

const CHIPS = [
  { label: 'iWS Libraries',  prompt: 'Tell me about the iYunivesithi Walter Sisulu Libraries — locations, hours, and services.' },
  { label: 'LibGuides page', prompt: 'What resources are available on the iWS LibGuides page?' },
  { label: 'Research tools', prompt: 'What research tools does iWS Library offer for students and researchers?' },
]

function renderMarkdown(text) {
  const lines = text.split(/\n/)
  const result = []
  lines.forEach((line, lineIdx) => {
    if (line.trim() === '') { result.push(<br key={`br-${lineIdx}`} />); return }
    const parts = []
    const pattern = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+|www\.[^\s)]+)|([\w.+-]+@[\w-]+\.[a-z.]{2,})/g
    let last = 0, m
    while ((m = pattern.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index))
      if (m[1])      parts.push(<strong key={`b-${lineIdx}-${m.index}`}>{m[2]}</strong>)
      else if (m[3]) parts.push(<em key={`i-${lineIdx}-${m.index}`}>{m[4]}</em>)
      else if (m[5]) parts.push(<a key={`ml-${lineIdx}-${m.index}`} href={m[6]} target="_blank" rel="noopener noreferrer">{m[5]}</a>)
      else if (m[7]) { const href = m[7].startsWith('www.') ? `https://${m[7]}` : m[7]; parts.push(<a key={`ul-${lineIdx}-${m.index}`} href={href} target="_blank" rel="noopener noreferrer">{m[7]}</a>) }
      else if (m[8]) parts.push(<a key={`em-${lineIdx}-${m.index}`} href={`mailto:${m[8]}`}>{m[8]}</a>)
      last = m.index + m[0].length
    }
    if (last < line.length) parts.push(line.slice(last))
    result.push(<span key={`line-${lineIdx}`}>{parts}</span>)
    if (lineIdx < lines.length - 1) result.push(<br key={`lbr-${lineIdx}`} />)
  })
  return result
}

const css = `
  .chat-fab {
    position: fixed; bottom: 24px; right: 24px;
    width: 60px; height: 60px; border-radius: 50%;
    background: linear-gradient(145deg, #6B1B1D, #551516);
    border: none; color: #fff; cursor: pointer;
    box-shadow: 0 8px 24px rgba(85,21,22,.4), 0 2px 6px rgba(85,21,22,.2);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000; transition: transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .25s;
  }
  .chat-fab::before {
    content:''; position:absolute; inset:-3px; border-radius:50%;
    background: conic-gradient(from 0deg, #CF8029, #E0A35E, #CF8029);
    z-index:-1; opacity:.9;
  }
  .chat-fab:hover { transform: scale(1.08) rotate(-4deg); box-shadow: 0 12px 32px rgba(85,21,22,.5); }
  .chat-fab .pulse {
    position:absolute; top:-2px; right:-2px; width:14px; height:14px;
    background:#CF8029; border-radius:50%; border:2px solid #fff;
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(1.25); opacity:.7; } }

  .chat-panel {
    position: fixed; top: 0; right: 0; bottom: 0;
    width: 50vw; min-width: 360px; max-width: 680px;
    height: 100vh;
    display: flex; flex-direction: column;
    background: rgba(255,255,255,.96);
    backdrop-filter: blur(24px) saturate(200%);
    -webkit-backdrop-filter: blur(24px) saturate(200%);
    border-left: 1px solid rgba(228,223,214,.8);
    border-radius: 0;
    box-shadow: -12px 0 48px rgba(43,41,38,.18), -2px 0 8px rgba(43,41,38,.08);
    z-index: 999; overflow: hidden; transform-origin: right center;
    transition: opacity .32s cubic-bezier(.22,1,.36,1), transform .32s cubic-bezier(.22,1,.36,1);
  }
  .chat-panel.hidden { opacity: 0; pointer-events: none; transform: translateX(100%); }

  .chat-hdr {
    position: relative;
    background: linear-gradient(120deg, #551516 0%, #6B1B1D 55%, #7A2426 100%);
    color: #fff; padding: 18px 18px 16px;
    display: flex; align-items: center; gap: 12px;
    font-family: Inter, sans-serif; overflow: hidden;
  }
  .chat-hdr::after {
    content:''; position:absolute; right:-30px; top:-30px;
    width:120px; height:120px; border-radius:50%;
    background: radial-gradient(circle, rgba(207,128,41,.35), transparent 70%);
  }
  .chat-avatar {
    width: 40px; height: 40px; border-radius: 50%;
    background: linear-gradient(145deg, #CF8029, #B45736);
    display:flex; align-items:center; justify-content:center;
    flex-shrink:0; box-shadow: 0 2px 8px rgba(0,0,0,.2);
    position: relative; z-index: 1;
  }
  .chat-hdr-text { flex:1; position: relative; z-index: 1; }
  .chat-hdr-title { font-size:.95rem; font-weight:700; letter-spacing:.2px; }
  .chat-hdr-sub { font-size:.72rem; color:rgba(255,255,255,.65); margin-top:2px; display:flex; align-items:center; gap:5px; }
  .chat-hdr-sub .live-dot { width:6px; height:6px; border-radius:50%; background:#7FBF7F; box-shadow:0 0 6px #7FBF7F; }
  .chat-close {
    background: rgba(255,255,255,.12); border:none; color:#fff;
    cursor:pointer; display:flex; align-items:center; justify-content:center;
    width:30px; height:30px; border-radius:50%;
    transition: background .15s; position:relative; z-index:1; flex-shrink:0;
  }
  .chat-close:hover { background: rgba(255,255,255,.24); }
  .chat-clear {
    background: rgba(255,255,255,.12); border:none; color:rgba(255,255,255,.7);
    cursor:pointer; display:flex; align-items:center; justify-content:center;
    width:30px; height:30px; border-radius:50%;
    transition: background .15s, color .15s; position:relative; z-index:1; flex-shrink:0;
  }
  .chat-clear:hover { background: rgba(207,128,41,.3); color:#fff; }

  .chat-chips { display:flex; gap:7px; padding:12px 14px; overflow-x:auto; scrollbar-width:none; }
  .chat-chips::-webkit-scrollbar { display:none; }
  .chip {
    font-family: Inter, sans-serif; font-size:.74rem; font-weight:600;
    padding: 7px 13px; border: none; border-radius: 18px; color: #551516;
    background: linear-gradient(135deg, #F7F3EA, #EFE7D8);
    box-shadow: 0 1px 3px rgba(0,0,0,.06), inset 0 0 0 1px rgba(207,128,41,.3);
    cursor: pointer; white-space:nowrap; flex-shrink:0; transition: all .15s;
  }
  .chip:hover { background: linear-gradient(135deg, #CF8029, #B45736); color:#fff; transform: translateY(-1px); box-shadow: 0 4px 10px rgba(207,128,41,.35); }
  .chip:active { transform: translateY(0); }

  .chat-msgs {
    flex:1; overflow-y:auto; padding: 8px 14px 14px;
    display:flex; flex-direction:column; gap:12px;
    font-family: Inter, sans-serif; font-size:.875rem; scroll-behavior: smooth;
  }
  .chat-msgs::-webkit-scrollbar { width:5px; }
  .chat-msgs::-webkit-scrollbar-thumb { background:#E4DFD6; border-radius:3px; }

  .msg-row { display:flex; gap:8px; align-items:flex-end; animation: msgIn .28s cubic-bezier(.22,1,.36,1); }
  .msg-row.user { flex-direction:row-reverse; }
  @keyframes msgIn { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform:translateY(0); } }

  .msg-avatar {
    width:26px; height:26px; border-radius:50%; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    background: linear-gradient(145deg, #CF8029, #B45736);
    color:#fff; font-size:.65rem; font-weight:800;
  }
  .msg-row.user .msg-avatar { background: linear-gradient(145deg, #6B1B1D, #551516); }

  .msg {
    max-width: 76%; padding: 10px 14px; border-radius: 16px;
    line-height: 1.5; word-break: break-word; box-shadow: 0 1px 2px rgba(0,0,0,.04);
  }
  .msg.bot { background: #fff; border: 1px solid #EDE8DF; border-bottom-left-radius: 5px; color: #2B2926; }
  .msg.user { background: linear-gradient(135deg, #6B1B1D, #551516); color: #fff; border-bottom-right-radius: 5px; }
  .msg a { color:#A02124; font-weight:600; text-decoration: underline; text-underline-offset:2px; word-break:break-all; }
  .msg.user a { color:#F0C492; }

  .typing-dots { display:flex; gap:4px; padding:4px 2px; align-items:center; }
  .typing-dots span { width:6px; height:6px; border-radius:50%; background:#B0A89A; animation: bounce 1.2s infinite ease-in-out; }
  .typing-dots span:nth-child(2) { animation-delay:.15s; }
  .typing-dots span:nth-child(3) { animation-delay:.3s; }
  @keyframes bounce { 0%,60%,100% { transform:translateY(0); opacity:.5; } 30% { transform:translateY(-5px); opacity:1; } }

  .chat-input-row {
    display:flex; gap:8px; align-items:center;
    padding: 12px 14px; padding-bottom: max(12px, env(safe-area-inset-bottom));
    border-top:1px solid #EDE8DF; background: rgba(255,255,255,.7); backdrop-filter: blur(8px);
  }
  .chat-input {
    flex:1; padding: 11px 16px; border: 1.5px solid #E4DFD6; border-radius: 22px;
    font-size:.87rem; font-family:Inter,sans-serif; outline:none; background:#fff;
    transition: border-color .15s, box-shadow .15s;
  }
  .chat-input:focus { border-color:#CF8029; box-shadow: 0 0 0 3px rgba(207,128,41,.12); }
  .chat-send {
    background: linear-gradient(145deg, #6B1B1D, #551516); border:none; border-radius:50%;
    width:40px; height:40px; display:flex; align-items:center; justify-content:center;
    cursor:pointer; color:#fff; flex-shrink:0;
    transition: transform .15s, box-shadow .15s; box-shadow: 0 2px 8px rgba(85,21,22,.3);
  }
  .chat-send:hover:not(:disabled) { transform: scale(1.08); box-shadow: 0 4px 14px rgba(85,21,22,.4); }
  .chat-send:active:not(:disabled) { transform: scale(.96); }
  .chat-send:disabled { background:#E4DFD6; cursor:not-allowed; box-shadow:none; }

  .feedback-row {
    display: flex; gap: 4px; margin-top: 5px; padding-left: 2px;
  }
  .fb-btn {
    background: none; border: 1.5px solid #E4DFD6; border-radius: 12px;
    padding: 3px 9px; font-size: .82rem; cursor: pointer; line-height: 1;
    color: #B0A89A; transition: all .15s;
  }
  .fb-btn:hover { border-color: #CF8029; background: #FEF9F0; color: #CF8029; }
  .fb-btn.active-up   { border-color: #546A55; background: #EEF4EE; color: #546A55; }
  .fb-btn.active-down { border-color: #A02124; background: #FDEFEF; color: #A02124; }
  .fb-thanks { font-size: .72rem; color: #B0A89A; margin-top: 4px; padding-left: 2px; font-family: Inter, sans-serif; }

  .msg { max-width: 72%; }

  @media (max-width: 480px) {
    .chat-fab { bottom: 18px; right: 18px; width:56px; height:56px; }
    .chat-panel {
      top: 0; bottom: 0; right: 0; left: 0;
      width: 100%; min-width: unset; max-width: unset;
      height: 100%; border-left: none; border-radius: 0;
      box-shadow: none; transform-origin: center;
    }
    .chat-panel.hidden { transform: translateY(24px) scale(.97); opacity: 0; }
    .chat-hdr { padding-top: max(18px, env(safe-area-inset-top)); }
    .msg { max-width: 84%; }
  }
`

const STORAGE_KEY = 'iws-libai-chat'
const WELCOME = { role: 'bot', text: "Hi! I'm LibAI, the iWS Library Assistant. Ask me anything about accreditation, journals, or library services.", ts: Date.now() }

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return [WELCOME]
}

function fmt(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function ChatWidget() {
  const [open, setOpen]       = useState(false)
  const [msgs, setMsgs]       = useState(loadSaved)
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const history                = useRef([])
  const msgsEl                 = useRef(null)
  const inputEl                = useRef(null)

  // Rebuild API history from saved msgs on mount
  useEffect(() => {
    history.current = msgs
      .filter(m => m.role === 'user' || m.role === 'bot')
      .map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.text }))
  }, [])

  // Persist msgs to localStorage whenever they change (skip typing indicator)
  useEffect(() => {
    const toSave = msgs.filter(m => m.role !== 'bot typing')
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave)) } catch {}
  }, [msgs])

  useEffect(() => { if (msgsEl.current) msgsEl.current.scrollTop = msgsEl.current.scrollHeight }, [msgs])
  useEffect(() => { if (open && inputEl.current) setTimeout(() => inputEl.current.focus(), 300) }, [open])

  const clearChat = useCallback(() => {
    history.current = []
    setMsgs([WELCOME])
    setFeedback({})
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }, [])

  // feedback: { [msgIndex]: 'up' | 'down' | 'done' }
  const [feedback, setFeedback] = useState({})

  const submitFeedback = useCallback(async (msgIdx, rating, msgText) => {
    setFeedback(f => ({ ...f, [msgIdx]: rating }))
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,                          // 'up' or 'down'
          message: msgText,
          ts: new Date().toISOString(),
          url: window.location.href,
        })
      })
      // Show thanks after a short delay
      setTimeout(() => setFeedback(f => ({ ...f, [msgIdx]: 'done' })), 800)
    } catch {
      // Silently fail — feedback is non-critical
    }
  }, [])

  async function send(text) {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    const userMsg = { role: 'user', text: q, ts: Date.now() }
    setMsgs(m => [...m, userMsg])
    history.current.push({ role: 'user', content: q })
    setLoading(true)
    setMsgs(m => [...m, { role: 'bot typing', text: '', ts: null }])

    try {
      const res  = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: history.current, model: 'gpt-4o' })
      })
      const data = await res.json()

      const reply =
        data?.output?.find?.(o => o.type === 'message')
          ?.content?.find?.(c => c.type === 'output_text' || c.type === 'text')?.text ||
        data?.output?.[0]?.content?.[0]?.text ||
        data?.choices?.[0]?.message?.content ||
        (data ? `[Unexpected format: ${JSON.stringify(data).slice(0, 200)}]` : 'Sorry, no response received.')

      history.current.push({ role: 'assistant', content: reply })
      setMsgs(m => [...m.slice(0, -1), { role: 'bot', text: reply, ts: Date.now() }])
    } catch {
      setMsgs(m => [...m.slice(0, -1), { role: 'bot', text: '⚠️ Could not reach the assistant. Please check your connection.', ts: Date.now() }])
    }
    setLoading(false)
  }

  return (
    <>
      <style>{css}</style>

      <button className="chat-fab" onClick={() => setOpen(o => !o)} title="Ask LibAI" aria-label="Open chat with LibAI">
        {open ? <X size={24} /> : <MessageCircle size={24} />}
        {!open && <span className="pulse" />}
      </button>

      <div className={`chat-panel${open ? '' : ' hidden'}`} role="dialog" aria-label="LibAI chat">
        <div className="chat-hdr">
          <div className="chat-avatar"><BookOpen size={19} /></div>
          <div className="chat-hdr-text">
            <div className="chat-hdr-title">iWS LibAI Assistant</div>
            <div className="chat-hdr-sub"><span className="live-dot" />iYunivesithi Walter Sisulu Library</div>
          </div>
          <button className="chat-clear" onClick={clearChat} aria-label="Clear chat history" title="Clear chat">
            <Trash2 size={14}/>
          </button>
          <button className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat"><X size={16}/></button>
        </div>

        <div className="chat-chips">
          {CHIPS.map(c => (
            <button key={c.label} className="chip" onClick={() => send(c.prompt)}>{c.label}</button>
          ))}
        </div>

        <div className="chat-msgs" ref={msgsEl}>
          {msgs.map((m, i) => {
            const isUser = m.role === 'user'
            const isTyping = m.role === 'bot typing'
            return (
              <div key={i} className={`msg-row ${isUser ? 'user' : 'bot'}`}>
                <div className="msg-avatar">{isUser ? 'You' : 'AI'}</div>
                <div>
                  <div className={`msg ${isUser ? 'user' : 'bot'}`}>
                    {isTyping
                      ? <div className="typing-dots"><span/><span/><span/></div>
                      : renderMarkdown(m.text)}
                  </div>
                  {!isTyping && m.ts && (
                    <div style={{ fontSize:'.68rem', color:'#B0A89A', marginTop:3, textAlign: isUser ? 'right' : 'left', paddingLeft: isUser ? 0 : 2, paddingRight: isUser ? 2 : 0 }}>
                      {fmt(m.ts)}
                    </div>
                  )}
                  {!isUser && !isTyping && m.ts && (
                    feedback[i] === 'done'
                      ? <div className="fb-thanks">Thanks for the feedback!</div>
                      : <div className="feedback-row">
                          <button
                            className={`fb-btn${feedback[i] === 'up' ? ' active-up' : ''}`}
                            onClick={() => submitFeedback(i, 'up', m.text)}
                            aria-label="Helpful"
                            title="Helpful"
                          >👍</button>
                          <button
                            className={`fb-btn${feedback[i] === 'down' ? ' active-down' : ''}`}
                            onClick={() => submitFeedback(i, 'down', m.text)}
                            aria-label="Not helpful"
                            title="Not helpful"
                          >👎</button>
                        </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="chat-input-row">
          <input
            ref={inputEl}
            className="chat-input"
            type="text"
            placeholder="Message the agent…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            maxLength={500}
          />
          <button className="chat-send" onClick={() => send()} disabled={loading} aria-label="Send message">
            <Send size={16} />
          </button>
        </div>
      </div>
    </>
  )
}
