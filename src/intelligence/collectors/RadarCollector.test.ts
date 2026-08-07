import { describe, expect, it } from 'vitest'
import { RadarCollector } from './RadarCollector'
import { DummyJsonConnector } from '../connectors/DummyJsonConnector'
import { MercadoLivreConnector } from '../connectors/MercadoLivreConnector'

describe('RadarCollector', () => {
  it('uses MercadoLivreConnector by default outside development and test mode', () => {
    const previousNodeEnv = process.env.NODE_ENV
    const env = process.env as any
    env.NODE_ENV = 'production'

    try {
      const collector = new RadarCollector()
      expect((collector as any).connector).toBeInstanceOf(MercadoLivreConnector)
    } finally {
      env.NODE_ENV = previousNodeEnv
    }
  })

  it('uses DummyJsonConnector in development mode by default', () => {
    const previousNodeEnv = process.env.NODE_ENV
    const env = process.env as any
    env.NODE_ENV = 'development'

    try {
      const collector = new RadarCollector()
      expect((collector as any).connector).toBeInstanceOf(DummyJsonConnector)
    } finally {
      env.NODE_ENV = previousNodeEnv
    }
  })

  it('allows using DummyJsonConnector explicitly', () => {
    const collector = new RadarCollector(new DummyJsonConnector())
    expect((collector as any).connector).toBeInstanceOf(DummyJsonConnector)
  })
})
