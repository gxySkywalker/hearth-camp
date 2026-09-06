import type { Companion } from '../types'
import { HearthHoundSprite } from './HearthHoundSprite'
import { MossFoxSprite } from './MossFoxSprite'
import { NightLightCatSprite } from './NightLightCatSprite'
import { RiverOtterSprite } from './RiverOtterSprite'
import { IronBadgerSprite } from './IronBadgerSprite'
import { DuskOwlSprite } from './DuskOwlSprite'
import { CloudRabbitSprite } from './CloudRabbitSprite'
import { EmberDrakeSprite } from './EmberDrakeSprite'
import { ValleyHoneyBearSprite } from './ValleyHoneyBearSprite'
import { CloudfieldSheepSprite } from './CloudfieldSheepSprite'

export function PixelCompanion({ companion, size = 'large', sleeping = false }: { companion: Companion | null; size?: 'small' | 'medium' | 'large'; sleeping?: boolean }) {
  const speciesId = companion?.species_id || 'hearth_hound'
  const palette = companion?.species?.palette || 'honey'
  if (speciesId === 'hearth_hound') {
    return <HearthHoundSprite size={size} sleeping={sleeping} stage={companion?.stage || 0} evolutionPath={companion?.evolution_path || ''} />
  }
  if (speciesId === 'moss_fox') {
    return <MossFoxSprite size={size} sleeping={sleeping} stage={companion?.stage || 0} evolutionPath={companion?.evolution_path || ''} />
  }
  if (speciesId === 'glimmer_cat') {
    return <NightLightCatSprite size={size} sleeping={sleeping} stage={companion?.stage || 0} evolutionPath={companion?.evolution_path || ''} />
  }
  if (speciesId === 'river_otter') {
    return <RiverOtterSprite size={size} sleeping={sleeping} stage={companion?.stage || 0} evolutionPath={companion?.evolution_path || ''} />
  }
  if (speciesId === 'iron_badger') {
    return <IronBadgerSprite size={size} sleeping={sleeping} stage={companion?.stage || 0} evolutionPath={companion?.evolution_path || ''} />
  }
  if (speciesId === 'moon_owl') {
    return <DuskOwlSprite size={size} sleeping={sleeping} stage={companion?.stage || 0} evolutionPath={companion?.evolution_path || ''} />
  }
  if (speciesId === 'cloud_rabbit') {
    return <CloudRabbitSprite size={size} sleeping={sleeping} stage={companion?.stage || 0} evolutionPath={companion?.evolution_path || ''} />
  }
  if (speciesId === 'ember_drake') {
    return <EmberDrakeSprite size={size} sleeping={sleeping} stage={companion?.stage || 0} evolutionPath={companion?.evolution_path || ''} />
  }
  if (speciesId === 'valley_honey_bear') {
    return <ValleyHoneyBearSprite size={size} sleeping={sleeping} stage={companion?.stage || 0} evolutionPath={companion?.evolution_path || ''} />
  }
  if (speciesId === 'cloudfield_sheep') {
    return <CloudfieldSheepSprite size={size} sleeping={sleeping} stage={companion?.stage || 0} evolutionPath={companion?.evolution_path || ''} />
  }
  return <div
    className={`pixel-companion sprite-${speciesId} palette-${palette} sprite-${size} stage-${companion?.stage || 0} ${sleeping ? 'is-sleeping' : ''}`}
    role="img"
    aria-label={companion ? `${companion.nickname}，${companion.stageName}` : '等待同行的伙伴'}
  >
    <i className="sprite-shadow" />
    <i className="sprite-tail" />
    <i className="sprite-wing sprite-wing-back" />
    <i className="sprite-body" />
    <i className="sprite-wing sprite-wing-front" />
    <i className="sprite-head">
      <b className="sprite-ear sprite-ear-left" />
      <b className="sprite-ear sprite-ear-right" />
      <b className="sprite-eye sprite-eye-left" />
      <b className="sprite-eye sprite-eye-right" />
      <b className="sprite-snout" />
    </i>
    <i className="sprite-foot sprite-foot-left" />
    <i className="sprite-foot sprite-foot-right" />
    {sleeping && <em className="sleep-pixels">z</em>}
  </div>
}
