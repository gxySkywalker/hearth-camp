const crypto = require('node:crypto')

const COMPANION_SPECIES = [
  {
    id: 'hearth_hound',
    name: '炉尾',
    defaultNickname: '栗子',
    kind: '边境同行犬',
    rarity: 'starter',
    palette: 'honey',
    finalGrowthMode: 'time_branch',
    description: '与你走过抵达边境前的旧路。它记得回家的方向，也记得总要回头确认你是否跟在身后。',
    stages: ['炉尾', '栗鬃', '长成'],
    evolutions: [
      { id: 'ember_tail', name: '炭尾', note: '在白日的炉火与归途中长成。' },
      { id: 'pine_shadow', name: '松影', note: '在傍晚的风与林影之间长成。' },
      { id: 'moon_paw', name: '月爪', note: '在夜色、地图与远路旁长成。' },
    ],
  },
  {
    id: 'ember_drake',
    name: '古龙',
    kind: '古龙',
    defaultNickname: '小火牙',
    rarity: 'rare',
    palette: 'ember',
    finalGrowthMode: 'single',
    description: '栖在边境群山与未完整绘入地图的山脊。它不带人飞向远方，只让人学会敬意地看见未知。',
    stages: ['小火牙', '赤翼龙', '余烬古龙'],
    evolutions: [
      { id: 'ember_drake', name: '余烬古龙', note: '把与你一起看过、尚未抵达的远方，留成温暖而克制的记忆。' },
    ],
  },
  {
    id: 'moss_fox',
    name: '枝绒',
    kind: '林缘小狐',
    defaultNickname: '苔芽',
    rarity: 'common',
    palette: 'moss',
    finalGrowthMode: 'single',
    description: '住在林缘的苔石与树根之间。它不带路，只会让你看见林中悄悄变换的风、叶与水痕。',
    stages: ['枝绒', '苔亚', '森冠'],
    evolutions: [
      { id: 'forest_crown', name: '森冠', note: '和旅人一起学会留意森林中每一次细微的变化。' },
    ],
  },
  {
    id: 'moon_owl',
    name: '暮羽子',
    kind: '月塔鸮',
    defaultNickname: '暮羽子',
    rarity: 'common',
    palette: 'moon',
    finalGrowthMode: 'single',
    description: '栖在旧塔与书塔的高处。它不替人找答案，只让人愿意把夜里尚未说出口的念头安静留下。',
    stages: ['暮羽子', '咕夜枭', '冥翔鹰鸮'],
    evolutions: [
      { id: 'dusk_owl', name: '冥翔鹰鸮', note: '把与你一起停过的夜色，留成一页安静的远望。' },
    ],
  },
  {
    id: 'river_otter',
    name: '涟牙',
    kind: '河湾水獭',
    defaultNickname: '涟牙',
    rarity: 'common',
    palette: 'river',
    finalGrowthMode: 'single',
    description: '常在河湾、浅滩与旧石桥旁停留。它不带人渡河，只陪人听水流经过石缝的声音。',
    stages: ['涟牙', '漪爪', '湾澜'],
    evolutions: [
      { id: 'bay_current', name: '湾澜', note: '把与你一起停留过的河岸，留成一段缓慢流动的时间。' },
    ],
  },
  {
    id: 'cloud_rabbit',
    name: '云丘垂耳兔',
    kind: '云丘垂耳兔',
    defaultNickname: '小丘',
    rarity: 'rare',
    palette: 'cloud',
    finalGrowthMode: 'single',
    description: '住在开阔丘陵与风车古道旁。它不催人追上远方，只陪人知道慢一点也没有关系。',
    stages: ['小丘', '云丘兔', '风茸旅兔'],
    evolutions: [
      { id: 'wind_tuft_rabbit', name: '风茸旅兔', note: '把与你一起慢慢走过的开阔草坡，留成不必着急的陪伴。' },
    ],
  },
  {
    id: 'iron_badger',
    name: '石铁獾',
    kind: '石铁獾',
    defaultNickname: '小石獾',
    rarity: 'rare',
    palette: 'iron',
    finalGrowthMode: 'single',
    description: '住在旧石阶、山脚与石墙旁。它不替人锻造什么，只会让人留意脚下仍被好好放稳的石头。',
    stages: ['小石獾', '岩甲獾', '铠獾王'],
    evolutions: [
      { id: 'armor_king', name: '铠獾王', note: '把一起走过的崎岖路段，留成安稳的陪伴。' },
    ],
  },
  {
    id: 'glimmer_cat',
    name: '灯团',
    kind: '夜灯小猫',
    defaultNickname: '灯团',
    rarity: 'rare',
    palette: 'violet',
    finalGrowthMode: 'single',
    description: '常在小镇的窗台与夜灯旁停留。它的尾端像一盏安静的小灯，不替人照路，只陪人待过夜色。',
    stages: ['灯团', '星烛', '夜璃'],
    evolutions: [
      { id: 'night_glass', name: '夜璃', note: '把与你共处的安静，留成一盏稳定的灯。' },
    ],
  },
  {
    id: 'valley_honey_bear',
    name: '山谷蜜熊',
    kind: '山谷蜜熊',
    defaultNickname: '小蜜熊',
    rarity: 'rare',
    palette: 'honey',
    finalGrowthMode: 'single',
    description: '生活在向阳山谷、野蜂林与松果坡之间。它喜欢慢慢收拢散落的暖意，也愿意在疲惫的时候安静陪人坐一会儿。',
    stages: ['小蜜熊', '暖掌熊', '岩蜜守熊'],
    evolutions: [
      { id: 'rock_honey_guardian', name: '岩蜜守熊', note: '把与你一起珍惜过的温暖，留成像山岩一样安稳的陪伴。' },
    ],
  },
  {
    id: 'cloudfield_sheep',
    name: '云野绵羊',
    kind: '云野绵羊',
    defaultNickname: '咩咩',
    rarity: 'rare',
    palette: 'cloud',
    finalGrowthMode: 'single',
    description: '生活在晨雾尚未散尽的高野牧坡。它不会替人赶路，只会在风重新吹起时，陪人把今天当作一段新的开始。',
    stages: ['咩咩', '咩咩羊', '晨风绵羊'],
    evolutions: [
      { id: 'morning_breeze', name: '晨风绵羊', note: '把与你一起迎接过的清晨，留成一阵允许重新出发的风。' },
    ],
  },
]

