type ServingsStepperProps = {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

/** Portionszahl mit großen −/+ Knöpfen. */
export function ServingsStepper({ value, onChange, min = 1, max = 12 }: ServingsStepperProps) {
  return (
    <div className="flex items-center gap-1">
      <StepButton label="Weniger Portionen" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </StepButton>
      <span className="w-10 text-center text-xl font-bold tabular-nums" aria-live="polite">
        {value}
      </span>
      <StepButton label="Mehr Portionen" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </StepButton>
    </div>
  )
}

type StepButtonProps = { label: string; disabled: boolean; onClick: () => void; children: string }

function StepButton({ label, disabled, onClick, children }: StepButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full border border-stone-300 text-xl font-bold hover:bg-stone-100 disabled:opacity-40 dark:border-stone-700 dark:hover:bg-stone-800"
    >
      {children}
    </button>
  )
}
