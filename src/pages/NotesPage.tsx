import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { useApp } from '../context/AppContext'
import { setInputContext } from '../lib/inputContext'
import type { HearthMemo, MemoContentBlock, MemoFolder, MemoTextStyle } from '../types'

type Library = { folders: MemoFolder[]; notes: HearthMemo[] }
type View = 'library' | 'editor' | 'trash'
type ConfirmAction = { kind: 'restore' | 'delete-memo' | 'delete-folder'; id: string; label: string }
const emptyLibrary: Library = { folders: [], notes: [] }

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const blocksToHtml = (blocks: MemoContentBlock[]) => {
  if (!blocks.length) return '<p data-size="body"><br></p>'
  let html = ''
  let checklistOpen = false
  for (const block of blocks) {
    if (block.kind === 'checklist') {
      if (!checklistOpen) { html += '<ul data-checklist="true">'; checklistOpen = true }
      html += `<li data-checked="${block.done ? 'true' : 'false'}" data-size="${block.style}">${escapeHtml(block.text) || '<br>'}</li>`
    } else {
      if (checklistOpen) { html += '</ul>'; checklistOpen = false }
      html += `<p data-size="${block.style}">${escapeHtml(block.text) || '<br>'}</p>`
    }
  }
  if (checklistOpen) html += '</ul>'
  return html
}
const htmlText = (html: string) => html.replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()

const snapshot = (memo: HearthMemo | null) => memo ? JSON.stringify({
  folderId: memo.folder_id, title: memo.title, contentHtml: memo.content_html, pinned: memo.pinned,
}) : ''

const titleOf = (memo: HearthMemo) => memo.title.trim() || '未命名手记'
const textOf = (memo: HearthMemo) => htmlText(memo.content_html) || memo.content.map((block) => block.text).join(' ').trim() || '这一页还没有留下字迹'
const formatDay = (at: number) => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(at)
const formatMinute = (at: number) => new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
}).format(at)
const isBlankMemo = (memo: HearthMemo) => !memo.title.trim() && !(htmlText(memo.content_html) || memo.content.some((block) => block.text.trim()))