const LOOT = [
  { id: 'copper_coin', name: '旧王朝铜币', rarity: 'common', icon: 'coin', description: '边缘已经磨圆，仍能看见王冠的纹样。可在暮色商队换取旅途遗存。' },
  { id: 'map_scrap', name: '手绘地图碎片', rarity: 'common', icon: 'map', description: '攒够十张，可以拼成一处尚未绘入地图的远征地点。' },
  { id: 'herb_bundle', name: '山野药草束', rarity: 'common', icon: 'herb', description: '带着太阳晒过后的清香。炉火燃着时，十束可熬成一份山草药汤。' },
  { id: 'berry_bread', name: '莓果旅行面包', rarity: 'common', icon: 'bread', description: '伙伴们很喜欢的远征口粮。' },
  { id: 'river_stone', name: '河岸圆石', rarity: 'uncommon', icon: 'wave', description: '被河水磨得温润圆滑。涟牙会把它悄悄排在身边。' },
  { id: 'wind_hill_feather', name: '风丘羽毛', rarity: 'uncommon', icon: 'star', description: '沾着高处风声的羽毛。暮羽子会在夜里认出它。' },
  { id: 'flame_scatter', name: '烈焰焚碎', rarity: 'uncommon', icon: 'flame', description: '炉火曾经炙热地掠过它，留下了不肯熄灭的暖意。栗子会认得这份旧路上的温度。' },
  { id: 'rain_moss_vein', name: '雨苔叶脉', rarity: 'uncommon', icon: 'herb', description: '雨后贴在苔石边的一片叶子，叶脉里还留着细小水光。' },
  { id: 'violet_mist_glass', name: '紫雾碎璃', rarity: 'uncommon', icon: 'gem', description: '雾紫色的碎璃映着未熄的窗灯，像一小段安静的夜色。' },
  { id: 'gray_pattern_stone', name: '灰纹石片', rarity: 'uncommon', icon: 'scale', description: '从旧石阶边自然剥落的浅灰石片，雨水已将边缘磨圆。' },
  { id: 'cloud_shadow_grass', name: '云影草穗', rarity: 'uncommon', icon: 'herb', description: '云影经过晒暖草坡时，轻轻压弯又重新抬起的一穗草。' },
  { id: 'beeswax_pinecone', name: '蜜蜡松果', rarity: 'uncommon', icon: 'gem', description: '沾着淡淡松脂与蜂蜜香气的松果。小蜜熊会用温暖的前掌把它轻轻拢在身边。' },
  { id: 'old_shepherd_bell_tassel', name: '旧牧铃穗', rarity: 'uncommon', icon: 'bell', description: '从旧牧铃边自然松落的一小束软穗，仍留着清晨风吹过草坡时的轻响。咩咩会认出它。' },
  { id: 'amber_chip', name: '蜜色琥珀碎片', rarity: 'rare', icon: 'gem', description: '靠近炉火时会微微发亮。炉火燃着时，十枚可锻成珍稀蜜色琥珀。' },
  { id: 'moon_compass', name: '月银罗盘', rarity: 'rare', icon: 'compass', description: '指针不朝北方，只朝向仍未发现的宝藏。' },
  { id: 'dragon_scale', name: '古龙鳞片', rarity: 'rare', icon: 'scale', description: '温热而坚硬，来自很久以前的一次蜕鳞。' },
  { id: 'star_glass', name: '星辉玻璃', rarity: 'rare', icon: 'star', description: '无论白天黑夜，里面都像装着一小片星空。' },
  { id: 'silver_bell', name: '旅者银铃', rarity: 'precious', icon: 'bell', description: '只有新朋友靠近时才会响起；铃声会一直留到相遇发生。' },
  { id: 'ancient_tower_page', name: '古塔残页', rarity: 'precious', icon: 'book', description: '残页边缘写着尚未辨认的塔名。' },
  // 这两件遗存只会由暮色商队带来；它们不进入普通远征掉落池。
  { id: 'rewind_gem', name: '回溯宝石', rarity: 'precious', icon: 'gem', merchantOnly: true, description: '像封着一段倒流的微光。可让已经长成的伙伴回到曾走过的形态；羁绊不会减少，但此后不再继续进化。' },
  { id: 'eternal_diamond', name: '永恒钻石', rarity: 'precious', icon: 'gem', merchantOnly: true, description: '象征不变誓言的清澈晶石。交给当前同行伙伴后，它会安住在此刻的模样；羁绊仍会继续累积。' },
  { id: 'herbal_soup', name: '山草药汤', rarity: 'rare', icon: 'herb', description: '在炉火上慢慢熬开的山野药草，带着一点安静的暖意。' },
  { id: 'honey_amber', name: '珍稀蜜色琥珀', rarity: 'precious', icon: 'gem', description: '由十枚蜜色琥珀碎片在炉火中熔成，像封住了一小段温暖日光。' },
]

