import { Compass, Layers } from 'lucide-react'

import { Button } from '../ui/button'
import { BUTTON_SIZE, BUTTON_VARIANT } from '../ui/button.constants'
import { ASK_TEXT } from './ask.constants'

type PresetButtonsProps = {
  onStartHere(): void
  onExplainFeature(): void
}

/** The 2 preset questions. Each one asks for an answer with 4 fixed sections. */
export function PresetButtons({ onStartHere, onExplainFeature }: PresetButtonsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 pl-1">
      <Button variant={BUTTON_VARIANT.SECONDARY} size={BUTTON_SIZE.SM} onClick={onStartHere}>
        <Compass aria-hidden className="size-3.5 text-accent" />
        {ASK_TEXT.PRESET_START_HERE}
      </Button>
      <Button variant={BUTTON_VARIANT.SECONDARY} size={BUTTON_SIZE.SM} onClick={onExplainFeature}>
        <Layers aria-hidden className="size-3.5 text-accent" />
        {ASK_TEXT.PRESET_EXPLAIN_FEATURE}
      </Button>
    </div>
  )
}
