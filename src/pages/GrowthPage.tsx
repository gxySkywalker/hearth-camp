import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { PixelCompanion } from '../components/PixelCompanion'
import { friendlyError } from '../lib/format'
import { Icon } from '../components/Icon'
import { getCompanionCampPortrait } from '../lib/companion-camp-portrait'
import { CompanionGrowthCeremony } from '../components/CompanionGrowthCeremony'
import { ItemTooltip } from '../components/ItemTooltip'
import { Modal } from '../components/Modal'
import { getItemLore } from '../lib/item-lore'
import type { Companion, CompanionGrowthEvent, LootItem } from '../types'
import '../companion-camp-portrait.css'
import '../companion-camp-v2.css'

const formatDay = (timestamp?: number | null) => timestamp
  ? new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(timestamp)
  : null

const daysTogether = (timestamp: number) => Math.max(1, Math.floor((Date.now() - timestamp) / 86_400_000) + 1)

const bondChapter = (companion: Companion) => {
  if (companion.stage >= 2) return { name: '长成', range: '200+', note: '它已经以那一刻的天光，长成了更完整的自己。', next: 200 }
  if (companion.stage === 1) return { name: '同行', range: '100–199', note: '它已经记住你的脚步，也开始把小屋当作归处。', next: 200 }
  return { name: '初识', range: '0–99', note: '旧路已经走过；新的日子，正从炉火旁慢慢开始。', next: 100 }
}

const chestnutIntroduction = '它陪你走过抵达边境前的旧路，也和你一起推开炉火小屋的门。它不替你决定方向；只是总会先闻一闻路，再回头确认你是否还在身后。'
const mossSproutIntroduction = '它住在林缘的苔石与树根之间，不替你带路，也不替你寻找答案。它只是陪你停一下，看见风、落叶与雨后的水痕原来一直在变化。'
const nightLightCatIntroduction = '它常在窗台与夜灯旁停留。尾端的一点光不替你照亮前路，只让安静的夜里，也有一盏灯愿意和你待在一起。'
const duskOwlIntroduction = '它停在旧塔、书页与夜风经过的高处，不替你寻找答案。它只是陪你在夜色里停一会儿，让还没说出口的念头也有地方留下。'

type InventoryEntry = { item_id: string; quantity: number; item: LootItem; updated_at: number }

function CampBackpackItem({ entry, onRequestUse }: { entry: InventoryEntry; onRequestUse: (entry: InventoryEntry) => void }) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hover, setHover] = useState(false)
  const lore = getItemLore(entry.item)
  const show = () => { timerRef.current = setTimeout(() => setHover(true), 200) }
  const hide = () => { if (timerRef.current) clearTimeout(timerRef.current); setHover(false) }
  return <>
    <button type="button" ref={triggerRef} className={`camp-v2-backpack-item ${entry.item.rarity} ${lore.consumesItem ? 'can-use' : 'collectible'}`} onClick={() => lore.consumesItem && onRequestUse(entry)} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      <span><Icon name={entry.item.icon} size={18} /></span><strong>{entry.item.name}</strong><b>×{entry.quantity}</b>
      <small>{lore.consumesItem ? '点击使用' : '收藏中'}</small>
    </button>
    <ItemTooltip item={entry.item} quantity={entry.quantity} triggerRef={triggerRef} visible={hover} />
  </>
}

