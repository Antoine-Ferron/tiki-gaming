type FilterChipsProps<K extends string> = {
  label: string
  choices: Record<K, { label: string }>
  value?: K
  onChange: (value?: K) => void
}

/** Choix exclusif parmi des étiquettes, plus « Tous » pour retirer le filtre. */
export function FilterChips<K extends string>({ label, choices, value, onChange }: FilterChipsProps<K>) {
  const options: [K | undefined, string][] = [
    [undefined, 'Tous'],
    ...Object.entries<{ label: string }>(choices).map(([key, choice]) => [key as K, choice.label] as [K, string]),
  ]
  return (
    <fieldset className="filter">
      <legend>{label}</legend>
      {options.map(([key, text]) => (
        <button key={text} type="button" className="chip" aria-pressed={value === key} onClick={() => onChange(key)}>
          {text}
        </button>
      ))}
    </fieldset>
  )
}