export function NotesPage() {
  const { notify } = useApp()
  const [library, setLibrary] = useState<Library>(emptyLibrary)
  const [view, setView] = useState<View>('library')
  const [folderId, setFolderId] = useState<string | 'all' | 'pinned'>('all')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<HearthMemo | null>(null)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty'>('saved')
  const [menuOpen, setMenuOpen] = useState(false)
  const [folderPanel, setFolderPanel] = useState(false)
  const [folderForm, setFolderForm] = useState<{ id?: string; name: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const draftRef = useRef<HearthMemo | null>(null)
  const savedRef = useRef('')
  const editorRef = useRef<HTMLDivElement | null>(null)
  const selectionRef = useRef<Range | null>(null)
  const folderPopoverRef = useRef<HTMLDivElement | null>(null)
  const createdHereRef = useRef(new Set<string>())
  draftRef.current = draft

  const mergeMemo = useCallback((memo: HearthMemo) => {
    setLibrary((current) => ({ ...current, notes: current.notes.map((item) => item.id === memo.id ? memo : item) }))
  }, [])

  useEffect(() => {
    setInputContext('menu')
    window.growthArc.memos.get().then(setLibrary).catch((error) => notify(String(error), 'error'))
  }, [notify])

  useEffect(() => {
    if (!folderPanel) return
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && !folderPopoverRef.current?.contains(target)) setFolderPanel(false)
    }
    window.addEventListener('pointerdown', closeOutside, true)
    return () => window.removeEventListener('pointerdown', closeOutside, true)
  }, [folderPanel])

  const persist = useCallback(async (memo = draftRef.current) => {
    if (!memo || memo.deleted_at || snapshot(memo) === savedRef.current) return memo
    setSaveState('saving')
    try {
      const saved = await window.growthArc.memos.update(memo.id, {
        title: memo.title, content_html: memo.content_html, pinned: memo.pinned, folderId: memo.folder_id,
      })
      savedRef.current = snapshot(saved)
      mergeMemo(saved)
      setDraft((current) => current?.id === saved.id ? { ...current, updated_at: saved.updated_at } : current)
      setSaveState('saved')
      return saved
    } catch (error) {
      setSaveState('dirty')
      notify(error instanceof Error ? error.message : String(error), 'error')
      return memo
    }
  }, [mergeMemo, notify])

  useEffect(() => {
    if (!draft || draft.deleted_at || snapshot(draft) === savedRef.current) return
    setSaveState('dirty')
    const timer = window.setTimeout(() => void persist(draft), 550)
    return () => window.clearTimeout(timer)
  }, [draft, persist])

  useEffect(() => () => {
    const current = draftRef.current
    if (current && !current.deleted_at && snapshot(current) !== savedRef.current) {
      void window.growthArc.memos.update(current.id, {
        title: current.title, content_html: current.content_html, pinned: current.pinned, folderId: current.folder_id,
      })
    }
  }, [])

  useEffect(() => {
    if (view !== 'editor') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      void closeEditor()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const filteredNotes = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return library.notes.filter((memo) => {
      if (memo.deleted_at) return false
      if (folderId === 'pinned' && !memo.pinned) return false
      if (folderId !== 'all' && folderId !== 'pinned' && memo.folder_id !== folderId) return false
      return !needle || `${memo.title}\n${textOf(memo)}`.toLocaleLowerCase().includes(needle)
    }).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at - a.updated_at)
  }, [folderId, library.notes, query])

  const openMemo = async (memo: HearthMemo) => {
    await persist()
    const prepared = { ...memo, content_html: memo.content_html || blocksToHtml(memo.content) }
    setConfirmDelete(false)
    setMenuOpen(false)
    setDraft(prepared)
    savedRef.current = snapshot(memo)
    setSaveState('saved')
    setView('editor')
    window.setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = prepared.content_html
    }, 0)
  }

  const createMemo = async () => {
    await persist()
    try {
      const assignedFolder = folderId !== 'all' && folderId !== 'pinned' ? folderId : null
      const memo = await window.growthArc.memos.create({ folderId: assignedFolder })
      createdHereRef.current.add(memo.id)
      setLibrary((current) => ({ ...current, notes: [memo, ...current.notes] }))
      await openMemo(memo)
    } catch (error) { notify(error instanceof Error ? error.message : String(error), 'error') }
  }

  const closeEditor = async () => {
    const current = draftRef.current
    if (current && createdHereRef.current.has(current.id) && isBlankMemo(current)) {
      try {
        await window.growthArc.memos.trash(current.id)
        await window.growthArc.memos.deletePermanently(current.id)
        setLibrary((state) => ({ ...state, notes: state.notes.filter((memo) => memo.id !== current.id) }))
        createdHereRef.current.delete(current.id)
      } catch (error) { notify(error instanceof Error ? error.message : String(error), 'error') }
    } else {
      await persist()
      if (current) createdHereRef.current.delete(current.id)
    }
    setDraft(null)
    setMenuOpen(false)
    setConfirmDelete(false)
    setView('library')
  }

  const updateDraft = (patch: Partial<HearthMemo>) => setDraft((current) => current ? { ...current, ...patch } : current)
  const syncEditor = useCallback(() => {
    const html = editorRef.current?.innerHTML || ''
    setDraft((current) => current ? { ...current, content_html: html } : current)
  }, [])

  const rememberSelection = () => {
    const selection = window.getSelection()
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) selectionRef.current = selection.getRangeAt(0).cloneRange()
  }

  const restoreSelection = () => {
    const selection = window.getSelection()
    const range = selectionRef.current
    if (!selection || !range || !editorRef.current?.contains(range.commonAncestorContainer)) return false
    selection.removeAllRanges(); selection.addRange(range)
    return true
  }

  const selectedBlocks = () => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection?.rangeCount) return [] as HTMLElement[]
    const range = selection.getRangeAt(0)
    const blocks = Array.from(editor.querySelectorAll<HTMLElement>('p, li, div')).filter((node) => node.parentElement === editor || node.tagName === 'LI')
    return blocks.filter((node) => { try { return range.intersectsNode(node) } catch { return false } })
  }

  const setBlockStyle = (style: MemoTextStyle) => {
    editorRef.current?.focus(); restoreSelection()
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed) {
      const size = style === 'small' ? '1' : style === 'body' ? '3' : style === 'emphasis' ? '5' : '6'
      document.execCommand('fontSize', false, size)
      editorRef.current?.querySelectorAll<HTMLElement>(`font[size="${size}"]`).forEach((font) => {
        const span = document.createElement('span')
        span.setAttribute('data-text-size', style)
        while (font.firstChild) span.appendChild(font.firstChild)
        font.replaceWith(span)
      })
      syncEditor(); rememberSelection()
      return
    }
    let blocks = selectedBlocks()
    if (!blocks.length) {
      document.execCommand('formatBlock', false, 'p')
      blocks = selectedBlocks()
    }
    blocks.forEach((block) => block.setAttribute('data-size', style))
    syncEditor(); rememberSelection()
  }

  const toggleChecklist = () => {
    editorRef.current?.focus(); restoreSelection()
    document.execCommand('insertUnorderedList', false)
    selectedBlocks().forEach((block) => {
      const list = block.closest('ul')
      if (list) list.setAttribute('data-checklist', 'true')
    })
    syncEditor(); rememberSelection()
  }

  const handleEditorEnter = () => {
    const selection = window.getSelection()
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return

    const anchor = selection.anchorNode instanceof HTMLElement
      ? selection.anchorNode
      : selection.anchorNode?.parentElement
    const checklistItem = anchor?.closest<HTMLElement>('ul[data-checklist="true"] > li')

    // A checklist owns its line structure: Enter creates the next item and an
    // empty item exits the list, matching native Notes-style checklist editing.
    if (checklistItem) document.execCommand('insertParagraph', false)
    else document.execCommand('insertLineBreak', false)

    syncEditor(); rememberSelection()
  }

  const trashMemo = async () => {
    if (!draft) return
    await persist()
    const trashed = await window.growthArc.memos.trash(draft.id)
    mergeMemo(trashed)
    setConfirmDelete(false)
    await closeEditor()
  }

  const saveFolder = async () => {
    if (!folderForm?.name.trim()) return
    try {
      const folder = folderForm.id
        ? await window.growthArc.memos.updateFolder(folderForm.id, folderForm.name)
        : await window.growthArc.memos.createFolder(folderForm.name)
      setLibrary((current) => ({ ...current, folders: folderForm.id
        ? current.folders.map((item) => item.id === folder.id ? folder : item)
        : [...current.folders, folder] }))
      setFolderForm(null)
    } catch (error) { notify(error instanceof Error ? error.message : String(error), 'error') }
  }

  const deleteFolder = async (id: string) => {
    try {
      const next = await window.growthArc.memos.deleteFolder(id)
      setLibrary(next)
      if (folderId === id) setFolderId('all')
    } catch (error) { notify(error instanceof Error ? error.message : String(error), 'error') }
  }

  const restoreMemo = async (memo: HearthMemo) => {
    const restored = await window.growthArc.memos.restore(memo.id)
    mergeMemo(restored)
  }

  const deletePermanently = async (memo: HearthMemo) => {
    await window.growthArc.memos.deletePermanently(memo.id)
    setLibrary((current) => ({ ...current, notes: current.notes.filter((item) => item.id !== memo.id) }))
  }

  const performConfirmedAction = async () => {
    if (!confirmAction) return
    try {
      if (confirmAction.kind === 'restore') {
        const memo = library.notes.find((item) => item.id === confirmAction.id)
        if (memo) await restoreMemo(memo)
      } else if (confirmAction.kind === 'delete-memo') {
        const memo = library.notes.find((item) => item.id === confirmAction.id)
        if (memo) await deletePermanently(memo)
      } else {
        await deleteFolder(confirmAction.id)
      }
      setConfirmAction(null)
    } catch (error) { notify(error instanceof Error ? error.message : String(error), 'error') }
  }

  const confirmationDialog = confirmAction ? <div className="notes-inline-dialog" role="dialog" aria-modal="true"><div>
    <small>请确认</small>
    <h3>{confirmAction.kind === 'restore' ? `恢复「${confirmAction.label}」？` : confirmAction.kind === 'delete-memo' ? `永久删除「${confirmAction.label}」？` : `删除分类册「${confirmAction.label}」？`}</h3>
    <p>{confirmAction.kind === 'restore' ? '这页手记会重新回到手记首页。' : confirmAction.kind === 'delete-memo' ? '删除后将无法恢复这页手记。' : '其中的手记不会被删除，会回到未归类的手记中。'}</p>
    <footer><button className="button button-ghost" onClick={() => setConfirmAction(null)}>取消</button><button className="button button-primary" onClick={() => void performConfirmedAction()}>{confirmAction.kind === 'restore' ? '确认恢复' : '确认删除'}</button></footer>
  </div></div> : null

  if (view === 'editor' && draft) return <div className="page notes-page notes-editor-page">
    <header className="notes-editor-bar">
      <button className="notes-back" onClick={() => void closeEditor()}><span>‹</span>返回手记</button>
      <div className="notes-save-mark">{saveState === 'saving' ? '正在收好…' : saveState === 'dirty' ? '尚未落定' : '已收好'}</div>
      <div className="notes-editor-actions">
        <button className={draft.pinned ? 'active' : ''} data-note-tip={draft.pinned ? '取消置顶' : '置顶手记'} onClick={() => updateDraft({ pinned: !draft.pinned })}><Icon name="star" size={17} /></button>
        <button data-note-tip="更多操作" onClick={() => setMenuOpen((open) => !open)}>•••</button>
        {menuOpen && <div className="notes-more-menu">
          <label>收进分类册<select value={draft.folder_id || ''} onChange={(event) => updateDraft({ folder_id: event.target.value || null })}><option value="">未分类</option>{library.folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
          <button onClick={() => setConfirmDelete(true)}>移到旧纸篓</button>
        </div>}
      </div>
    </header>
    <main className="notes-paper">
      <input className="notes-paper-title" value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} placeholder="手记标题" maxLength={120} />
      <div className="notes-paper-meta">创建于 {formatDay(draft.created_at)} · 最近修改 {formatMinute(draft.updated_at)}{draft.folder_id && library.folders.find((folder) => folder.id === draft.folder_id) ? ` · ${library.folders.find((folder) => folder.id === draft.folder_id)?.name}` : ''}</div>
      <div ref={editorRef} className="notes-rich-editor" contentEditable suppressContentEditableWarning
        data-placeholder="从这里写下第一句话……"
        onFocus={() => document.execCommand('defaultParagraphSeparator', false, 'p')}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          handleEditorEnter()
        }}
        onInput={() => { syncEditor(); rememberSelection() }} onKeyUp={rememberSelection} onMouseUp={rememberSelection}
        onPaste={(event) => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')) }}
        onPointerDown={(event) => {
          const target = event.target as HTMLElement
          const item = target.closest<HTMLElement>('ul[data-checklist="true"] > li')
          if (!item || event.clientX > item.getBoundingClientRect().left + 28) return
          event.preventDefault()
          item.setAttribute('data-checked', item.getAttribute('data-checked') === 'true' ? 'false' : 'true')
          syncEditor()
        }} />
    </main>
    <div className="notes-format-bar" aria-label="文字格式">
      <button data-note-tip="缩小选中文字" onMouseDown={(event) => event.preventDefault()} onClick={() => setBlockStyle('small')}>A<sup>−</sup></button>
      <button data-note-tip="设为正文" onMouseDown={(event) => event.preventDefault()} onClick={() => setBlockStyle('body')}>正文</button>
      <button data-note-tip="放大选中文字" onMouseDown={(event) => event.preventDefault()} onClick={() => setBlockStyle('emphasis')}>A<sup>+</sup></button>
      <button data-note-tip="设为标题" onMouseDown={(event) => event.preventDefault()} onClick={() => setBlockStyle('heading')}>标题</button>
      <i />
      <button data-note-tip="切换清单项目" onMouseDown={(event) => event.preventDefault()} onClick={toggleChecklist}>☑ 清单</button>
    </div>
    {confirmDelete && <div className="notes-inline-dialog"><div><small>移到旧纸篓</small><h3>要收起「{titleOf(draft)}」吗？</h3><p>之后仍可从旧纸篓恢复。</p><footer><button className="button button-ghost" onClick={() => setConfirmDelete(false)}>先留着</button><button className="button button-primary" onClick={() => void trashMemo()}>移到旧纸篓</button></footer></div></div>}
  </div>

  if (view === 'trash') {
    const trashed = library.notes.filter((memo) => memo.deleted_at).sort((a, b) => (b.deleted_at || 0) - (a.deleted_at || 0))
    return <div className="page notes-page notes-library-page"><header className="notes-library-head"><div><button className="notes-back" onClick={() => setView('library')}><span>‹</span>返回</button><h1>旧纸篓</h1></div></header><div className="notes-trash-list">{trashed.map((memo) => <article key={memo.id}><div><h3>{titleOf(memo)}</h3><p>{textOf(memo)}</p></div><button onClick={() => setConfirmAction({ kind: 'restore', id: memo.id, label: titleOf(memo) })}>恢复</button><button onClick={() => setConfirmAction({ kind: 'delete-memo', id: memo.id, label: titleOf(memo) })}>永久删除</button></article>)}{!trashed.length && <div className="notes-empty"><span>◇</span><p>旧纸篓里没有遗落的纸页。</p></div>}</div>{confirmationDialog}</div>
  }

  return <div className="page notes-page notes-library-page">
    <header className="notes-library-head">
      <div><small>炉火旁的私人纸页</small><h1>炉边手记</h1><p>记下此刻想到的事，等需要的时候再回来。</p></div>
      <button className="notes-new" onClick={() => void createMemo()}><Icon name="plus" size={17} />新建手记</button>
    </header>
    <div className="notes-library-tools">
      <div className="notes-search"><Icon name="search" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索手记" /></div>
      <button className={folderId === 'all' ? 'active' : ''} onClick={() => setFolderId('all')}>全部</button>
      <button className={folderId === 'pinned' ? 'active' : ''} onClick={() => setFolderId('pinned')}>置顶</button>
      <button className={folderPanel ? 'active' : ''} onClick={() => setFolderPanel((open) => !open)}>分类册⌄</button>
      <button onClick={() => setView('trash')}>旧纸篓</button>
    </div>
    {folderPanel && <div ref={folderPopoverRef} className="notes-folder-popover">
      <header><strong>分类册</strong><button onClick={() => setFolderForm({ name: '' })}>＋ 新建</button></header>
      {library.folders.map((folder) => <div key={folder.id} className={folderId === folder.id ? 'active' : ''}><button onClick={() => { setFolderId(folder.id); setFolderPanel(false) }}>{folder.name}</button><span>{library.notes.filter((memo) => !memo.deleted_at && memo.folder_id === folder.id).length}</span><button data-note-tip="重命名分类册" onClick={() => setFolderForm({ id: folder.id, name: folder.name })}>✎</button><button data-note-tip="删除分类册" onClick={() => setConfirmAction({ kind: 'delete-folder', id: folder.id, label: folder.name })}>×</button></div>)}
      {!library.folders.length && <p>还没有分类册。</p>}
    </div>}
    <main className="notes-card-list">
      {filteredNotes.map((memo) => <button key={memo.id} className="notes-card" onClick={() => void openMemo(memo)}>
        <span className="notes-card-mark">{memo.pinned ? '◆' : memo.content.some((block) => block.kind === 'checklist') ? '☑' : '◇'}</span>
        <div><h2>{titleOf(memo)}</h2><p>{textOf(memo)}</p><time>{formatDay(memo.updated_at)}</time></div>
      </button>)}
      {!filteredNotes.length && <div className="notes-empty"><span>✦</span><h2>{query ? '没有找到相符的字迹' : '写下第一句话'}</h2><p>{query ? '换一个词再找找看。' : '不必想得完整，先把此刻留下来。'}</p>{!query && <button className="notes-new" onClick={() => void createMemo()}>新建手记</button>}</div>}
    </main>
    <footer className="notes-local-note">仅保存在这台电脑，不会交给小天使或 AI 阅读。</footer>
    {folderForm && <div className="notes-inline-dialog"><div><small>{folderForm.id ? '重命名分类册' : '新建分类册'}</small><h3>给这册纸页起个名字</h3><input autoFocus value={folderForm.name} onChange={(event) => setFolderForm({ ...folderForm, name: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') void saveFolder(); if (event.key === 'Escape') setFolderForm(null) }} maxLength={40} /><footer><button className="button button-ghost" onClick={() => setFolderForm(null)}>取消</button><button className="button button-primary" onClick={() => void saveFolder()}>收好</button></footer></div></div>}
    {confirmationDialog}
  </div>
}
