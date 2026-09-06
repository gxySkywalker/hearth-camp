import stage0Atlas from '../../assets/art/characters/companions/cloudfield_sheep_stage-0_walk_32_v1.png'
import stage1Atlas from '../../assets/art/characters/companions/cloudfield_sheep_stage-1_walk_32_v1.png'
import finalAtlas from '../../assets/art/characters/companions/cloudfield_sheep_morning_breeze_walk_32_v1.png'
import '../cloudfield-sheep-sprite.css'

type Direction = 'front' | 'back' | 'left' | 'right'
type SpriteSize = 'small' | 'medium' | 'large' | 'scene'
const rowByDirection: Record<Direction, number> = { front: 0, back: 1, left: 2, right: 3 }

export function CloudfieldSheepSprite({ direction = 'front', frame = 0, size = 'large', sleeping = false, stage = 0, evolutionPath = '' }: {
  direction?: Direction; frame?: 0 | 1 | 2 | 3; size?: SpriteSize; sleeping?: boolean; stage?: number; evolutionPath?: string
}) {
  const atlas = stage >= 2 && evolutionPath === 'morning_breeze' ? finalAtlas : stage >= 1 ? stage1Atlas : stage0Atlas
  const formClass = stage >= 2 ? 'cloudfield-sheep-sprite-final' : stage >= 1 ? 'cloudfield-sheep-sprite-grown' : ''
  return <span className={`cloudfield-sheep-sprite cloudfield-sheep-sprite-${size} ${formClass}`} aria-hidden="true">
    <span className="cloudfield-sheep-sprite-frame" style={{ backgroundImage: `url(${atlas})`, backgroundPosition: `${frame / 3 * 100}% ${rowByDirection[direction] / 3 * 100}%` }} />
    {sleeping && <em className="cloudfield-sheep-sleep-pixels">z</em>}
  </span>
}
