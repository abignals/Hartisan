import { useId, useState } from 'react'

export default function Autocomplete({ label, value, onChange, options, onSelect, placeholder, hint }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const expanded = open && options.length > 0

  function choose(option) {
    onSelect(option)
    setOpen(false)
    setActive(-1)
  }

  return <div className="search-autocomplete" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }}>
    <label htmlFor={id}>{label}</label>
    <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={expanded}
      aria-controls={`${id}-list`} aria-activedescendant={expanded && active >= 0 && active < options.length ? `${id}-${active}` : undefined}
      aria-describedby={hint ? `${id}-hint` : undefined} autoComplete="off" placeholder={placeholder} value={value}
      onFocus={() => setOpen(true)}
      onChange={e => { onChange(e.target.value); setOpen(true); setActive(-1) }}
      onKeyDown={e => {
        if (e.key === 'Escape') { setOpen(false); return }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault(); setOpen(true)
          setActive(i => options.length ? (i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length : -1)
        }
        if (e.key === 'Enter' && expanded && options[active]) { e.preventDefault(); choose(options[active]) }
      }} />
    <ul id={`${id}-list`} role="listbox" aria-label={label} hidden={!expanded}>
      {options.map((option, i) => <li id={`${id}-${i}`} role="option" aria-selected={i === active} key={`${option.label}-${i}`}
        onMouseDown={e => e.preventDefault()} onClick={() => choose(option)}>{option.label}</li>)}
    </ul>
    {hint && <small id={`${id}-hint`}>{hint}</small>}
  </div>
}