export function GrowthPage() {
  const { dashboard, refresh, notify } = useApp()
  const [selectedId, setSelectedId] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)
  const [nicknameDraft, setNicknameDraft] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [pendingGrowth, setPendingGrowth] = useState<CompanionGrowthEvent | null>(null)
  const [itemToUse, setItemToUse] = useState<InventoryEntry | null>(null)
  const [itemTargetId, setItemTargetId] = useState('')
  const [usingItem, setUsingItem] = useState(false)
  useEffect(() => {
    if (dashboard?.world.pendingGrowthEvent) setPendingGrowth(dashboard.world.pendingGrowthEvent)
  }, [dashboard?.world.pendingGrowthEvent])
  if (!dashboard) return null
  const { companions, inventory } = dashboard.world
  const selected = companions.owned.find((item) => item.id === selectedId) || companions.active || companions.owned[0] || null
  const selectedPortrait = selected ? getCompanionCampPortrait(selected) : null
  const chapter = selected ? bondChapter(selected) : null
  const isChestnut = selected?.species_id === 'hearth_hound'
  const isMossSprout = selected?.species_id === 'moss_fox'
  const isNightLightCat = selected?.species_id === 'glimmer_cat'
  const isDuskOwl = selected?.species_id === 'moon_owl'
  const isCloudRabbit = selected?.species_id === 'cloud_rabbit'
  const isEmberDrake = selected?.species_id === 'ember_drake'
  const progress = selected && chapter ? selected.stage >= 2 ? 100 : Math.min(100, selected.bond_xp / chapter.next * 100) : 0
  const togetherDays = selected ? daysTogether(selected.met_at) : 0
  const growthForms = selected ? [0, 1, 2].map((stage) => ({
    ...selected,
    stage,
    evolution_path: stage === 2 ? selected.evolution_path : '',
  })) : []

  const setAsHomeCompanion = async (id: string) => {
    try {
      await window.growthArc.companions.setActive(id)
      notify('它已经回到炉火小屋，等你下次推门回家。', 'success')
      await refresh()
    } catch (error) { notify(friendlyError(error), 'error') }
  }

  const openRename = () => {
    if (!selected) return
    setNicknameDraft(selected.nickname)
    setRenameOpen(true)
  }

  const rename = async () => {
    if (!selected || renaming) return
    try {
      setRenaming(true)
      const renamed = await window.growthArc.companions.rename(selected.id, nicknameDraft)
      notify(`${renamed.nickname}听见了这个名字。`, 'success')
      setRenameOpen(false)
      await refresh()
    } catch (error) { notify(friendlyError(error), 'error') } finally { setRenaming(false) }
  }

  const completeGrowthCeremony = async () => {
    if (!pendingGrowth) return
    try {
      await window.growthArc.companions.markGrowthSeen(pendingGrowth.id)
      await refresh()
    } catch (error) { notify(friendlyError(error), 'error') } finally { setPendingGrowth(null) }
  }

  const useInventoryItem = async () => {
    if (!itemToUse || usingItem) return
    try {
      setUsingItem(true)
      const targeted = itemToUse.item_id === 'herbal_soup' || itemToUse.item_id === 'honey_amber'
      if (targeted && !itemTargetId) throw new Error('请先选择一位伙伴')
      const result = targeted
        ? await window.growthArc.inventory.useTarget(itemToUse.item_id, itemTargetId)
        : await window.growthArc.inventory.use(itemToUse.item_id)
      notify(result.effect, 'success')
      if (result.growthEvent) setPendingGrowth(result.growthEvent)
      setItemToUse(null)
      await refresh()
    } catch (error) { notify(friendlyError(error), 'error') } finally { setUsingItem(false) }
  }

  return <div className="page companions-page companion-camp-v2">
    <header className="page-heading camp-v2-heading">
      <div><span className="day-ribbon">伙伴营地</span><h1>同行过的路，也会留在这里。</h1><p>伙伴不是远征的奖品。它们有自己的小习惯，也会把和你一起走过的日子记下来。</p></div>
      <div className="collection-count"><strong>{companions.owned.length}</strong><span>/ {companions.total} 已相遇</span></div>
    </header>

    <section className="camp-v2-layout">
      <aside className="camp-v2-dex" aria-label="同行图鉴">
        <div className="camp-v2-section-title"><span>◇</span><div><small>同行图鉴</small><strong>已经相遇</strong></div></div>
        <div className="camp-v2-list">
          {companions.owned.map((companion) => <button key={companion.id} onClick={() => setSelectedId(companion.id)} className={selected?.id === companion.id ? 'selected' : ''}>
            <PixelCompanion companion={companion} size="small" />
            <span><strong>{companion.nickname}</strong><small>{companion.stageName}</small></span>
            {companion.is_ill ? <i title="正在休养">休养中</i> : companion.is_active ? <i title="正在炉火小屋等候">⌂</i> : null}
          </button>)}
        </div>
        <p className="camp-v2-dex-note">尚未相遇的身影，不需要追赶。路走到那里时，自会听见新的脚步声。</p>
      </aside>

      {selected && chapter && <article className="camp-v2-profile">
        <div className={`camp-v2-portrait species-${selected.species_id} ${selectedPortrait ? 'has-portrait' : ''}`}>
          <div className="camp-v2-portrait-copy"><span>{isChestnut ? '最初的同行伙伴' : isMossSprout ? '林缘的同行者' : isNightLightCat ? '夜灯旁的朋友' : isDuskOwl ? '夜色里的同行者' : isCloudRabbit ? '丘陵上的同行者' : isEmberDrake ? '远山的同行者' : '旅途中的朋友'}</span><strong>{isChestnut ? '旧路的铃声，还在炉火旁轻轻响。' : isMossSprout ? '风吹开落叶时，它总会停下来多看一会儿。' : isNightLightCat ? '它的尾灯没有催促什么，只安静地亮在窗边。' : isDuskOwl ? '有些还没说出口的念头，也值得被安静地留在夜色里。' : isCloudRabbit ? '云影慢慢移过草坡时，它也不急着起身。' : isEmberDrake ? '它把收好的翼膜轻轻贴近身侧，看向还没有画进地图的远方。' : '每一次相遇，都有它自己的来处。'}</strong></div>
          {selectedPortrait ? <img className="companion-camp-portrait" src={selectedPortrait} alt={`${selected.nickname}的营地肖像`} /> : <PixelCompanion companion={selected} />}
          <div className="camp-v2-portrait-floor" />
        </div>

        <div className="camp-v2-profile-copy">
          <span className="camp-v2-species">{selected.stageName} · {selected.species.kind}</span>
          <div className="camp-v2-name-row"><h2>{selected.nickname}</h2><button className="camp-v2-rename" onClick={openRename} title="给伙伴改名">改名</button></div>
          <p className="camp-v2-stage">{selected.stageName} <span>·</span> 羁绊章节：{chapter.name}</p>
          {Boolean(selected.is_ill) && <p className="camp-v2-home-mark">✚ 它正在小屋里休养，暂时不会出征或在炉火旁等候。</p>}
          <div className="camp-v2-together"><span>与你同行第 {togetherDays} 天</span><small>{formatDay(selected.met_at)}，这段同行被记在旅途的第一页。</small></div>
          <p className="camp-v2-introduction">{isChestnut ? chestnutIntroduction : isMossSprout ? mossSproutIntroduction : isNightLightCat ? nightLightCatIntroduction : isDuskOwl ? duskOwlIntroduction : selected.species.description}</p>
          <div className="camp-v2-home-note"><span>⌂</span><p>{selected.personalityProfile.habit}。{isMossSprout ? '在小屋里，它也会安静看着窗边的光影移动。' : isNightLightCat ? '在小屋里，它不必说话，只把尾灯留在离你不远的地方。' : isDuskOwl ? '在小屋里，它把翅膀轻轻收好，停在离夜风不远的地方。' : isCloudRabbit ? '在小屋里，它把耳朵贴在晒暖的地板上，等一阵风穿过门缝。' : isEmberDrake ? '在小屋里，它把翼膜收好，鼻尖的一点暖气很快和屋里的风混在一起。' : '在小屋里，它把这当作一件不必解释的小事。'}</p></div>

          <div className="camp-v2-bond" aria-label={`羁绊 ${selected.bond_xp}`}>
            <div><span>共同走过</span><strong>{selected.bond_xp} <small>/ {chapter.next}</small></strong></div>
            <div className="camp-v2-bond-track"><i style={{ width: `${progress}%` }} /></div>
            <p>{chapter.note}</p>
          </div>

          {!selected.is_active && !selected.is_ill && <button className="button button-primary" onClick={() => void setAsHomeCompanion(selected.id)}>让它在炉火小屋等候</button>}
          {Boolean(selected.is_active) && <span className="camp-v2-home-mark">⌂ 正在炉火小屋等候你回来</span>}
        </div>
      </article>}
    </section>

    {selected && chapter && <section className="camp-v2-story-grid">
      <article className="parchment-card camp-v2-personality">
        <header><div><span className="card-sigil">✦</span><div><small>它的小小模样</small><h2>属于{selected.nickname}的习惯</h2></div></div></header>
        <div className="camp-v2-traits">
          <div><small>性格印象</small><strong>{selected.personalityProfile.personalityTrait}</strong></div>
          <div><small>生活习惯</small><strong>{selected.personalityProfile.habit}</strong></div>
          <div><small>小毛病</small><strong>{selected.personalityProfile.quirk}</strong></div>
        </div>
          <p>这些在相遇时便被悄悄记下，不会让它变强或变弱；它们只会出现在你们的交谈、冒险日志和共同记忆里。</p>
      </article>

      <article className="parchment-card camp-v2-growth">
        <header><div><span className="card-sigil">◇</span><div><small>成长，不是强化</small><h2>伙伴的成长</h2></div></div></header>
        <div className="camp-v2-growth-line">
          <div className={selected.stage >= 0 ? 'reached' : ''}><i>01</i><span className="camp-v2-growth-form"><PixelCompanion companion={growthForms[0]} size="small" /></span><strong>{isChestnut ? '炉尾' : selected.species.stages[0]}</strong><small>0 羁绊起</small></div>
          <span />
          <div className={selected.stage >= 1 ? 'reached' : ''}><i>02</i>{selected.stage >= 1 && <span className="camp-v2-growth-form"><PixelCompanion companion={growthForms[1]} size="small" /></span>}<strong>{isChestnut ? '栗鬃' : selected.species.stages[1]}</strong><small>100 羁绊</small></div>
          <span />
          <div className={selected.stage >= 2 ? 'reached' : ''}><i>03</i>{selected.stage >= 2 && <span className="camp-v2-growth-form"><PixelCompanion companion={growthForms[2]} size="small" /></span>}<strong>{selected.stage >= 2 ? selected.stageName : '长成'}</strong><small>200 羁绊</small></div>
        </div>
        <p>{selected.stage >= 2 ? `${selected.nickname}在${formatDay(selected.growth_completed_at) || '那一天'}长成了「${selected.stageName}」。` : isChestnut ? '当羁绊抵达 200，它会在那一刻的天光里长成；白日、傍晚与夜晚，留下的是不同的陪伴方式，而非强弱。' : isMossSprout ? '当羁绊抵达 200，它会长成「森冠」；这不是更强，而是你们已经一起熟悉了森林的变化。' : isNightLightCat ? '当羁绊抵达 200，它会长成「夜璃」；不是为了照亮更远的路，而是让同处的夜色变得熟悉。' : '当羁绊抵达 200，它会在共同经历中长成更完整的自己。'}</p>
      </article>
    </section>}

    {selected && <section className="parchment-card camp-v2-memories">
      <header><div><span className="card-sigil">▣</span><div><small>共同记忆</small><h2>你们一起留下的页码</h2></div></div></header>
      <div className="camp-v2-memory-list">{selected.memories.map((memory, index) => <article key={`${memory.at}-${index}`}><span>{index === 0 ? '✦' : '◇'}</span><p>{memory.text}</p>{memory.at ? <small>{formatDay(memory.at)}</small> : null}</article>)}</div>
    </section>}

    <section className="camp-v2-bottom-grid">
      <article className="parchment-card">
        <header><div><span className="card-sigil">◇</span><div><small>伙伴图鉴</small><h2>仍在世界各处生活的朋友</h2></div></div></header>
        <div className="catalog-grid">{companions.catalog.map((species) => {
          const companion = companions.owned.find((item) => item.species_id === species.id)
          return <div className={species.discovered ? 'discovered' : 'unknown'} key={species.id}>
            <span className="catalog-companion-icon">{companion ? <PixelCompanion companion={companion} size="small" /> : '?'}</span><strong>{species.discovered ? species.name : '尚未相遇'}</strong><small>{species.discovered ? species.kind : '也许会在某段旅途里留下踪迹'}</small>
          </div>
        })}</div>
      </article>
      <article className="parchment-card backpack-card">
        <header><div><span className="card-sigil">▣</span><div><small>共同背包</small><h2>带回小屋的东西</h2></div></div><span className="soft-count">{inventory.reduce((sum, entry) => sum + Number(entry.quantity), 0)} 件</span></header>
        <div>{inventory.slice(0, 8).map((entry) => <CampBackpackItem key={entry.item_id} entry={entry} onRequestUse={(next) => { setItemToUse(next); setItemTargetId(next.item_id === 'herbal_soup' ? companions.owned.find((companion) => companion.is_ill)?.id || '' : selected?.id || '') }} />)}{inventory.length === 0 && <p className="empty-copy">第一次返航后，带回来���东西会被好好收在这里。</p>}</div>
      </article>
    </section>

    {selected && renameOpen && <div className="camp-v2-rename-dialog-backdrop" role="presentation" onMouseDown={() => !renaming && setRenameOpen(false)}>
      <section className="camp-v2-rename-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-companion-title" onMouseDown={(event) => event.stopPropagation()}>
        <span className="day-ribbon">伙伴名牌</span>
        <h2 id="rename-companion-title">想怎样称呼{selected.nickname}？</h2>
        <p>名字会留在小屋、共同记忆与之后的旅途里。它仍是陪你走过旧路的那个朋友。</p>
        <input autoFocus value={nicknameDraft} maxLength={12} onChange={(event) => setNicknameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void rename(); if (event.key === 'Escape') setRenameOpen(false) }} aria-label="伙伴的新名字" />
        <small>最多 12 个字</small>
        <div><button className="button button-ghost" disabled={renaming} onClick={() => setRenameOpen(false)}>先不改了</button><button className="button button-primary" disabled={renaming || !nicknameDraft.trim()} onClick={() => void rename()}>{renaming ? '写入名牌…' : '把名字系在铜铃上'}</button></div>
      </section>
    </div>}
    {itemToUse && <Modal title={`使用「${itemToUse.item.name}」`} onClose={() => !usingItem && setItemToUse(null)} className="camp-v2-item-use-modal">
      <div className="modal-body camp-v2-item-use-body"><span><Icon name={itemToUse.item.icon} size={28} /></span><div><strong>{itemToUse.item.name}</strong><p>{getItemLore(itemToUse.item).effectLabel}</p><small>使用后会消耗 1 件。</small></div></div>
      {(itemToUse.item_id === 'herbal_soup' || itemToUse.item_id === 'honey_amber') && <label className="field-label">交给谁<select value={itemTargetId} onChange={(event) => setItemTargetId(event.target.value)}><option value="">请选择伙伴</option>{companions.owned.filter((companion) => itemToUse.item_id !== 'herbal_soup' || companion.is_ill).map((companion) => <option key={companion.id} value={companion.id}>{companion.nickname}{companion.is_ill ? '（休养中）' : ''}</option>)}</select></label>}
      <footer className="modal-footer"><button className="button button-ghost" disabled={usingItem} onClick={() => setItemToUse(null)}>暂不使用</button><button className="button button-primary" disabled={usingItem} onClick={() => void useInventoryItem()}>{usingItem ? '正在使用…' : '确认使用'}</button></footer>
    </Modal>}
    {pendingGrowth && <CompanionGrowthCeremony event={pendingGrowth} onComplete={completeGrowthCeremony} />}
  </div>
}
