import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Companion, PageId } from '../types'
import { useApp } from '../context/AppContext'
import { formatDuration } from '../lib/format'
import { CottageScene, type CottageAction } from '../components/CottageScene'
import { Icon } from '../components/Icon'
import { startFocus } from '../components/FocusController'
import { setInputContext } from '../lib/inputContext'
import { playUISound, setHearthFireSound } from '../lib/audio'
import { Modal } from '../components/Modal'
import { getItemLore } from '../lib/item-lore'
import { ItemTooltip } from '../components/ItemTooltip'
import { rememberCottageCompanionMode, type CottageCompanionMode } from '../lib/cottage-scene'
import '../cottage-world.css'

const COMPANION_DAYLINES: Record<string, [string, string, string]> = {
  hearth_hound: ['炉尾在炉火边打了个小小的哈欠。', '炉尾在门边闻了闻风，随后回头看向你。', '炉尾把一小段旧布结往角落推了推。'],
  moss_fox: ['枝绒安静听着屋檐外的风声。', '枝绒停在窗边的光影里，看一片叶子慢慢落下。', '枝绒在地板的日光旁蜷起尾巴，像在等风吹过。'],
  glimmer_cat: ['灯团把尾端的微光收得很小，安静伏在近处。', '灯团坐上窗台，看着街上还没有散尽的灯。', '灯团的尾灯在安静房间里轻轻晃了一下。'],
  river_otter: ['涟牙贴着炉边坐下，像在听木柴里细小的声响。', '涟牙把一颗圆石拨到脚边，又轻轻推正。', '涟牙在日光里摊开前爪，像刚从河湾边回来。'],
  iron_badger: ['小石獾把前爪收在身下，靠着墙边睡得很稳。', '小石獾在门槛旁停住，像在确认脚下的木板没有松动。', '小石獾把滚到一边的小木块推回墙脚。'],
  moon_owl: ['暮羽子收拢翅膀，听着夜色慢慢落下来。', '暮羽子侧着头，像在听远处还没停下的钟声。', '暮羽子落在高处安静望着书桌，没有催促你开口。'],
  cloud_rabbit: ['小丘把长耳轻轻垂下，在炉火旁歇一会儿。', '小丘偏过耳朵听风，随后慢慢跳到窗边。', '小丘趴在晒暖的地板上，像一小片停住的云影。'],
  ember_drake: ['小火牙把翅膀收得很紧，余烬般的亮点安静闪着。', '小火牙抬头望了望远山的方向，又回到你身边。', '小火牙在窗边停了一会儿，像在看还未抵达的群山。'],
}

const COMPANION_KEEPSAKES: Record<string, string> = {
  hearth_hound: 'flame_scatter', moss_fox: 'rain_moss_vein', glimmer_cat: 'violet_mist_glass',
  river_otter: 'river_stone', iron_badger: 'gray_pattern_stone', moon_owl: 'wind_hill_feather',
  cloud_rabbit: 'cloud_shadow_grass', ember_drake: 'dragon_scale',
}

function CottageBackpackItem({ entry, onUse }: { entry: any; onUse: (entry: any) => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hover, setHover] = useState(false)
  const lore = getItemLore(entry.item)
  const show = () => { timer.current = setTimeout(() => setHover(true), 180) }
  const hide = () => { if (timer.current) clearTimeout(timer.current); setHover(false) }
  return <><button type="button" ref={ref} className={`cottage-backpack-item ${entry.item.rarity} ${lore.consumesItem ? 'can-use' : ''}`} onClick={() => lore.consumesItem && onUse(entry)} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}><span><Icon name={entry.item.icon} size={24} /></span><div><small>{entry.item.rarity === 'common' ? '普通物品' : entry.item.rarity === 'uncommon' ? '罕见物品' : entry.item.rarity === 'rare' ? '稀有物品' : '珍稀物品'}</small><strong>{entry.item.name}</strong><p>{entry.item.description}</p>{lore.consumesItem && <em>点击使用</em>}</div><b>×{entry.quantity}</b></button><ItemTooltip item={entry.item} quantity={entry.quantity} triggerRef={ref} visible={hover} /></>
}

