// TICKET-0094: Codex has ImageGen as a built-in capability, not as a coding
// model. Keep the instruction construction pure so the UI never has to
// duplicate its output location or safety guidance.

const OUTPUT_DIRECTORY = '.ace/generated-images'

export function buildImageGenerationPrompt(brief) {
  const normalizedBrief = String(brief || '').trim().replace(/\s+/g, ' ')
  if (!normalizedBrief) return null

  return [
    'Use the available image generation capability to create an image for this request:',
    normalizedBrief,
    '',
    `Save the final image in ${OUTPUT_DIRECTORY}/ within this project (create the directory if needed).`,
    'When finished, reply with the exact relative path to the generated image and a one-line summary.',
  // This is written directly into an interactive terminal. Keep it on one
  // line: a newline would submit an incomplete prompt to the Codex TUI.
  ].join(' ')
}