const LOCATIONS = ['长满常春藤的旧城门', '松林深处的石桥', '山脚下的废弃驿站', '河谷旁的圆顶塔楼', '风车丘陵的古道', '王城外的莓果林']
// 手绘地图碎片会从这份固定的边境地点池中随机绘出一处。它们不是任务、资源点或效率加成，
// 只是让旅人可抵达、可记住的新一段路。
const MAP_FRAGMENT_LOCATIONS = [
  '晒暖草坡',
  '雾谷石阶',
  '白石河渡口',
  '松风林旧营地',
  '旧望丘陵烽火台',
  '风车丘陵的麦穗岔道',
  '山脊雾隙',
  '河湾芦苇滩',
  '苔石林缘',
  '旧书塔外的钟阶',
  '鹿铃牧场小径',
  '暖泉旁的石亭',
  '落叶驿路',
  '雨后石桥',
  '北坡采石小道',
  '云影高地',
  '边境旧哨所',
  '野莓坡地',
  '远山风口',
  '古道尽头的旅人碑',
]
const EVENTS = [
  '你们沿着旧路前进，在黄昏前找到了安全的返程标记。',
  '伙伴在一块松动的石砖旁停下，下面藏着前人留下的小包裹。',
  '一阵短雨让道路变得泥泞，你们在树下等候，也因此发现了新的岔路。',
  '远处传来钟声，伙伴抬起头，记住了回到营地的方向。',
  '你们与一支旅行商队擦肩而过，对方分享了一条通往遗迹的小路。',
  '伙伴一路紧跟在身旁。没有惊险的大事，却是一段让人安心的同行。',
  '风从松枝间穿过，落下几根细针叶。你们没有赶路，只在原地听了一会儿。',
  '河面把云影慢慢推远，伙伴在岸边停住，像也想把这一刻多留一会儿。',
  '旧石阶被雨洗得发亮。你们放慢脚步，踩过每一段仍然稳当的地方。',
  '草坡上的云影挪开时，远处的风车刚好转了半圈。',
  '一只不知名的小鸟从矮墙后飞起，又落在更远的路牌上。',
  '你们在一块晒暖的石头旁歇了歇，行囊里的东西也像被风吹松了。',
  '林缘传来短促的鸟鸣，随后又安静下来。伙伴侧头听了很久。',
  '路边的野花被昨夜的雨压低了些，等太阳出来，又慢慢抬起头。',
  '经过旧桥时，桥下的水声比来时更轻。你们站在栏边看了一会儿。',
  '远山的雾散开一线，露出一段还没有走过的山脊。',
  '一位赶路人向你们点头，留下的脚印很快和你们的混在同一条路上。',
  '傍晚的灯火在远处亮起一盏。伙伴没有催促，只和你一起望了望。',
  '你们把被风吹歪的路旁木牌扶正，又继续沿着平缓的路往前。',
  '石墙缝里长着一小丛柔软的苔。伙伴凑近看了看，没有碰它。',
]

