import { useState, type FormEvent } from 'react'
import { FEATURE_NAME_MAX_CHARS } from 'repotron-domain'

import { Button } from '../ui/button'
import { BUTTON_VARIANT } from '../ui/button.constants'
import { Dialog } from '../ui/dialog'
import { TextInput } from '../ui/text-input'
import { ASK_TEXT } from './ask.constants'

type FeatureNameDialogProps = {
  onClose(): void
  onSubmit(featureName: string): void
}

/** Asks for the name of the feature that the "Explain a feature" preset explains. */
export function FeatureNameDialog({ onClose, onSubmit }: FeatureNameDialogProps) {
  const [featureName, setFeatureName] = useState('')
  const trimmed = featureName.trim()

  function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (trimmed !== '') onSubmit(trimmed)
  }

  return (
    <Dialog title={ASK_TEXT.FEATURE_DIALOG_TITLE} onClose={onClose}>
      <p className="mt-1.5 text-sm leading-relaxed text-mute">{ASK_TEXT.FEATURE_DIALOG_TEXT}</p>
      <form onSubmit={submitName} className="mt-5">
        <TextInput
          label={ASK_TEXT.FEATURE_NAME_LABEL}
          value={featureName}
          maxLength={FEATURE_NAME_MAX_CHARS}
          placeholder={ASK_TEXT.FEATURE_NAME_PLACEHOLDER}
          autoComplete="off"
          autoFocus
          onChange={(event) => setFeatureName(event.target.value)}
        />
        <div className="mt-6 flex justify-end gap-2">
          <Button variant={BUTTON_VARIANT.GHOST} onClick={onClose}>
            {ASK_TEXT.FEATURE_CANCEL}
          </Button>
          <Button type="submit" disabled={trimmed === ''}>
            {ASK_TEXT.FEATURE_SUBMIT}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
