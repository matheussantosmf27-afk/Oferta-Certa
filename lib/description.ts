/**
 * Normalização das descrições vindas do catálogo da loja, feita na exibição (o texto original
 * continua guardado no banco). Não inventa nada: só limpa formatação, remove repetições e
 * aponta quando a descrição diverge da ficha técnica, sem escolher um dos valores.
 */

export interface NormalizedDescription {
  paragraphs: string[]
  /** O texto veio cortado na origem ou no armazenamento; a descrição completa está na loja. */
  truncated: boolean
}

export interface SpecConflict {
  label: string
  inDescription: string
  inSpecs: string
}

const STORED_LIMIT = 1990
const MOJIBAKE = /Ã[\u0080-¿]|â€[\u0080-¿™œ]/

/** Corrige texto UTF-8 que foi lido como Latin-1 ("aÃ§Ã£o" → "ação"), só quando o padrão aparece. */
export function fixMojibake(text: string): string {
  if (!MOJIBAKE.test(text)) return text
  try {
    const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff)
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return decoded
  } catch {
    return text
  }
}

const normalizeForCompare = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export function normalizeDescription(raw: string | null | undefined): NormalizedDescription {
  if (!raw?.trim()) return { paragraphs: [], truncated: false }
  let text = fixMojibake(raw)
    .replace(/[-_=*~•·]{3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const sentences = text.split(/(?<=[.!?…])\s+(?=[A-ZÀ-Ý0-9"“(])/)
  const truncated = raw.length >= STORED_LIMIT && !/[.!?…]["”)]?\s*$/.test(raw.trim())
  if (truncated && sentences.length > 1) sentences.pop()

  // Frase repetida (igual ou já contida numa frase anterior) aparece uma vez só.
  const kept: string[] = []
  const unique = sentences.filter((sentence) => {
    const key = normalizeForCompare(sentence)
    if (!key || kept.some((previous) => previous === key || (key.length >= 30 && previous.includes(key)))) return false
    kept.push(key)
    return true
  })

  const paragraphs: string[] = []
  for (let index = 0; index < unique.length; index += 3) paragraphs.push(unique.slice(index, index + 3).join(' '))
  return { paragraphs, truncated }
}

const number = (value: string) => Number(value.replace(',', '.'))
const distinct = (values: number[]) => [...new Set(values.filter(Number.isFinite))]

interface ConflictRule {
  label: string
  specName: RegExp
  fromDescription: RegExp
  fromSpec: RegExp
  unit: string
}

const RULES: ConflictRule[] = [
  {
    label: 'Versão do Bluetooth',
    specName: /vers[ãa]o.*bluetooth|bluetooth.*vers[ãa]o/i,
    fromDescription: /bluetooth\s*(?:v(?:ers[ãa]o)?\.?\s*)?(\d(?:[.,]\d)?)\b/gi,
    fromSpec: /(\d(?:[.,]\d)?)/,
    unit: '',
  },
  {
    label: 'Capacidade da bateria',
    specName: /bateria|capacidade/i,
    fromDescription: /(\d{3,6})\s*mah\b/gi,
    fromSpec: /(\d{3,6})\s*mah/i,
    unit: ' mAh',
  },
]

/**
 * Compara valores técnicos citados na descrição com a ficha técnica. Só aponta divergência quando a
 * descrição cita um único valor e a ficha traz outro; nesses casos o site avisa, sem escolher um lado.
 */
export function findSpecConflicts(description: string | null | undefined, specs: { name: string; value: string }[]): SpecConflict[] {
  if (!description) return []
  const conflicts: SpecConflict[] = []
  for (const rule of RULES) {
    const spec = specs.find((item) => rule.specName.test(item.name) && rule.fromSpec.test(item.value))
    if (!spec) continue
    const specValue = number((rule.fromSpec.exec(spec.value) as RegExpExecArray)[1])
    const mentioned = distinct([...description.matchAll(rule.fromDescription)].map((match) => number(match[1])))
    if (mentioned.length === 1 && mentioned[0] !== specValue) {
      const format = (value: number) => `${String(value).replace('.', ',')}${rule.unit}`
      conflicts.push({ label: rule.label, inDescription: format(mentioned[0]), inSpecs: format(specValue) })
    }
  }
  return conflicts
}