const DURATION_TIERS = [
  { min: 90, id: 'epic', name: '史诗远征', commonCount: 4, uncommonCount: 2, uncommonChance: 0.50, rareChance: 0.20, preciousChance: 0.03, companionChance: 0.07, caravanChance: 0.70 },
  { min: 60, id: 'deep', name: '深层探索', commonCount: 3, uncommonCount: 2, uncommonChance: 0.40, rareChance: 0.15, preciousChance: 0.02, companionChance: 0.05, caravanChance: 0.60 },
  { min: 45, id: 'ruins', name: '遗迹深入', commonCount: 2, uncommonCount: 1, uncommonChance: 0.35, rareChance: 0.10, preciousChance: 0.012, companionChance: 0.03, caravanChance: 0.50 },
  { min: 25, id: 'standard', name: '标准远征', commonCount: 1, uncommonCount: 1, uncommonChance: 0.25, rareChance: 0.06, preciousChance: 0.008, companionChance: 0.02, caravanChance: 0.40 },
  { min: 15, id: 'short', name: '林间短途', commonCount: 1, uncommonCount: 1, uncommonChance: 0.15, rareChance: 0.03, preciousChance: 0.004, companionChance: 0.01, caravanChance: 0.30 },
  { min: 5, id: 'scout', name: '营地侦察', commonCount: 1, uncommonCount: 1, uncommonChance: 0.08, rareChance: 0.01, preciousChance: 0.002, companionChance: 0.001, caravanChance: 0.20 },
  { min: 0, id: 'brief', name: '门外散步', commonCount: 1, uncommonCount: 0, uncommonChance: 0, rareChance: 0, preciousChance: 0, companionChance: 0, caravanChance: 0 },
]

function durationTier(activeSeconds) {
  const minutes = Math.max(0, Number(activeSeconds) || 0) / 60
  return DURATION_TIERS.find((tier) => minutes >= tier.min)
}

function seededRandom(seed) {
  let state = crypto.createHash('sha256').update(String(seed)).digest().readUInt32LE(0) || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967296
  }
}

const CARAVAN_PRICES = { uncommon: 10, rare: 20, precious: 40 }
const CARAVAN_RARITY_WEIGHTS = [{ rarity: 'uncommon', weight: 0.50 }, { rarity: 'rare', weight: 0.35 }, { rarity: 'precious', weight: 0.15 }]

function pickCaravanRarity(random) {
  const rolled = random()
  let cursor = 0
  for (const entry of CARAVAN_RARITY_WEIGHTS) { cursor += entry.weight; if (rolled < cursor) return entry.rarity }
  return 'precious'
}

