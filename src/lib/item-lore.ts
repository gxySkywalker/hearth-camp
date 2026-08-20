import type { LootItem } from '../types'

interface ItemLore {
  effectLabel: string | null
  consumesItem: boolean
  xpAwarded: number | null
  collectible?: boolean
}

const LORE: Record<string, ItemLore> = {
  copper_coin:       { effectLabel: '可在暮色商队交换罕见、稀有与珍稀遗存', consumesItem: false, xpAwarded: null },
  map_scrap:         { effectLabel: '集齐 10 张后，可拼合一处新的远征地点', consumesItem: true, xpAwarded: null },
  herb_bundle:       { effectLabel: '炉火燃着时，10 束可熬制 1 份山草药汤', consumesItem: false, xpAwarded: null, collectible: true },
  herbal_soup:       { effectLabel: '给正在休养的伙伴饮用：康复并羁绊 +5', consumesItem: true, xpAwarded: null },
  berry_bread:       { effectLabel: '交给伙伴：羁绊 +1', consumesItem: true, xpAwarded: null },
  river_stone:       { effectLabel: '涟牙及其成长形态羁绊 +3', consumesItem: true, xpAwarded: null },
  wind_hill_feather: { effectLabel: '暮羽子及其成长形态羁绊 +3', consumesItem: true, xpAwarded: null },
  flame_scatter:     { effectLabel: '炉尾及其成长形态羁绊 +3', consumesItem: true, xpAwarded: null },
  rain_moss_vein:    { effectLabel: '枝绒及其成长形态羁绊 +3', consumesItem: true, xpAwarded: null },
  violet_mist_glass: { effectLabel: '灯团及其成长形态羁绊 +3', consumesItem: true, xpAwarded: null },
  gray_pattern_stone:{ effectLabel: '小石獾及其成长形态羁绊 +3', consumesItem: true, xpAwarded: null },
  cloud_shadow_grass:{ effectLabel: '小丘及其成长形态羁绊 +3', consumesItem: true, xpAwarded: null },
  amber_chip:        { effectLabel: '炉火燃着时，10 枚可锻成 1 枚珍稀蜜色琥珀', consumesItem: false, xpAwarded: null },
  honey_amber:       { effectLabel: '送给一位伙伴：羁绊 +10', consumesItem: true, xpAwarded: null },
  moon_compass:      { effectLabel: '夜晚使用：至次日 06:00，稀有发现概率 +3%', consumesItem: true, xpAwarded: null },
  dragon_scale:      { effectLabel: '小火牙及其成长形态羁绊 +3', consumesItem: true, xpAwarded: null },
  star_glass:        { effectLabel: '下一次正式远征稀有发现概率 +10%', consumesItem: true, xpAwarded: null },
  silver_bell:       { effectLabel: '使用后消失：新伙伴相遇概率 +10%，直至相遇发生', consumesItem: true, xpAwarded: null },
  ancient_tower_page:{ effectLabel: '古塔的线索仍待解读', consumesItem: false, xpAwarded: null, collectible: true },
  rewind_gem:       { effectLabel: '让已长成的伙伴回到曾经的形态；羁绊不变，之后不再进化', consumesItem: true, xpAwarded: null },
  eternal_diamond:  { effectLabel: '交给当前同行伙伴：定格此刻形态，羁绊仍会继续增加', consumesItem: true, xpAwarded: null },
}

export function getItemLore(item: Pick<LootItem, 'id'>): ItemLore {
  return LORE[item.id] || { effectLabel: null, consumesItem: false, xpAwarded: null, collectible: true }
}
