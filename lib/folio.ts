// Folio editorial · numeração ritual do "exemplar" do Atlas, com SENTIDO
// TEMPORAL real:
//   vol. N — ano do Atlas. vol. I = primeiro ciclo de 12 meses desde a
//            fundação; vira no aniversário (não no réveillon civil).
//   no. N  — dias acumulados desde a fundação. Cresce sempre, nunca reseta.
//            Peso cumulativo do projeto — "858º dia de Atlas" significa algo.
//
// Sem redundância com a dateline (que mostra "Sexta · 8 de Maio de 2026"):
// o folio carrega OUTRA dimensão temporal, não repete a data calendária.
//
// Fundação: 8 de maio de 2026. Hoje (dia 1) folio = "vol. i · no. 1".

export const ATLAS_FOUNDATION = new Date(2026, 4, 8) // mês 4 = maio (0-indexed)

export interface DailyFolio {
  full: string
  number: number
}

export function dailyFolio(): DailyFolio {
  const now = new Date()
  const oneDay = 1000 * 60 * 60 * 24
  const daysSinceFoundation = Math.max(
    1,
    Math.floor((now.getTime() - ATLAS_FOUNDATION.getTime()) / oneDay) + 1,
  )
  let yearsSince = now.getFullYear() - ATLAS_FOUNDATION.getFullYear()
  const nowMonthDay = now.getMonth() * 100 + now.getDate()
  const foundMonthDay =
    ATLAS_FOUNDATION.getMonth() * 100 + ATLAS_FOUNDATION.getDate()
  if (nowMonthDay < foundMonthDay) yearsSince -= 1
  const volume = Math.max(1, yearsSince + 1)
  return {
    full: `vol. ${toRomanLower(volume)} · no. ${daysSinceFoundation}`,
    number: daysSinceFoundation,
  }
}

// Numeral romano em minúsculas — vocabulário editorial (vol. iii, não III).
export function toRomanLower(n: number): string {
  if (n <= 0) return ''
  const map: Array<[number, string]> = [
    [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'],
    [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
    [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
  ]
  let result = ''
  let num = n
  for (const [v, s] of map) {
    while (num >= v) {
      result += s
      num -= v
    }
  }
  return result
}

// Edition · matinal antes de 12, vespertina depois.
export function currentEdition(): string {
  return new Date().getHours() < 12 ? 'edição matinal' : 'edição vespertina'
}

// Dateline editorial · "Quinta · 7 de Maio de 2026" (full names, no leading
// zero). Vocabulário de cabeçalho de jornal impresso.
export function editorialDateLine(date: Date = new Date()): string {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const weekdayLong = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date)
  const weekday = cap(weekdayLong.split('-')[0]!)
  const day = date.getDate()
  const month = cap(new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date))
  const year = date.getFullYear()
  return `${weekday} · ${day} de ${month} de ${year}`
}

// Standfirst longo do deck da seção · "diário de intenção · sete de maio".
// Día por extenso em pt-BR pra evocar manuscrito (não data técnica numérica).
const DAY_WORDS = [
  'zero','primeiro','dois','três','quatro','cinco','seis','sete','oito','nove',
  'dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete',
  'dezoito','dezenove','vinte','vinte e um','vinte e dois','vinte e três',
  'vinte e quatro','vinte e cinco','vinte e seis','vinte e sete','vinte e oito',
  'vinte e nove','trinta','trinta e um',
] as const

export function standfirstAgenda(date: Date = new Date()): string {
  const dayWord = DAY_WORDS[date.getDate()] ?? `dia ${date.getDate()}`
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date)
  return `diário de intenção · ${dayWord} de ${month}`
}

// Mês por extenso capitalizado · "Maio de 2026". Pra dateline da vista mensal.
export function monthLongLabel(date: Date = new Date()): string {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const month = cap(new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date))
  return `${month} de ${date.getFullYear()}`
}

// Dia por extenso · "sábado, 10 de maio". Pra deck da seção AMANHÃ.
export function dayLongLabel(date: Date): string {
  const weekdayLong = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date)
  const weekday = weekdayLong.split('-')[0]!
  const day = date.getDate()
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date)
  return `${weekday}, ${day} de ${month}`
}

// Folio label da vista Mês · "maio · mmxxvi" (lowercase · será uppercased
// pelo FolioFooter). Vocabulário canon Atlas — outra dimensão temporal
// que não usa "FOLIO N" porque o folio cumulativo é por dia, não mês.
export function monthFolioLabel(date: Date = new Date()): string {
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date).toLowerCase()
  return `${month} · ${toRomanLower(date.getFullYear())}`
}
