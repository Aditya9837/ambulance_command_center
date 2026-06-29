import { useCallback, useRef } from 'react'
import { Bold, Italic, List, Underline } from 'lucide-react'
import { cn } from '../lib/utils'

interface SimpleRichTextEditorProps {
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

function exec(command: string, value?: string) {
  document.execCommand(command, false, value)
}

export default function SimpleRichTextEditor({
  onChange,
  placeholder = 'Write prescription...',
  className,
}: SimpleRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)

  const syncValue = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    onChange(el.innerHTML)
  }, [onChange])

  const toolbarBtn =
    'p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-700/80 transition-colors'

  return (
    <div className={cn('rounded-xl border border-slate-700/60 bg-slate-900/60 overflow-hidden', className)}>
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-700/50 bg-slate-800/40">
        <button type="button" className={toolbarBtn} onMouseDown={(e) => { e.preventDefault(); exec('bold') }} aria-label="Bold">
          <Bold className="w-4 h-4" />
        </button>
        <button type="button" className={toolbarBtn} onMouseDown={(e) => { e.preventDefault(); exec('italic') }} aria-label="Italic">
          <Italic className="w-4 h-4" />
        </button>
        <button type="button" className={toolbarBtn} onMouseDown={(e) => { e.preventDefault(); exec('underline') }} aria-label="Underline">
          <Underline className="w-4 h-4" />
        </button>
        <button type="button" className={toolbarBtn} onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList') }} aria-label="Bullet list">
          <List className="w-4 h-4" />
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline
        aria-label={placeholder}
        suppressContentEditableWarning
        onInput={syncValue}
        onBlur={syncValue}
        data-placeholder={placeholder}
        className="min-h-[140px] max-h-[240px] overflow-y-auto px-3 py-2.5 text-sm text-slate-100 outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-slate-500"
      />
    </div>
  )
}
