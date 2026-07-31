let snapshot = { active: false, status: 'running', content: '', activeSeconds: 0 }
let receivedAt = Date.now()

const timer = document.getElementById('timer')
const content = document.getElementById('content')
const state = document.getElementById('state')
const widget = document.querySelector('.widget')
const returnButton = document.getElementById('return')
const closeButton = document.getElementById('close')

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function render() {
  const elapsed = snapshot.status === 'running'
    ? snapshot.activeSeconds + (Date.now() - receivedAt) / 1000
    : snapshot.activeSeconds
  timer.textContent = formatDuration(elapsed)
  content.textContent = snapshot.content || snapshot.taskTitle || '正在专注'
  state.textContent = snapshot.status === 'paused' ? '正在休息' : '正在专注'
  widget.dataset.status = snapshot.status === 'paused' ? 'paused' : 'running'
}

function setState(next) {
  snapshot = { ...snapshot, ...next }
  receivedAt = Date.now()
  render()
}

window.growthArc.focusWidget.getState().then(setState).catch(() => {})
window.growthArc.focusWidget.onState(setState)
returnButton.addEventListener('click', () => window.growthArc.focusWidget.showMain())
closeButton.addEventListener('click', () => window.growthArc.focusWidget.hide())
widget.addEventListener('dblclick', () => window.growthArc.focusWidget.showMain())
setInterval(render, 1000)
render()
