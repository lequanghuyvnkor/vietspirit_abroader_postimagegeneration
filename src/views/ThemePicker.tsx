import { DEFAULT_TINT, PRESETS, isHex, themeVars } from '../lib/theme.ts'

export type ThemeValue = { color: string | undefined; tint: number | undefined }

type Props = {
  value: ThemeValue
  onChange: (value: ThemeValue) => void
  /** Offered as a one-click color (the accent from the Moodboard). */
  suggestion?: string
}

/** Pick the interface accent from presets or any color, and how strongly the page background follows it. */
export function ThemePicker({ value, onChange, suggestion }: Props) {
  const color = isHex(value.color) ? value.color : undefined
  const tint = value.tint ?? DEFAULT_TINT
  const vars = color ? themeVars(color, tint, false) : null
  const pick = (next: string | undefined) => onChange({ color: next, tint: value.tint })
  return <div className="theme-picker">
    <div className="theme-swatches" role="radiogroup" aria-label="Màu giao diện">
      <button type="button" role="radio" aria-checked={!color} className={`theme-swatch default${!color ? ' on' : ''}`} onClick={() => pick(undefined)} title="Mặc định (chàm)"><i style={{ background: '#4f46e5' }} /><span>Mặc định</span></button>
      {PRESETS.map((preset) => <button type="button" key={preset.color} role="radio" aria-checked={color === preset.color} className={`theme-swatch${color === preset.color ? ' on' : ''}`} onClick={() => pick(preset.color)} title={preset.name}><i style={{ background: preset.color }} /><span>{preset.name}</span></button>)}
      <label className={`theme-swatch custom${color && !PRESETS.some((preset) => preset.color === color) ? ' on' : ''}`} title="Chọn màu bất kỳ">
        <input type="color" aria-label="Chọn màu bất kỳ" value={color ?? '#4f46e5'} onChange={(event) => pick(event.target.value)} /><span>Màu khác</span>
      </label>
    </div>
    {suggestion && isHex(suggestion) && suggestion.toLowerCase() !== color?.toLowerCase() && <button type="button" className="link" onClick={() => pick(suggestion)}>Lấy màu nhấn của Moodboard ({suggestion.toUpperCase()})</button>}
    <label className="field"><span className="field-label">Độ đậm của màu nền: {Math.round(tint * 100)}%</span>
      <input type="range" min={0} max={100} step={5} value={Math.round(tint * 100)} disabled={!color} onChange={(event) => onChange({ color, tint: Number(event.target.value) / 100 })} />
      <small>{color ? 'Nền trang, đường kẻ và chữ phụ lấy sắc của màu này.' : 'Chọn một màu để bật.'}</small></label>
    {vars && <div className="theme-preview" style={{ background: vars['--bg'], borderColor: vars['--line'], color: vars['--ink'] }} aria-hidden="true">
      <span style={{ background: vars['--surface'], borderColor: vars['--line'] }}>Kế hoạch tháng 10</span>
      <b style={{ background: vars['--primary'], color: vars['--primary-ink'] }}>Thêm bài</b>
      <em style={{ background: vars['--primary-soft'], color: vars['--primary'] }}>Đang soạn</em>
    </div>}
  </div>
}