function rollCaravanEncounter({ sessionId, activeSeconds, startedAt }) {
  const tier = durationTier(activeSeconds)
  const hour = new Date(Number(startedAt) || Date.now()).getHours()
  if (hour < 17 || hour >= 22 || !tier.caravanChance) return null
  const random = seededRandom(`${sessionId}:caravan`)
  if (random() >= tier.caravanChance) return null
  const selected = []
  const usedIds = new Set()
  while (selected.length < 4) {
    const rarity = pickCaravanRarity(random)
    const pool = LOOT.filter((item) => item.rarity === rarity && !usedIds.has(item.id))
    const fallback = LOOT.filter((item) => item.rarity !== 'common' && !usedIds.has(item.id))
    const choices = pool.length ? pool : fallback
    const item = choices[Math.floor(random() * choices.length)]
    usedIds.add(item.id)
    selected.push({ item, price: CARAVAN_PRICES[item.rarity] })
  }
  const duplicate = selected[Math.floor(random() * selected.length)]
  const stock = [...selected, { item: duplicate.item, price: duplicate.price }]
  for (let index = stock.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[stock[index], stock[swap]] = [stock[swap], stock[index]]
  }
  return { chance: tier.caravanChance, greeting: '暮色里的车轮在路边停下。商队掌灯人掀开篷布，请你看看他们从远方带来的旅途遗存。', items: stock.map((entry) => ({ item: entry.item, price: entry.price, sold: false })) }
}

function rollBardEncounter({ sessionId, activeSeconds }) {
  const tier = durationTier(activeSeconds)
  const chance = ({ scout: .05, short: .10, standard: .20, ruins: .30, deep: .40, epic: .50 })[tier.id] || 0
  const random = seededRandom(`${sessionId}:bard`)
  if (random() >= chance) return null
  const common = LOOT.filter((item) => item.rarity === 'common')
  const gift = common[Math.floor(random() * common.length)] || null
  return {
    chance,
    greeting: '披着旧斗篷的吟游诗人在路旁停下，向你轻轻欠身。',
    gift,
  }
}

function rollExpedition({ sessionId, activeSeconds, rarePity = 0, companionPity = 0, ownedSpeciesIds = [], rareBoost = false, nightRareBoost = false, companionBoost = false, locations = LOCATIONS }) {
  const tier = durationTier(activeSeconds)
  const random = seededRandom(String(sessionId) + ':' + activeSeconds)
  const common = LOOT.filter((item) => item.rarity === 'common')
  const uncommon = LOOT.filter((item) => item.rarity === 'uncommon')
  const rare = LOOT.filter((item) => item.rarity === 'rare')
  const precious = LOOT.filter((item) => item.rarity === 'precious' && !item.merchantOnly)
  const locationPool = Array.isArray(locations) && locations.length ? locations : LOCATIONS
  const drops = []
  const addDrop = (item, quantity = 1) => {
    const existing = drops.find((drop) => drop.item.id === item.id)
    if (existing) existing.quantity += quantity
    else drops.push({ item, quantity })
  }
  for (let index = 0; index < tier.commonCount; index += 1) {
    const item = common[Math.floor(random() * common.length)]
    addDrop(item)
  }

  for (let index = 0; index < tier.uncommonCount; index += 1) {
    if (tier.uncommonChance > 0 && random() < tier.uncommonChance) addDrop(uncommon[Math.floor(random() * uncommon.length)])
  }
  const boost = (rareBoost ? 0.10 : 0) + (nightRareBoost ? 0.03 : 0)
  const rareChance = Math.min(0.65, tier.rareChance + Math.max(0, Number(rarePity) - 4) * 0.03 + boost)
  const rareFound = tier.rareChance > 0 && (Number(rarePity) >= 9 || random() < rareChance)
  if (rareFound) addDrop(rare[Math.floor(random() * rare.length)])
  const preciousFound = tier.preciousChance > 0 && random() < tier.preciousChance
  if (preciousFound) addDrop(precious[Math.floor(random() * precious.length)])

  const unowned = COMPANION_SPECIES.filter((species) => !ownedSpeciesIds.includes(species.id) && species.id !== 'hearth_hound')
  const companionChance = Math.min(0.50, tier.companionChance + Math.max(0, Number(companionPity) - 4) * 0.01 + (companionBoost ? 0.10 : 0))
  const companionSpecies = unowned.length && tier.companionChance > 0 && random() < companionChance
    ? unowned[Math.floor(random() * unowned.length)]
    : null

  return {
    tier,
    location: locationPool[Math.floor(random() * locationPool.length)],
    event: EVENTS[Math.floor(random() * EVENTS.length)],
    drops,
    rareFound,
    preciousFound,
    rareChance,
    companionSpecies,
    companionChance,
    bondXp: Math.max(1, Math.floor(Math.min(90, Math.max(1, activeSeconds / 60)) / 5)),
  }
}

