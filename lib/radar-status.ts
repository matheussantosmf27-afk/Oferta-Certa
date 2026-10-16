/** Estado público do Radar (get_radar_status), em texto honesto para a home. */

export interface RadarStatus {
  published: number
  verified24h: number
  lastSuccessAt: string | null
  lastRunStatus: string | null
  lastRunAt: string | null
}

export interface RadarStatusText {
  text: string
  healthy: boolean
}

const STALE_AFTER_HOURS = 6

function when(iso: string, now: Date): string {
  const date = new Date(iso)
  const tz = 'America/Sao_Paulo'
  const day = (value: Date) => value.toLocaleDateString('pt-BR', { timeZone: tz })
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz })
  return day(date) === day(now) ? `às ${time}` : `em ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: tz })} às ${time}`
}

const plural = (count: number, one: string, many: string) => `${count.toLocaleString('pt-BR')} ${count === 1 ? one : many}`

export function parseRadarStatus(raw: unknown): RadarStatus | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const toInt = (value: unknown) => (Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0)
  const toDate = (value: unknown) => (typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null)
  return {
    published: toInt(row.published),
    verified24h: toInt(row.verified_24h),
    lastSuccessAt: toDate(row.last_success_at),
    lastRunStatus: typeof row.last_run_status === 'string' ? row.last_run_status : null,
    lastRunAt: toDate(row.last_run_at),
  }
}

/**
 * Separa ofertas publicadas de ofertas com preço conferido nas últimas 24 horas e informa a última
 * coleta concluída de verdade. Se a última coleta falhou ou está atrasada, diz isso.
 */
export function radarStatusText(status: RadarStatus | null, now = new Date()): RadarStatusText | null {
  if (!status || !status.published) return null
  const offers = `${plural(status.published, 'oferta publicada', 'ofertas publicadas')}, ${plural(status.verified24h, 'com preço conferido', 'com preço conferido')} nas últimas 24 horas.`
  if (!status.lastSuccessAt) return { text: offers, healthy: false }
  const failed = status.lastRunStatus === 'error'
  const stale = now.getTime() - Date.parse(status.lastSuccessAt) > STALE_AFTER_HOURS * 3_600_000
  if (failed) return { text: `${offers} A última coleta falhou; a última concluída foi ${when(status.lastSuccessAt, now)}.`, healthy: false }
  return { text: `${offers} Última coleta concluída ${when(status.lastSuccessAt, now)}.`, healthy: !stale }
}
