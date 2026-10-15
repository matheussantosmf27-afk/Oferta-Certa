import { describe, expect, it } from 'vitest'
import { parseRadarStatus, radarStatusText } from './radar-status'

const now = new Date('2026-10-15T18:40:00Z') // 15:40 em São Paulo

describe('radarStatusText', () => {
  it('separa publicadas de conferidas e mostra a última coleta concluída', () => {
    const result = radarStatusText(
      { published: 386, verified24h: 310, lastSuccessAt: '2026-10-15T18:31:00Z', lastRunStatus: 'success', lastRunAt: '2026-10-15T18:31:00Z' },
      now
    )
    expect(result).toEqual({
      text: '386 ofertas publicadas, 310 com preço conferido nas últimas 24 horas. Última coleta concluída às 15:31.',
      healthy: true,
    })
  })

  it('avisa quando a última coleta falhou', () => {
    const result = radarStatusText(
      { published: 10, verified24h: 2, lastSuccessAt: '2026-10-14T18:31:00Z', lastRunStatus: 'error', lastRunAt: '2026-10-15T18:00:00Z' },
      now
    )
    expect(result?.healthy).toBe(false)
    expect(result?.text).toContain('A última coleta falhou; a última concluída foi em 14/10 às 15:31.')
  })

  it('marca como atrasado quando a última coleta tem mais de 6 horas', () => {
    const result = radarStatusText(
      { published: 10, verified24h: 2, lastSuccessAt: '2026-10-15T08:00:00Z', lastRunStatus: 'success', lastRunAt: '2026-10-15T08:00:00Z' },
      now
    )
    expect(result?.healthy).toBe(false)
  })

  it('sem ofertas publicadas não mostra nada', () => {
    expect(radarStatusText({ published: 0, verified24h: 0, lastSuccessAt: null, lastRunStatus: null, lastRunAt: null }, now)).toBeNull()
    expect(radarStatusText(null, now)).toBeNull()
  })
})

describe('parseRadarStatus', () => {
  it('normaliza números e datas inválidas', () => {
    expect(parseRadarStatus({ published: '5', verified_24h: -3, last_success_at: 'x', last_run_status: 'success' })).toEqual({
      published: 5,
      verified24h: 0,
      lastSuccessAt: null,
      lastRunStatus: 'success',
      lastRunAt: null,
    })
    expect(parseRadarStatus(null)).toBeNull()
  })
})
