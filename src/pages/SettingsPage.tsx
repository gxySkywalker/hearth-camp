import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { useApp } from '../context/AppContext'
import { friendlyError } from '../lib/format'
import playerDefaultWalk from '../../assets/art/characters/player/player_walk_32x48_v1.png'
import playerBlueWalk from '../../assets/art/characters/player/player_adventurer_blue_walk_32x48_v1.png'
import playerOchreWalk from '../../assets/art/characters/player/player_adventurer_ochre_walk_32x48_v1.png'

const PLAYER_AVATARS = [
  { id: 'traveler_clothes', name: '炉火旅人', note: '最初的行囊与旧路。', art: playerDefaultWalk },
  { id: 'traveler_blue', name: '青蓝旅人', note: '短外套与一条浅灰围巾。', art: playerBlueWalk },
  { id: 'traveler_ochre', name: '金穗旅人', note: '赭黄披肩与旷野的风。', art: playerOchreWalk },
] as const

export function SettingsPage() {
  const { refresh, notify } = useApp()
  const [name, setName] = useState('')
  const [provider, setProvider] = useState('openai')
  const [model, setModel] = useState('gpt-5.6-luna')
  const [proxyUrl, setProxyUrl] = useState('')
  const [configDirty, setConfigDirty] = useState(false)
  const [hasKey, setHasKey] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [birthMonth, setBirthMonth] = useState(0)
  const [birthDay, setBirthDay] = useState(0)
  const [birthUpdatedAt, setBirthUpdatedAt] = useState(0)
  const [birthCooldown, setBirthCooldown] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [avatarId, setAvatarId] = useState<string>('traveler_clothes')

  useEffect(() => {
    Promise.all([
      window.growthArc.settings.get(),
      window.growthArc.settings.getBirthday(),
      window.growthArc.world.get(),
    ]).then(([data, bday, world]) => {
      setName(String(data.user_name || '冒险者')); setProvider(String(data.api_provider || 'openai')); setModel(String(data.model || 'gpt-5.6-luna')); setProxyUrl(String(data.ai_base_url || data.proxy_url || '')); setHasKey(Boolean(data.hasApiKey))
      setBirthMonth(bday.month || 0); setBirthDay(bday.day || 0); setBirthUpdatedAt(bday.updatedAt || 0)
      if (bday.updatedAt) setBirthCooldown(Date.now() - bday.updatedAt < 365 * 86400000)
      if (data.user_name) setNameSaved(true)
      setAvatarId(world.player.outfit_id || 'traveler_clothes')
    }).catch((error) => notify(friendlyError(error), 'error'))
  }, [notify])

  // Existing installations may still have DeepSeek's retired alias saved.
  // Keep the form in sync with the request-side compatibility mapping.
  useEffect(() => {
    if (provider === 'deepseek' && model === 'deepseek-chat') setModel('deepseek-v4-flash')
  }, [provider, model])

  const saveBirthday = async () => {
    setBusy(true)
    try {
      const result = await window.growthArc.settings.setBirthday(birthMonth, birthDay)
      setBirthUpdatedAt(result.updatedAt)
      setBirthCooldown(true)
      notify('旅人生日已记录。小天使会在每年这一天送来祝福。', 'success')
    } catch (error: any) {
      if (error?.code === 'BIRTHDAY_COOLDOWN') notify('一年内只能修改一次生日。', 'error')
      else notify(friendlyError(error), 'error')
    }
    finally { setBusy(false) }
  }

  const saveProfile = async () => {
    setBusy(true)
    try {
      await window.growthArc.settings.set({ user_name: name, model, ai_base_url: provider === 'custom' ? proxyUrl.trim() : '', api_provider: provider })
      setNameSaved(true); setConfigDirty(false)
      notify('个性设置已保存', 'success'); await refresh()
    } catch (error) { notify(friendlyError(error), 'error') }
    finally { setBusy(false) }
  }
  const saveKey = async () => {
    setBusy(true)
    try {
      // Provider/model selection and the key must become active together.
      // Without this, choosing DeepSeek and saving only a key could keep an
      // older provider or endpoint in the database.
      await window.growthArc.settings.set({ model, ai_base_url: provider === 'custom' ? proxyUrl.trim() : '', api_provider: provider })
      await window.growthArc.settings.setApiKey(apiKey)
      setApiKey(''); setHasKey(true); setConfigDirty(false)
      notify('信使设置与 API Key 已使用 Windows DPAPI 加密保存', 'success')
    }
    catch (error) { notify(friendlyError(error), 'error') }
    finally { setBusy(false) }
  }
  const clearKey = async () => {
    try { await window.growthArc.settings.clearApiKey(); setHasKey(false); notify('API Key 已从本机删除') }
    catch (error) { notify(friendlyError(error), 'error') }
  }
  const chooseAvatar = async (id: string) => {
    if (id === avatarId || busy) return
    setBusy(true)
    try {
      await window.growthArc.world.updatePlayer({ outfitId: id })
      setAvatarId(id)
      await refresh()
      notify('新的旅人形象已经收进行囊。', 'success')
    } catch (error) { notify(friendlyError(error), 'error') }
    finally { setBusy(false) }
  }

  return <div className="page settings-page">
    <header className="page-heading"><div><span className="eyebrow">TRAVELER'S JOURNAL</span><h1>旅人手册</h1><p>你的资料与旅途记录。学习数据只留在这台电脑。</p></div></header>
    <div className="settings-stack">
      <section className="panel settings-section"><header><div><h2>✦ 旅人档案</h2><p>这张卡片记录着你在边境的身份。</p></div></header><div className="settings-form"><div className="traveler-card"><div className="traveler-card-name"><span className="traveler-card-label">旅人之名</span><input value={name} onChange={(event) => { setName(event.target.value); setNameSaved(false) }} placeholder="冒险者" /></div></div>{!nameSaved && <button className="button button-primary align-end" disabled={busy || !name.trim()} onClick={saveProfile}>保存</button>}{nameSaved && <p style={{color:'var(--muted)',fontSize:12,margin:'6px 0 0'}}>名字已经记录 ✓</p>}</div></section>
      <section className="panel settings-section"><header><div><h2>✦ 选择你的冒险者</h2><p>每一位都是同一段旅途的主角；只改变你在小屋中的样子。</p></div></header><div className="adventurer-choice-grid">{PLAYER_AVATARS.map((avatar) => <button key={avatar.id} type="button" className={`adventurer-choice ${avatarId === avatar.id ? 'selected' : ''}`} aria-pressed={avatarId === avatar.id} disabled={busy} onClick={() => chooseAvatar(avatar.id)}><span className="adventurer-choice-art" style={{backgroundImage:`url(${avatar.art})`}} /><span className="adventurer-choice-copy"><strong>{avatar.name}</strong><small>{avatar.note}</small></span>{avatarId === avatar.id && <b>正在同行</b>}</button>)}</div><p className="adventurer-choice-foot">不会影响名字、伙伴、背包或任何旅途记录。</p></section>
      <section className="panel settings-section"><header><div><h2>✦ 旅人生日</h2><p>小天使会在每年这一天寄来祝福。</p></div></header><div className="settings-form">{birthUpdatedAt > 0 ? (<><p style={{fontSize:18,color:'var(--ink)',fontFamily:'Fusion Pixel SC, monospace',margin:'4px 0'}}>{birthMonth}月{birthDay}日</p>{birthCooldown && <small style={{color:'var(--muted)'}}>距离下次可修改还有 {Math.max(0, Math.ceil((birthUpdatedAt + 365*86400000 - Date.now()) / 86400000))} 天。</small>}<button className="button button-ghost align-end" disabled={busy || birthCooldown} onClick={() => { setBirthCooldown(false); setBirthUpdatedAt(0) }}>修改生日</button></>) : (<><p style={{color:'var(--muted)',fontSize:13,margin:'4px 0'}}>记录你的生日，小天使会在那一天送来祝福。</p><div style={{display:'flex',gap:10,alignItems:'center'}}><label style={{flex:1}}>月<input type="number" min={1} max={12} value={birthMonth || ''} onChange={e => setBirthMonth(Number(e.target.value))} placeholder="5" /></label><label style={{flex:1}}>日<input type="number" min={1} max={31} value={birthDay || ''} onChange={e => setBirthDay(Number(e.target.value))} placeholder="12" /></label></div><button className="button button-primary align-end" disabled={busy || !birthMonth || !birthDay} onClick={saveBirthday}>记录生日</button></>)}</div></section>
      <section className="panel settings-section"><header><div><h2>✦ 小天使的信</h2><p>小天使每天都会整理你的旅途。不需要做任何设置。</p>{hasKey && <p style={{fontSize:12,color:'var(--muted)',margin:'4px 0 0'}}>信笺钥匙已配置 · 小天使可以亲手写信</p>}</div></header><div className="settings-form"><details style={{fontSize:13,color:'var(--muted)',cursor:'pointer'}}><summary style={{marginBottom:8}}>如果想让远方的信使帮助小天使写下更特别的信……</summary><div className="ai-settings" style={{marginTop:8}}><label>信使<select value={provider} onChange={(event) => { const v = event.target.value; setProvider(v); setConfigDirty(true); if (v === 'deepseek') { setModel('deepseek-chat'); setProxyUrl('') } else if (v === 'openai') { setModel('gpt-5.6-luna'); setProxyUrl('') } }}><option value="deepseek">DeepSeek</option><option value="openai">OpenAI</option><option value="custom">自定义地址</option></select><small>在 DeepSeek 官网注册后可以获得一把钥匙。费用很低。</small></label>{provider === 'custom' && <label>自定义地址<input value={proxyUrl} onChange={(event) => { setProxyUrl(event.target.value); setConfigDirty(true) }} placeholder="https://your-api.example.com/v1" /></label>}<label>信笺钥匙<input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={hasKey ? '已安全保存；输入新值可替换' : '输入钥匙…'} /><small>保存在你的电脑上，使用 Windows 安全加密。</small></label><div className="button-row">{configDirty && <button className="button button-secondary" disabled={busy} onClick={saveProfile}>保存信使设置</button>}{hasKey && <button className="button button-danger-ghost" onClick={clearKey}>移除钥匙</button>}<button className="button button-primary" disabled={busy || !apiKey.trim()} onClick={saveKey}>{hasKey ? '更换钥匙' : '保存钥匙'}</button>{hasKey && <button className="button button-ghost" disabled={busy} onClick={async () => { setBusy(true); try { if (configDirty) { await window.growthArc.settings.set({ model, ai_base_url: provider === 'custom' ? proxyUrl.trim() : '', api_provider: provider }); setConfigDirty(false) } const r = await window.growthArc.mail.testLetter(); if (r.success) notify(`试写成功：已连通 ${r.provider} / ${r.model}。新的每日与每周信会在后台使用 AI 润色；已读信保留原模板。`, 'success'); else notify(`小天使暂时没有收到回应：${r.error || '未知错误'}`, 'error'); } catch (e: any) { notify(`小天使暂时没有收到回应：${e?.message || '未知错误'}`, 'error'); } finally { setBusy(false) } }}>请小天使试写一封信</button>}</div></div></details></div></section>
      <section className="panel settings-section"><header><div><h2>本地数据</h2><p>SQLite 数据库位于应用专用目录。首版不上传、不同步、不自动备份。</p></div></header><div className="data-boundary"><div><strong>你始终拥有原始数据文件</strong><span>需要自行备份时，可关闭应用后复制整个目录。</span></div><button className="button button-secondary" onClick={() => window.growthArc.settings.openDataFolder()}><Icon name="folder" size={16} />打开数据目录</button></div></section>
      <section className="panel settings-section"><header><div><h2>✦ 本地 BGM 包</h2><p>小屋与远征已自带初始音乐；放入自己的 MP3 后会优先播放。</p></div></header><div className="data-boundary"><div><strong>固定文件名</strong><span><code>cottage.mp3</code> 用于小屋；<code>expedition.mp3</code> 用于远征。复制完成后重启应用生效；未放入时继续播放初始音乐。</span></div><button className="button button-secondary" onClick={() => window.growthArc.settings.openBgmFolder()}><Icon name="folder" size={16} />打开 BGM 文件夹</button></div></section>
      <section className="privacy-note"><Icon name="spark" /><div><strong>温和反馈原则</strong><p>系统不会因为断档扣除经验、清零进度或发送催促学习通知。休息本身不是失败。</p></div></section>
    </div>
  </div>
}
