/**
 * LibAI embed loader.
 *
 * Deliberately named something other than "embed.js" or "widget.js" — those
 * are common ad/tracker filenames that some content blockers pattern-match
 * and remove from the page shortly after it loads, which looked like the
 * teaser bubble "disappearing" a second or two after it appeared.
 *
 * Usage — paste this one line wherever the host page allows a <script> tag
 * (a LibGuides "Rich Text/HTML" box, a site's Custom JS, etc.):
 *
 *   <script src="https://walter-sisulu-accredited-journals.vercel.app/libai-loader.js"></script>
 *
 * Mounts the LibAI chat bubble as a small fixed iframe in the bottom-right
 * corner of whatever page includes this script, growing the iframe to fit
 * the full chat panel when the visitor opens it (see the postMessage
 * handshake in ChatWidget.jsx) and shrinking it back when they close it.
 */
(function () {
  if (window.__libaiEmbedded) return
  window.__libaiEmbedded = true

  var MOBILE_BREAKPOINT = 480
  var CLOSED_SIZE = { width: '100px', height: '100px' }
  var OPEN_SIZE   = { width: '420px', height: '700px' }

  var scriptEl = document.currentScript
  var origin = scriptEl && scriptEl.src ? scriptEl.src.replace(/\/libai-loader\.js(?:\?.*)?$/, '') : window.location.origin

  var iframe = document.createElement('iframe')
  iframe.src = origin + '/widget.html'
  iframe.title = 'LibAI — Walter Sisulu Library Assistant'
  iframe.style.position = 'fixed'
  iframe.style.bottom = '0'
  iframe.style.right = '0'
  iframe.style.border = 'none'
  iframe.style.background = 'transparent'
  iframe.style.zIndex = '2147483000'
  iframe.style.colorScheme = 'light'

  var isOpen = false
  function applySize() {
    var size = !isOpen ? CLOSED_SIZE : (window.innerWidth <= MOBILE_BREAKPOINT ? { width: '100vw', height: '100dvh' } : OPEN_SIZE)
    iframe.style.width = size.width
    iframe.style.height = size.height
  }
  applySize()

  window.addEventListener('message', function (e) {
    if (!e.data || e.data.source !== 'libai-widget') return
    isOpen = !!e.data.open
    applySize()
  })

  var resizeTimer
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(applySize, 150)
  })

  function mount() { document.body.appendChild(iframe) }
  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount)
})()