export function CottagePage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const { dashboard, activeSession, notify, refresh } = useApp()
  if (!dashboard) return null
  const { today, world } = dashboard
  // This is intentionally a room-only choice. It changes who walks beside the
  // traveller inside the cottage, never the companion selected for expeditions.
  const [cottageFollowerId, setCottageFollowerId] = useState<string | null>(null)
  // A resting companion never appears as the cottage follower. The saved
  // active choice is preserved for recovery, while the visible room falls
  // back to another healthy friend until then.
  const companion = (cottageFollowerId ? world.companions.owned.find((item) => item.id === cottageFollowerId && !item.is_ill) : null)
    || (world.companions.active && !world.companions.active.is_ill
    ? world.companions.active
    : world.companions.owned.find((item) => !item.is_ill)) || null
  const [clockNow, setClockNow] = useState(() => Date.now())
  const [hearthLit, setHearthLit] = useState(false)
  const [expeditionLayerActive, setExpeditionLayerActive] = useState(Boolean(activeSession))
  const [hearthOpen, setHearthOpen] = useState(false)
  const [hearthBusy, setHearthBusy] = useState(false)
  const [poetryOpen, setPoetryOpen] = useState(false)
  const [poems, setPoems] = useState<any[]>([])
  const [backpackOpen, setBackpackOpen] = useState(false)
  const [itemToUse, setItemToUse] = useState<any | null>(null)
  const [itemTargetId, setItemTargetId] = useState('')
  const [itemTargetStage, setItemTargetStage] = useState(0)
  const [usingItem, setUsingItem] = useState(false)
  const [mapSynthesisOpen, setMapSynthesisOpen] = useState(false)
  const [unlockedMapLocation, setUnlockedMapLocation] = useState<string | null>(null)
  const isNight = new Date(clockNow).getHours() < 6 || new Date(clockNow).getHours() >= 18
  const effectiveHearthLit = isNight || hearthLit

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  // Entering the cottage must immediately return keyboard ownership to the
  // playable scene. Previously this could remain on a closing page/modal
  // until navigating away and back once.
  useEffect(() => {
    setInputContext('world')
    const frame = window.requestAnimationFrame(() => document.querySelector<HTMLElement>('.pixi-cottage-scene')?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [])
  useEffect(() => { window.growthArc.hearth.get().then((state) => setHearthLit(state.lit)).catch(() => {}) }, [])
  useEffect(() => {
    const onExpeditionLayer = (event: Event) => {
      setExpeditionLayerActive(Boolean((event as CustomEvent<boolean>).detail))
    }
    window.addEventListener('growtharc:expedition-layer', onExpeditionLayer)
    return () => window.removeEventListener('growtharc:expedition-layer', onExpeditionLayer)
  }, [])
  useEffect(() => {
    // The cottage remains mounted behind the full-screen expedition layer.
    // Explicitly silence its ambience until the full settlement chain closes.
    setHearthFireSound(effectiveHearthLit && !activeSession && !expeditionLayerActive)
    return () => setHearthFireSound(false)
  }, [effectiveHearthLit, activeSession, expeditionLayerActive])

  const [talkingCompanion, setTalkingCompanion] = useState<Companion | null>(null)
  const dialogueCompanion = talkingCompanion || companion
  const messages = useMemo(() => {
    const name = dialogueCompanion?.nickname || '伙伴'
    const now = new Date(clockNow)
    const hour = now.getHours()
    const minutesOfDay = hour * 60 + now.getMinutes()
    const list: string[] = []
    const lines = COMPANION_DAYLINES[dialogueCompanion?.species_id || '']
    const timeLineIndex = minutesOfDay >= 18 * 60 + 30 || minutesOfDay < 5 * 60 ? 0 : minutesOfDay < 14 * 60 ? 2 : 1
    if (lines?.[timeLineIndex]) list.push(lines[timeLineIndex])
    if (dialogueCompanion?.evolutionReady) list.push(`${name}感到体内有什么正在变化。也许该去伙伴营地看看。`)
    if (world.latestExpedition?.rareFound) list.push('你看到宝箱里那道光了吗？这次远征带回了不寻常的东西。')
    if (today.focusSeconds > 0) list.push(`今天我们已经走了${formatDuration(today.focusSeconds, true)}的路。每一步都算数。`)
    else list.push('还没有出发也没关系。壁炉还暖着，我们可以慢慢准备。')
    if (hour >= 17 && hour < 22) list.push('远处的商道亮起了灯。现在出发，也许会遇到晚归的商队。')
    else if (timeLineIndex === 0) list.push('今晚很安静。你想再坐一会儿也可以。')
    return list
  }, [clockNow, dialogueCompanion, today.focusSeconds, world.latestExpedition])

  const [messageIndex, setMessageIndex] = useState(0)
  const [dialogueOpen, setDialogueOpen] = useState(false)
  const [dialogueChoice, setDialogueChoice] = useState(0)
  // Each cottage visit begins with the expedition companion walking beside
  // the traveller. Everyone else is free to move naturally in the room.
  const [companionMode, setCompanionMode] = useState<CottageCompanionMode>('follow')
  // These are room-only behaviours.  They never replace the companion chosen
  // for an expedition and are deliberately kept out of world-state writes.
  const [residentModes, setResidentModes] = useState<Record<string, CottageCompanionMode>>({})
  const [giftMenuOpen, setGiftMenuOpen] = useState(false)
  const [giftBusy, setGiftBusy] = useState(false)
  const [giftResult, setGiftResult] = useState<string | null>(null)
  const giftOptions = dialogueCompanion ? world.inventory.filter((entry) => entry.item_id === 'berry_bread'
    || entry.item_id === 'honey_amber'
    || entry.item_id === COMPANION_KEEPSAKES[dialogueCompanion.species_id]
    || (entry.item_id === 'eternal_diamond' && Boolean(dialogueCompanion.is_active) && !dialogueCompanion.form_lock_mode)) : []
  const closeDialogue = useCallback(() => {
    setDialogueOpen(false)
    setTalkingCompanion(null)
    setGiftMenuOpen(false)
    setGiftResult(null)
    setInputContext('world')
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>('.pixi-cottage-scene')?.focus())
  }, [])
  const resumeWorld = useCallback(() => {
    setInputContext('world')
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>('.pixi-cottage-scene')?.focus())
  }, [])
  const closeOverlay = useCallback((setOpen: (value: boolean) => void) => { setOpen(false); resumeWorld() }, [resumeWorld])
  useEffect(() => {
    if (!poetryOpen && !backpackOpen && !itemToUse && !mapSynthesisOpen) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.repeat) return
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      playUISound('select')
      // Close the uppermost backpack action first; a second Escape then closes
      // the backpack itself. This avoids leaking the key to global navigation.
      if (itemToUse && !usingItem) { setItemToUse(null); return }
      if (mapSynthesisOpen && !usingItem) { closeOverlay(setMapSynthesisOpen); return }
      if (poetryOpen) { closeOverlay(setPoetryOpen); return }
      if (backpackOpen) closeOverlay(setBackpackOpen)
    }
    window.addEventListener('keydown', onEscape, true)
    return () => window.removeEventListener('keydown', onEscape, true)
  }, [backpackOpen, closeOverlay, itemToUse, mapSynthesisOpen, poetryOpen, usingItem])
  const openDialogue = useCallback((target: Companion) => {
    setTalkingCompanion(target)
    setMessageIndex(0)
    setDialogueChoice(0)
    setGiftMenuOpen(false)
    setGiftResult(null)
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
  const interactWithCompanion = useCallback((target: Companion) => {
    if (dialogueOpen) advanceMessage()
    else openDialogue(target)
  }, [advanceMessage, dialogueOpen, openDialogue])
  const setCompanionBehaviour = useCallback((next: CottageCompanionMode) => {
    if (!dialogueCompanion) return
    if (next === 'follow' && dialogueCompanion.id !== companion?.id) {
      if (companion) setResidentModes((current) => ({ ...current, [companion.id]: 'wander' }))
      setResidentModes((current) => ({ ...current, [dialogueCompanion.id]: 'follow' }))
      setCottageFollowerId(dialogueCompanion.id)
      rememberCottageCompanionMode('follow')
      setCompanionMode('follow')
      notify(`${dialogueCompanion.nickname}轻轻靠近，开始跟着你的脚步。`, 'success')
      return
    }
    if (dialogueCompanion.id === companion?.id) {
      rememberCottageCompanionMode(next)
      setCompanionMode(next)
    } else {
      setResidentModes((current) => ({ ...current, [dialogueCompanion.id]: next }))
    }
    const wording = next === 'stay' ? '在原地安静等着。' : next === 'wander' ? '开始在熟悉的角落自在活动。' : '又跟上了你的脚步。'
    notify(`${dialogueCompanion.nickname}${wording}`, 'success')
  }, [companion, dialogueCompanion, notify])
  const giveCottageGift = useCallback(async (entry: any) => {
    if (!dialogueCompanion || giftBusy) return
    try {
      setGiftBusy(true)
      const result = await window.growthArc.inventory.useTarget(entry.item_id, dialogueCompanion.id)
      setGiftResult(result.effect)
      notify(result.effect, 'success')
      void refresh()
    } catch (error) { notify(error instanceof Error ? error.message : String(error), 'error') } finally { setGiftBusy(false) }
  }, [dialogueCompanion, giftBusy, notify, refresh])
  const dialogueMode = dialogueCompanion?.id === companion?.id ? companionMode : (dialogueCompanion ? residentModes[dialogueCompanion.id] || 'wander' : 'stay')
  const dialogueChoices = [
    ...(dialogueCompanion && dialogueMode !== 'follow' ? [{ id: 'follow', label: '让它跟着我' }] : []),
    ...(dialogueCompanion && dialogueMode !== 'stay' ? [{ id: 'stay', label: '让它在这里待着' }] : []),
    ...(dialogueCompanion && dialogueMode !== 'wander' ? [{ id: 'wander', label: '让它自由活动' }] : []),
    { id: 'close', label: '结束交谈' },
    { id: 'continue', label: '继续' },
    ...(giftOptions.length > 0 ? [{ id: 'gift', label: '分享礼物' }] : []),
  ] as const
  const activateDialogueChoice = useCallback((choice: typeof dialogueChoices[number]['id']) => {
    if (choice === 'follow' || choice === 'stay' || choice === 'wander') setCompanionBehaviour(choice)
    else if (choice === 'close') closeDialogue()
    else if (choice === 'continue') advanceMessage()
    else setGiftMenuOpen(true)
  }, [advanceMessage, closeDialogue, setCompanionBehaviour])
  useEffect(() => {
    if (!dialogueOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (['Escape', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(event.key)) { event.stopPropagation(); event.stopImmediatePropagation() }
      if (event.key === 'Escape') { event.preventDefault(); playUISound('select'); closeDialogue(); return }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); playUISound('select'); setDialogueChoice((value) => event.key === 'ArrowLeft' ? (value + dialogueChoices.length - 1) % dialogueChoices.length : (value + 1) % dialogueChoices.length); return
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        playUISound('select')
        const choice = dialogueChoices[dialogueChoice]
        if (choice) activateDialogueChoice(choice.id)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [activateDialogueChoice, closeDialogue, dialogueChoice, dialogueChoices, dialogueOpen])

  const handleAction = (action: CottageAction) => {
    // The cottage door is the direct expedition entry point. The town remains
    // a paused draft and must not sit between the player and their next task.
    if (action === 'expedition') return startFocus(dashboard.nextTasks[0]?.id)
    if (action === 'journal') return onNavigate('history')
    if (action === 'notes') return onNavigate('notes')
    if (action === 'poetry') return void window.growthArc.bard.list().then((items) => { setPoems(items); setInputContext('dialog'); setPoetryOpen(true) })
    if (action === 'inventory') {
      setInputContext('dialog'); return setBackpackOpen(true)
    }
    if (action === 'review') return onNavigate('review')
    if (action === 'hearth') { setInputContext('dialog'); return setHearthOpen(true) }
    return onNavigate('plan')
  }
  const setFire = async (lit: boolean) => {
    try { setHearthBusy(true); const state = await window.growthArc.hearth.setLit(lit); setHearthLit(state.lit); notify(lit ? '炉火重新亮了起来。' : '炉火安静熄下了。', 'success') } catch (error) { notify(error instanceof Error ? error.message : String(error), 'error') } finally { setHearthBusy(false) }
  }
  const craftAtHearth = async (recipeId: 'herbal_soup' | 'honey_amber') => {
    try { setHearthBusy(true); const result = await window.growthArc.hearth.craft(recipeId); notify(result.effect, 'success'); await refresh() } catch (error) { notify(error instanceof Error ? error.message : String(error), 'error') } finally { setHearthBusy(false) }
  }
  const inventoryCount = (id: string) => Number(world.inventory.find((entry) => entry.item_id === id)?.quantity || 0)
  const requestUse = (entry: any) => {
    if (entry.item_id === 'map_scrap') {
      setUnlockedMapLocation(null)
      setMapSynthesisOpen(true)
      setInputContext('dialog')
      return
    }
    setItemToUse(entry)
    const targetId = entry.item_id === 'herbal_soup' ? world.companions.owned.find((candidate) => candidate.is_ill)?.id || '' : companion?.id || ''
    setItemTargetId(targetId)
    setItemTargetStage(Math.max(0, Number(world.companions.owned.find((candidate) => candidate.id === targetId)?.stage || 0) - 1))
    setInputContext('dialog')
  }
  const useBackpackItem = async () => {
    if (!itemToUse || usingItem) return
    try {
      setUsingItem(true)
      const targeted = ['herbal_soup', 'honey_amber', 'rewind_gem', 'eternal_diamond'].includes(itemToUse.item_id)
      const result = targeted ? await window.growthArc.inventory.useTarget(itemToUse.item_id, itemTargetId, itemToUse.item_id === 'rewind_gem' ? itemTargetStage : null) : await window.growthArc.inventory.use(itemToUse.item_id)
      notify(result.effect, 'success'); setItemToUse(null); await refresh()
    } catch (error) { notify(error instanceof Error ? error.message : String(error), 'error') } finally { setUsingItem(false) }
  }
  const synthesizeMap = async () => {
    if (usingItem) return
    try {
      setUsingItem(true)
      const result = await window.growthArc.inventory.use('map_scrap')
      setUnlockedMapLocation(result.unlockedLocation || null)
      notify(result.effect, 'success')
      await refresh()
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setUsingItem(false)
    }
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
        playerAvatar={world.foundation.player.outfit_id || 'traveler_clothes'}
        companion={companion}
        companions={world.companions.owned.filter((item) => !item.is_ill)}
        onAction={handleAction}
        onCompanionInteract={interactWithCompanion}
        companionMode={companionMode}
        residentModes={residentModes}
        pausedCompanionId={dialogueOpen ? dialogueCompanion?.id : null}
        hearthLit={effectiveHearthLit}
        hearthAvailable
      />
      {dialogueOpen && <div className='cottage-world-dialogue' role='dialog' aria-label={`${dialogueCompanion?.nickname || '伙伴'}的对话`}>
        <span className='dialogue-heart'>♥</span>
        <span><strong>{dialogueCompanion?.nickname || '伙伴'}<small>{dialogueCompanion?.stageName || '常伴伙伴'} · {dialogueMode === 'follow' ? '正在跟着你' : dialogueMode === 'wander' ? '正在自在活动' : '正在原地等候'}</small></strong><em>{messages[messageIndex]}</em></span>
        <div className='cottage-dialogue-controls'>
          {dialogueChoices.map((choice, index) => <button key={choice.id} className={dialogueChoice === index ? 'is-selected' : ''} onClick={() => activateDialogueChoice(choice.id)}>{dialogueChoice === index ? '▶ ' : ''}{choice.label}</button>)}
        </div>
      </div>}
      {giftMenuOpen && <Modal title={`送给${dialogueCompanion?.nickname || '伙伴'}`} onClose={() => setGiftMenuOpen(false)} className="cottage-gift-backpack-modal"><div className="cottage-gift-backpack-head"><span><Icon name="spark" size={20} /></span><div><small>从小屋背包里挑一件礼物</small><strong>{dialogueCompanion?.nickname || '伙伴'}会记得这份心意。</strong></div></div><div className="cottage-gift-backpack-grid">{giftOptions.map((entry) => <button key={entry.item_id} className={`cottage-gift-item ${entry.item.rarity}`} disabled={giftBusy} onClick={() => void giveCottageGift(entry)}><span><Icon name={entry.item.icon} size={22} /></span><div><small>{entry.item.rarity === 'common' ? '普通物品' : entry.item.rarity === 'uncommon' ? '罕见物品' : entry.item.rarity === 'rare' ? '稀有物品' : '珍稀物品'}</small><strong>{entry.item.name}</strong><p>{entry.item.description}</p><em>{getItemLore(entry.item).effectLabel}</em></div><b>×{entry.quantity}</b></button>)}</div>{giftResult && <p className="cottage-gift-result">{giftResult}</p>}<footer className="modal-footer"><button className="button button-ghost" onClick={() => setGiftMenuOpen(false)}>先收好</button></footer></Modal>}
      {hearthOpen && <Modal title="炉火边" onClose={() => !hearthBusy && closeOverlay(setHearthOpen)} className="hearth-modal">
        <div className="hearth-panel"><div className={`hearth-panel-flame ${effectiveHearthLit ? 'is-lit' : ''}`}>✦</div><div><small>{isNight ? '夜色替你守着火种' : '小屋里的火光'}</small><h3>{effectiveHearthLit ? '炉火正温暖地燃着' : '炉膛里还没有火光'}</h3><p>{isNight ? '夜里的炉火会自行燃起，火上可以慢慢熬制与锻造。' : effectiveHearthLit ? '火上可以慢慢熬制山草药汤，也能熔炼蜜色琥珀。' : '点燃炉火后，才可以开始熬制与锻造。'}</p></div></div>
        <div className="hearth-recipes"><article><span>♨</span><div><strong>山草药汤</strong><small>山野药草束 {inventoryCount('herb_bundle')} / 10</small><p>供正在休养的伙伴饮用，康复并获得羁绊 +5。</p></div><button className="button button-primary" disabled={!effectiveHearthLit || hearthBusy || inventoryCount('herb_bundle') < 10} onClick={() => void craftAtHearth('herbal_soup')}>熬制</button></article><article><span>◇</span><div><strong>珍稀蜜色琥珀</strong><small>蜜色琥珀碎片 {inventoryCount('amber_chip')} / 10</small><p>送给伙伴后，羁绊 +10。</p></div><button className="button button-primary" disabled={!effectiveHearthLit || hearthBusy || inventoryCount('amber_chip') < 10} onClick={() => void craftAtHearth('honey_amber')}>锻造</button></article></div>
        <footer className="modal-footer"><button className="button button-ghost" onClick={() => closeOverlay(setHearthOpen)}>离开炉边</button>{!isNight && <button className="button button-primary" disabled={hearthBusy} onClick={() => void setFire(!hearthLit)}>{hearthLit ? '熄灭炉火' : '点燃炉火'}</button>}</footer>
      </Modal>}
      {poetryOpen && <Modal title={`吟游诗集 · ${poems.length} / 40`} onClose={() => closeOverlay(setPoetryOpen)} size="wide" className="poetry-modal">
        <div className="poetry-book-intro"><span>♪</span><div><small>THE WANDERING VERSES</small><strong>旅途中收到的诗，都在这里慢慢成册。</strong><p>每一页记着相遇的日子，也留着那位吟游诗人当时想送给你的话。</p></div><b>{String(poems.length).padStart(2, '0')}<i>/40</i></b></div>
        <div className="poetry-shelf">{poems.length === 0 ? <div className="poetry-empty"><span>◇</span><strong>诗集还没有写下第一页</strong><p>远征归来时，也许会在路边遇见愿意赠诗的吟游诗人。</p></div> : poems.map((entry, index) => <article key={entry.id}>
          <header><span>第 {String(poems.length - index).padStart(2, '0')} 页</span><time>{new Intl.DateTimeFormat('zh-CN', { year:'numeric', month:'long', day:'numeric' }).format(entry.obtained_at)}</time></header>
          <div className="poetry-verse-mark">“</div>
          <pre className="poetry-original">{entry.poem?.original || entry.poem?.text}</pre>
          {entry.poem?.translation && <pre className="poetry-translation">{entry.poem.translation}</pre>}
          <strong className="poetry-source">— {entry.poem?.source}{entry.poem?.translationCredit ? ` · ${entry.poem.translationCredit}` : ''}</strong>
          <p className="poetry-encouragement">{entry.poem?.encouragement}</p>
        </article>)}</div>
        <footer className="modal-footer"><button className="button button-primary" onClick={() => closeOverlay(setPoetryOpen)}>合上诗集</button></footer>
      </Modal>}
      {backpackOpen && <Modal title={`小屋背包 · ${world.inventory.reduce((sum, entry) => sum + Number(entry.quantity), 0)} 件`} onClose={() => closeOverlay(setBackpackOpen)} size="wide" className="cottage-backpack-modal"><div className="cottage-backpack-grid">{world.inventory.map((entry) => <CottageBackpackItem key={entry.item_id} entry={entry} onUse={requestUse} />)}{world.inventory.length === 0 && <p>背包还很轻。下一次远征，会有新的东西被带回小屋。</p>}</div><footer className="modal-footer"><button className="button button-primary" onClick={() => closeOverlay(setBackpackOpen)}>收好背包</button></footer></Modal>}
      {mapSynthesisOpen && <Modal title={unlockedMapLocation ? '新的地点已绘入地图' : '拼合手绘地图'} onClose={() => !usingItem && closeOverlay(setMapSynthesisOpen)} className="map-synthesis-modal">
        {unlockedMapLocation ? <div className="map-synthesis-reveal"><span className="map-synthesis-icon"><Icon name="map" size={34} /></span><small>新的远征地点</small><h3>{unlockedMapLocation}</h3><p>碎片间的道路终于连成一线。下次正式远征时，它会和原有地点一起出现在可抵达的边境地图中。</p></div> : <div className="map-synthesis-panel"><span className="map-synthesis-icon"><Icon name="map" size={30} /></span><div><small>尚未绘入地图的路</small><h3>手绘地图碎片</h3><p>把十张碎片铺开，缺失的地貌会慢慢在纸上显现。</p></div><strong className="map-synthesis-count">{inventoryCount('map_scrap')} <i>/ 10</i></strong><div className="map-synthesis-fragments" aria-label={`已有 ${inventoryCount('map_scrap')} 张地图碎片`}>{Array.from({ length: 10 }, (_, index) => <span key={index} className={index < inventoryCount('map_scrap') ? 'is-filled' : ''}>◇</span>)}</div></div>}
        <footer className="modal-footer">{unlockedMapLocation ? <button className="button button-primary" onClick={() => closeOverlay(setMapSynthesisOpen)}>把地图收进行囊</button> : <><button className="button button-ghost" disabled={usingItem} onClick={() => closeOverlay(setMapSynthesisOpen)}>暂不拼合</button><button className="button button-primary" disabled={usingItem || inventoryCount('map_scrap') < 10} onClick={() => void synthesizeMap()}>{usingItem ? '正在拼合…' : '拼合地图'}</button></>}</footer>
      </Modal>}
      {itemToUse && <Modal title={`使用「${itemToUse.item.name}」`} onClose={() => !usingItem && setItemToUse(null)} className="cottage-item-use-modal"><div className="hearth-panel"><div className="hearth-panel-flame"><Icon name={itemToUse.item.icon} size={24} /></div><div><small>小屋背包</small><h3>{itemToUse.item.name}</h3><p>{getItemLore(itemToUse.item).effectLabel}</p></div></div>{['herbal_soup', 'honey_amber', 'rewind_gem', 'eternal_diamond'].includes(itemToUse.item_id) && <label className="field-label">交给谁<select value={itemTargetId} onChange={(event) => { const nextId = event.target.value; setItemTargetId(nextId); setItemTargetStage(Math.max(0, Number(world.companions.owned.find((candidate) => candidate.id === nextId)?.stage || 0) - 1)) }}><option value="">请选择伙伴</option>{world.companions.owned.filter((candidate) => itemToUse.item_id !== 'herbal_soup' || candidate.is_ill).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.nickname}{candidate.is_ill ? '（休养中）' : ''}</option>)}</select></label>}{itemToUse.item_id === 'rewind_gem' && (() => { const target = world.companions.owned.find((candidate) => candidate.id === itemTargetId); const stages = Array.from({ length: Math.max(0, Number(target?.stage || 0)) }, (_, index) => index); return <label className="field-label">回到哪个形态<select value={itemTargetStage} onChange={(event) => setItemTargetStage(Number(event.target.value))} disabled={stages.length === 0}><option value="">请选择曾经的形态</option>{stages.map((stage) => <option key={stage} value={stage}>{target?.species.stages[stage]}</option>)}</select></label> })()}<footer className="modal-footer"><button className="button button-ghost" disabled={usingItem} onClick={() => setItemToUse(null)}>暂不使用</button><button className="button button-primary" disabled={usingItem || (['herbal_soup', 'honey_amber', 'rewind_gem', 'eternal_diamond'].includes(itemToUse.item_id) && !itemTargetId)} onClick={() => void useBackpackItem()}>{usingItem ? '正在使用…' : '确认使用'}</button></footer></Modal>}
    </section>
  </div>
}
