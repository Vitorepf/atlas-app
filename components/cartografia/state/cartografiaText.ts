export function displayText(value: unknown): string | null {
  if (Array.isArray(value)) {
    const text = value.map((item) => String(item).trim()).filter(Boolean).join(' · ')
    return text || null
  }
  if (typeof value === 'string') {
    const text = value.trim()
    return text || null
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return null
}

export function displayTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => displayText(item)).filter((item): item is string => Boolean(item))
  }
  const text = displayText(value)
  return text ? [text] : []
}
