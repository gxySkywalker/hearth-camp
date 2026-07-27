import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PageId } from '../types'
import { useApp } from '../context/AppContext'
import { formatDuration } from '../lib/format'
import { CottageScene, type CottageAction } from '../components/CottageScene'
import { Icon } from '../components/Icon'
import { startFocus } from '../components/FocusController'
import { setInputContext } from '../lib/inputContext'
import { playUISound } from '../lib/audio'
import {
  getRememberedCottageCompanionMode,
  rememberCottageCompanionMode,
  type CottageCompanionMode,
} from '../lib/cottage-scene'
import '../cottage-world.css'

export function CottagePage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const { dashboard, notify } = useApp()
  if (!dashboard) return null
  const { today, world } = dashboard
  const companion = world.companions.active

  const messages = useMemo(() => {
    const name = companion?.nickname || '伙伴'
    const hour = new Date().getHours()
    const list: string[] = []
    if (companion?.evolutionReady) list.push(`${name}感到体内有什么正在变化。也许该去伙伴营地看看。`)
    if (world.latestExpedition?.rareFound) list.push('你看到宝箱里那道光了吗？这次远征带回了不寻常的东西。')
    if (today.focusSeconds > 0) list.push(`今天我们已经走了${formatDuration(today.focusSeconds, true)}的路。每一步都算数。`)
    else list.push('还没有出发也没关系。壁炉还暖着，我们可以慢慢准备。')
    if (hour < 7) list.push('夜已经很深了。我会守着炉火。')
    else if (hour < 11) list.push('窗外刚亮起来，今天的第一条路正在等我们。')
    else if (hour < 17) list.push('书桌被日光晒得暖暖的，适合整理刚学到的东西。')
    else if (hour < 22) list.push('远处的商道亮起了灯。现在出发，也许会遇到晚归的商队。')
    else list.push('雪夜很安静。你想再坐一会儿也可以。')
    return list
  }, [companion, today.focusSeconds, world.latestExpedition])

  const [messageIndex, setMessageIndex] = useState(0)
  const [dialogueOpen, setDialogueOpen] = useState(false)
  const [dialogueChoice, setDialogueChoice] = useState(2)
  const [companionMode, setCompanionMode] = useState<CottageCompanionMode>(() => getRememberedCottageCompanionMode())
  const closeDialogue = useCallback(() => {
    setDialogueOpen(false)
    setInputContext('world')
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>('.pixi-cottage-scene')?.focus())
  }, [])
  const openDialogue = useCallback(() => {
    setMessageIndex(0)
    setDialogueChoice(2)
    setInputContext('dialog')
    setDialogueOpen(true)
  }, [])
  const advanceMessage = useCallback(() => {
    setMessageIndex((index) => {
      if (index + 1 >= messages.length) {
        closeDialogue()
        return 0
      }
      return index + 1
    })
  }, [closeDialogue, messages.length])
  const interactWithCompanion = useCallback(() => {
    if (dialogueOpen) advanceMessage()
    else openDialogue()
  }, [advanceMessage, dialogueOpen, openDialogue])
  const toggleCompanionMode = useCallback(() => {
    setCompanionMode((current) => {
      const next: CottageCompanionMode = current === 'follow' ? 'stay' : 'follow'
      rememberCottageCompanionMode(next)
      return next
    })
  }, [])
  useEffect(() => {
    if (!dialogueOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (['Escape', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(event.key)) { event.stopPropagation(); event.stopImmediatePropagation() }
      if (event.key === 'Escape') { event.preventDefault(); playUISound('select'); closeDialogue(); return }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); playUISound('select'); setDialogueChoice((value) => event.key === 'ArrowLeft' ? (value + 2) % 3 : (value + 1) % 3); return
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        playUISound('select')
        if (dialogueChoice === 0) toggleCompanionMode()
        else if (dialogueChoice === 1) closeDialogue()
        else advanceMessage()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [advanceMessage, closeDialogue, dialogueChoice, dialogueOpen, toggleCompanionMode])

  const handleAction = (action: CottageAction) => {
    // The cottage door is the direct expedition entry point. The town remains
    // a paused draft and must not sit between the player and their next task.
    if (action === 'expedition') return startFocus(dashboard.nextTasks[0]?.id)
    if (action === 'journal') return onNavigate('history')
    if (action === 'inventory') {
      notify('宝箱与背包已经放在旅程总览中。以后这里会直接打开独立背包。', 'info')
      return onNavigate('overview')
    }
    if (action === 'review') return onNavigate('review')
    return onNavigate('plan')
  }

  return <div className='page cottage-world-page'>
    <header className='cottage-world-header'>
      <div className='cottage-world-identity'>
        <span className='cottage-world-sigil' aria-hidden='true'><Icon name='home' size={18} /></span>
        <div>
          <small>王国边境 · 炉火仍明</small>
          <h1>{`欢迎回家，${dashboard.settings.user_name || '旅行者'}。`}</h1>
        </div>
      </div>
      <div className='cottage-world-vitals'>
        <small>今日远征</small>
        <strong>{formatDuration(today.focusSeconds, true)}</strong>
        <span>炉火小屋 · 安全区域</span>
      </div>
      <div className='cottage-world-actions'>
        <button className='button world-menu-button' onClick={() => onNavigate('overview')}><Icon name='book' size={17} />旅程总览</button>
        <button className='button world-expedition-button' onClick={() => startFocus(dashboard.nextTasks[0]?.id)}><Icon name='play' size={17} />开始远征</button>
      </div>
    </header>

    <section className={`cottage-world-stage ${dialogueOpen ? 'dialogue-open' : ''}`}>
      <CottageScene
        immersive
        playerName={dashboard.settings.user_name || '旅行者'}
        companion={companion}
        onAction={handleAction}
        onCompanionInteract={interactWithCompanion}
        companionMode={companionMode}
      />
      {dialogueOpen && <div className='cottage-world-dialogue' role='dialog' aria-label={`${companion?.nickname || '伙伴'}的对话`}>
        <span className='dialogue-heart'>♥</span>
        <span><strong>{companion?.nickname || '伙伴'}<small>{companion?.stageName || '常伴伙伴'} · 可在伙伴营地更换</small></strong><em>{messages[messageIndex]}</em></span>
        <div className='cottage-dialogue-controls'>
          <button className={dialogueChoice === 0 ? 'is-selected' : ''} onClick={toggleCompanionMode}>{dialogueChoice === 0 ? '▶ ' : ''}{companionMode === 'follow' ? '在这里等我' : '一起走吧'}</button>
          <button className={dialogueChoice === 1 ? 'is-selected' : ''} onClick={closeDialogue}>{dialogueChoice === 1 ? '▶ ' : ''}结束交谈</button>
          <button className={dialogueChoice === 2 ? 'is-selected' : ''} onClick={advanceMessage}>{dialogueChoice === 2 ? '▶ ' : ''}继续</button>
        </div>
      </div>}
    </section>
  </div>
}