function companionStage(bondXp) {
  if (Number(bondXp) >= 200) return 2
  if (Number(bondXp) >= 100) return 1
  return 0
}

function evolutionReady(bondXp, evolutionPath = '') {
  return Number(bondXp) >= 200 && !evolutionPath
}

function growthPathForTime(timestamp = Date.now()) {
  const hour = new Date(timestamp).getHours()
  if (hour >= 6 && hour < 16) return 'ember_tail'
  if (hour >= 16 && hour < 20) return 'pine_shadow'
  return 'moon_paw'
}

// The species owns its final-growth rule. Chestnut is the only current
// time-branching companion; a single-route companion must never inherit one
// of Chestnut's names merely because it happened to reach 200 bond at night.
function growthPathForCompanion(speciesId, timestamp = Date.now()) {
  const species = COMPANION_SPECIES.find((item) => item.id === speciesId)
  if (!species) return ''
  if (species.finalGrowthMode === 'single') return species.evolutions?.[0]?.id || ''
  if (species.finalGrowthMode === 'time_branch') return growthPathForTime(timestamp)
  return ''
}

const BRIEF_LOCATIONS = ['小屋门前', '城镇路口', '营地附近', '旧路起点']
const BRIEF_EVENTS = [
  '你出门透了口气，把刚才完成的部分记下便回来了。',
  '和伙伴走到路口。阳光正好，小屋的灯还看得见。',
  '你在周围转了一圈，确认今天的记录都妥当了。',
  '旧路还是记忆里的样子。你把已经完成的部分标记清楚。',
]

const SHORT_LOCATIONS = ['林间入口', '营地外缘', '城镇近郊', '旧路浅段', '松林小径']
const SHORT_EVENTS = [
  '你暂时停下脚步，把今天的笔记整理好。',
  '灌木丛里开了一小片花，伙伴低头嗅了嗅。',
  '路旁的石碑刻着模糊的字迹，像是很久以前留下的。',
  '你们沿着旧路走了一小截。空气里带着淡淡的松脂气味。',
  '伙伴在路口蹲下，好像在等你有空再往前走。',
]

function rollLightweightExpedition({ sessionId, activeSeconds, returnKind }) {
  const tier = durationTier(activeSeconds)
  const random = seededRandom(String(sessionId) + ':' + activeSeconds)
  const locPool = returnKind === 'brief' ? BRIEF_LOCATIONS : SHORT_LOCATIONS
  const evtPool = returnKind === 'brief' ? BRIEF_EVENTS : SHORT_EVENTS
  return {
    tier,
    location: locPool[Math.floor(random() * locPool.length)],
    event: evtPool[Math.floor(random() * evtPool.length)],
    drops: [],
    rareFound: false,
    rareChance: 0,
    companionChance: 0,
    bondXp: 0,
    activeCompanion: null,
    newCompanion: null,
  }
}

module.exports = {
  COMPANION_SPECIES,
  LOOT,
  LOCATIONS,
  MAP_FRAGMENT_LOCATIONS,
  EVENTS,
  DURATION_TIERS,
  BRIEF_LOCATIONS,
  BRIEF_EVENTS,
  SHORT_LOCATIONS,
  SHORT_EVENTS,
  durationTier,
  rollExpedition,
  rollLightweightExpedition,
  rollCaravanEncounter,
  rollBardEncounter,
  CARAVAN_PRICES,
  companionStage,
  evolutionReady,
  growthPathForTime,
  growthPathForCompanion,
}
