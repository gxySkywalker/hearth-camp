import stage0Atlas from '../../assets/art/characters/companions/valley_honey_bear_stage-0_walk_32_v1.png'
import stage1Atlas from '../../assets/art/characters/companions/valley_honey_bear_stage-1_walk_32_v1.png'
import finalAtlas from '../../assets/art/characters/companions/valley_honey_bear_rock_honey_guardian_walk_32_v1.png'
import '../valley-honey-bear-sprite.css'

type Direction = 'front' | 'back' | 'left' | 'right'
type SpriteSize = 'small' | 'medium' | 'large' | 'scene'
const rowByDirection: Record<Direction, number> = { front: 0, back: 1, left: 2, right: 3 }

export function ValleyHoneyBearSprite({ direction = 'front', frame = 0, size = 'large', sleeping = false, stage = 0, evolutionPath = '' }: {
  direction?: Direction; frame?: 0 | 1 | 2 | 3; size?: SpriteSize; sleeping?: boolean; stage?: number; evolutionPath?: string
}) {
  const atlas = stage >= 2 && evolutionPath === 'rock_honey_guardian' ? finalAtlas : stage >= 1 ? stage1Atlas : stage0Atlas
  const formClass = stage >= 2 ? 'valley-honey-bear-sprite-final' : stage >= 1 ? 'valley-honey-bear-sprite-grown' : ''
  return <span className={`valley-honey-bear-sprite valley-honey-bear-sprite-${size} ${formClass}`} aria-hidden="true">
    <span className="valley-honey-bear-sprite-frame" style={{ backgroundImage: `url(${atlas})`, backgroundPosition: `${frame / 3 * 100}% ${rowByDirection[direction] / 3 * 100}%` }} />
    {sleeping && <em className="valley-honey-bear-sleep-pixels">z</em>}
  </span>
}
