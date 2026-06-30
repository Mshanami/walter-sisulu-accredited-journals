import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, BookOpen } from 'lucide-react'

const PROXY_URL = '/api/chat'

const CHIPS = [
  { label: 'iWS Libraries',  prompt: 'Tell me about the iYunivesithi Walter Sisulu Libraries — locations, hours, and services.' },
  { label: 'LibGuides page', prompt: 'What resources are available on the iWS LibGuides page?' },
  { label: 'Research tools', prompt: 'What research tools does iWS Library offer for students and researchers?' },
]

function linkify(text) {
  const mdRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
  const segments = []
  let lastIndex = 0
  let m
  while ((m = mdRegex.exec(text)) !== null) {
    if (m.index > lastIndex) segments.push(text.slice(lastIndex, m.index))
    segments.push(<a key={`md-${m.index}`} href={m[2]} target="_blank" rel="noopener noreferrer">{m[1]}</a>)
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < text.length) segments.push(text.slice(lastIndex))

  const urlRegex = /(https?:\/\/[^\s)]+|www\.[^\s)]+)|([\w.+-]+@[\w-]+\.[a-z.]{2,})/gi
  const finalParts = []
  segments.forEach((seg, segIdx) => {
    if (typeof seg !== 'string') { finalParts.push(seg); return }
    let idx = 0, match
    urlRegex.lastIndex = 0
    while ((match = urlRegex.exec(seg)) !== null) {
      if (match.index > idx) finalParts.push(seg.slice(idx, match.index))
      const matched = match[0]
      if (match[2]) {
        finalParts.push(<a key={`em-${segIdx}-${match.index}`} href={`mailto:${matched}`}>{matched}</a>)
      } else {
        const href = matched.startsWith('www.') ? `https://${matched}` : matched
        finalParts.push(<a key={`url-${segIdx}-${match.index}`} href={href} target="_blank" rel="noopener noreferrer">{matched}</a>)
      }
      idx = match.index + matched.length
    }
    if (idx < seg.length) finalParts.push(seg.slice(idx))
  })
  return finalParts
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
    position: fixed; bottom: 96px; right: 24px;
    width: 380px; height: 580px; max-height: calc(100vh - 120px);
    display: flex; flex-direction: column;
    background: rgba(255,255,255,.92);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(228,223,214,.8); border-radius: 20px;
    box-shadow: 0 24px 60px rgba(43,41,38,.22), 0 4px 16px rgba(43,41,38,.1);
    z-index: 999; overflow: hidden; transform-origin: bottom right;
    transition: opacity .28s cubic-bezier(.22,1,.36,1), transform .28s cubic-bezier(.22,1,.36,1);
  }
  .chat-panel.hidden { opacity: 0; pointer-events: none; transform: translateY(16px) scale(.92); }

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

  @media (max-width: 480px) {
    .chat-fab { bottom: 18px; right: 18px; width:56px; height:56px; }
    .chat-panel {
      bottom: 0; right: 0; left: 0; top: 0;
      width: 100%; height: 100%; max-height: 100%; border-radius: 0;
      transform-origin: center;
    }
    .chat-panel.hidden { transform: translateY(24px) scale(.97); }
    .chat-hdr { padding-top: max(18px, env(safe-area-inset-top)); border-radius:0; }
    .msg { max-width: 84%; }
  }
`

export default function ChatWidget() {
  const [open, setOpen]       = useState(false)
  const [msgs, setMsgs]       = useState([{ role:'bot', text:'Hi! I\'m LibAI, the iWS Library Assistant. Ask me anything about accreditation, journals, or library services.' }])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const history                = useRef([])
  const msgsEl                 = useRef(null)
  const inputEl                = useRef(null)

  useEffect(() => { if (msgsEl.current) msgsEl.current.scrollTop = msgsEl.current.scrollHeight }, [msgs])
  useEffect(() => { if (open && inputEl.current) setTimeout(() => inputEl.current.focus(), 300) }, [open])

  async function send(text) {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    setMsgs(m => [...m, { role:'user', text:q }])
    history.current.push({ role:'user', content:q })
    setLoading(true)
    setMsgs(m => [...m, { role:'bot typing', text:'' }])

    try {
      const res  = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: history.current, model:'gpt-4o' })
      })
      const data = await res.json()

      const reply =
        data?.output?.find?.(o => o.type === 'message')
          ?.content?.find?.(c => c.type === 'output_text' || c.type === 'text')?.text ||
        data?.output?.[0]?.content?.[0]?.text ||
        data?.choices?.[0]?.message?.content ||
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
                <div className={`msg ${isUser ? 'user' : 'bot'}`}>
                  {isTyping
                    ? <div className="typing-dots"><span/><span/><span/></div>
                    : linkify(m.text)}
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
