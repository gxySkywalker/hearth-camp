import { useEffect, useMemo, useState } from 'react'
import type { Companion, CompanionGrowthEvent } from '../types'
import { PixelCompanion } from './PixelCompanion'
import { playLevelUpSound } from '../lib/audio'
import '../companion-growth-ceremony.css'

type CeremonyPhase = 'notice' | 'shift' | 'reveal' | 'complete'

const stageName = (companion: Companion, stage: number) => companion.species.stages[stage] || companion.stageName

export function CompanionGrowthCeremony({ event, onComplete }: { event: CompanionGrowthEvent; onComplete: () => void | Promise<void> }) {
  const [phase, setPhase] = useState<CeremonyPhase>('notice')
  const before = useMemo<Companion>(() => ({
    ...event.companion,
    stage: event.previous_stage,
    stageName: stageName(event.companion, event.previous_stage),
    evolution_path: '',
  }), [event])
  const after = useMemo<Companion>(() => ({ ...event.companion, stage: event.stage, stageName: stageName(event.companion, event.stage) }), [event])
  const isChestnut = event.companion.species_id === 'hearth_hound'
  const isMossSprout = event.companion.species_id === 'moss_fox'
  const isNightLightCat = event.companion.species_id === 'glimmer_cat'

  useEffect(() => {
    playLevelUpSound()
    const shift = window.setTimeout(() => setPhase('shift'), 1300)
    const reveal = window.setTimeout(() => setPhase('reveal'), 4200)
    const complete = window.setTimeout(() => setPhase('complete'), 5700)
    return () => { window.clearTimeout(shift); window.clearTimeout(reveal); window.clearTimeout(complete) }
  }, [event.id])

  const copy = phase === 'notice'
    ? `${event.companion.nickname}的身体，好像发生了一些变化……`
    : phase === 'shift'
      ? isChestnut ? '旧路的铜铃在光里轻轻响着。' : isMossSprout ? '窗外的叶影在光里轻轻摇动。' : isNightLightCat ? '尾端的小灯在光里轻轻亮起。' : '这一段共同走过的日子，在光里轻轻亮起。'
      : phase === 'reveal'
        ? '光慢慢安静下来。'
        : `${before.stageName}长成了${after.stageName}。`

  return <div className={`growth-ceremony growth-ceremony-${phase}`} role="dialog" aria-modal="true" aria-label={`${event.companion.nickname}的成长时刻`}>
    <div className="growth-ceremony-stars" aria-hidden="true"><i /><i /><i /><i /><i /></div>
    <section className="growth-ceremony-panel">
      <div className="growth-ceremony-title"><span>同行的长成</span><strong>{event.companion.nickname}</strong></div>
      <div className="growth-ceremony-stage" aria-label={`${before.stageName}长成${after.stageName}`}>
        <div className="growth-ceremony-form growth-ceremony-before"><PixelCompanion companion={before} size="large" /></div>
        <div className="growth-ceremony-form growth-ceremony-after"><PixelCompanion companion={after} size="large" /></div>
        <div className="growth-ceremony-flash" aria-hidden="true" />
      </div>
      <div className="growth-ceremony-dialogue">
        <p>{copy}</p>
        {phase === 'complete' && <>
          <small>它抬起头，像是已经认得这间小屋的每一盏灯。</small>
          <button className="button button-primary" onClick={() => void onComplete()}>把这一刻记下来</button>
        </>}
      </div>
    </section>
  </div>
}
