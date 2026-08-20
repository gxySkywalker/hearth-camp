import emberDrakeWalkAtlas from '../../assets/art/characters/companions/ember_drake_stage-0_walk_32_v2.png'
import emberDrakeGrownWalkAtlas from '../../assets/art/characters/companions/ember_drake_stage-1_walk_32_v2.png'
import emberDrakeFinalWalkAtlas from '../../assets/art/characters/companions/ember_drake_ember_drake_walk_32_v2.png'
import '../ember-drake-sprite.css'

type Direction = 'front' | 'back' | 'left' | 'right'
type SpriteSize = 'small' | 'medium' | 'large' | 'scene'

const rowByDirection: Record<Direction, number> = { front: 0, back: 1, left: 2, right: 3 }

/** 小火牙 walks; 赤翼龙与余烬古龙 use the same four-direction atlas
 * contract while their frames depict low, continuous flight. */
export function EmberDrakeSprite({
  direction = 'front',
  frame = 0,
  size = 'large',
  sleeping = false,
  stage = 0,
  evolutionPath = '',
}: {
  direction?: Direction
  frame?: 0 | 1 | 2 | 3
  size?: SpriteSize
  sleeping?: boolean
  stage?: number
  evolutionPath?: string
}) {
  const atlas = stage >= 2 && evolutionPath === 'ember_drake'
    ? emberDrakeFinalWalkAtlas
    : stage >= 1 ? emberDrakeGrownWalkAtlas : emberDrakeWalkAtlas
  const formClass = stage >= 2 ? 'ember-drake-sprite-final' : stage >= 1 ? 'ember-drake-sprite-grown' : ''
  return <span className={`ember-drake-sprite ember-drake-sprite-${size} ${formClass}`} aria-hidden='true'>
    <span className='ember-drake-sprite-frame' style={{
      backgroundImage: `url(${atlas})`,
      backgroundPosition: `${frame / 3 * 100}% ${rowByDirection[direction] / 3 * 100}%`,
    }} />
    {sleeping && <em className='ember-drake-sleep-pixels'>z</em>}
  </span>
}
