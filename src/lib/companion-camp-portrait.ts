import type { Companion } from '../types'
import emberDrakeStage0PortraitV2 from '../../assets/art/characters/companions/ember_drake_stage-0_camp_portrait_v2.png'

const portraits = import.meta.glob<string>('../../assets/art/characters/companions/*_camp_portrait_v1.png', {
  eager: true,
  import: 'default',
  query: '?url',
})

const portraitPath = (speciesId: string, form: string) =>
  `../../assets/art/characters/companions/${speciesId}_${form}_camp_portrait_v1.png`

/** Optional camp portrait. Adding a future growth portrait with the same
 * filename convention makes it selectable without changing page code. */
export function getCompanionCampPortrait(companion: Companion) {
  // An evolution route is meaningful only for the final chapter. Older saves
  // can retain a route value early, but must never render a final-form portrait.
  const stage = Number(companion.stage) || 0
  const form = stage >= 2 && companion.evolution_path
    ? companion.evolution_path
    : `stage-${stage}`
  if (companion.species_id === 'ember_drake' && form === 'stage-0') return emberDrakeStage0PortraitV2
  return portraits[portraitPath(companion.species_id, form)]
    || portraits[portraitPath(companion.species_id, 'stage-0')]
    || null
}
