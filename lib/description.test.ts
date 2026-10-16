import { describe, expect, it } from 'vitest'
import { findSpecConflicts, fixMojibake, normalizeDescription } from './description'

const JBL =
  'FONE JBL TUNE 530 BT O JBL Tune 530BT é um headphone sem fio. Conexão A conexão Bluetooth 6.0 permite utilizar o headphone sem fios. ' +
  'O JBL Tune 530BT é um headphone sem fio. Seu design dobrável facilita o transporte e permite guardar o headphone com mais pratici'

describe('normalizeDescription', () => {
  it('remove frases repetidas sem tirar o resto do conteúdo', () => {
    const { paragraphs } = normalizeDescription(JBL)
    const text = paragraphs.join(' ')
    expect(text.startsWith('FONE JBL TUNE 530 BT')).toBe(true)
    expect(text.match(/O JBL Tune 530BT é um headphone sem fio\./g)).toHaveLength(1)
  })

  it('corta a frase incompleta quando o texto chegou truncado', () => {
    const long = `${'Frase completa sobre o produto. '.repeat(70)}Seu design permite guardar com mais pratici`
    const result = normalizeDescription(long)
    expect(result.truncated).toBe(true)
    expect(result.paragraphs.join(' ')).not.toContain('pratici')
  })

  it('não marca como truncado um texto curto ou terminado com ponto', () => {
    expect(normalizeDescription('Texto curto sem ponto').truncated).toBe(false)
  })

  it('remove linhas de separadores e sobra vazio sem texto', () => {
    expect(normalizeDescription('Bom produto. ---------- Atenção: uso adulto.').paragraphs).toEqual(['Bom produto. Atenção: uso adulto.'])
    expect(normalizeDescription('   ').paragraphs).toEqual([])
    expect(normalizeDescription(null).paragraphs).toEqual([])
  })
})

describe('fixMojibake', () => {
  it('corrige texto UTF-8 lido como Latin-1 e preserva acentos legítimos', () => {
    expect(fixMojibake('aÃ§Ã£o rÃ¡pida')).toBe('ação rápida')
    expect(fixMojibake('ATENÇÃO: NÃO CONTÉM GLÚTEN')).toBe('ATENÇÃO: NÃO CONTÉM GLÚTEN')
  })
})

describe('findSpecConflicts', () => {
  const specs = [
    { name: 'Com Bluetooth', value: 'Sim' },
    { name: 'Versão de Bluetooth', value: '5.3' },
  ]

  it('aponta Bluetooth 6.0 na descrição contra 5.3 na ficha', () => {
    expect(findSpecConflicts(JBL, specs)).toEqual([{ label: 'Versão do Bluetooth', inDescription: '6', inSpecs: '5,3' }])
  })

  it('não aponta quando os valores batem ou a descrição cita mais de um', () => {
    expect(findSpecConflicts('Bluetooth 5.3 estável.', specs)).toEqual([])
    expect(findSpecConflicts('Compatível com Bluetooth 5.0 e Bluetooth 5.3.', specs)).toEqual([])
    expect(findSpecConflicts('Sem menção técnica.', specs)).toEqual([])
  })

  it('compara a capacidade da bateria em mAh', () => {
    expect(findSpecConflicts('Bateria de 5000 mAh.', [{ name: 'Capacidade da bateria', value: '4500 mAh' }])).toEqual([
      { label: 'Capacidade da bateria', inDescription: '5000 mAh', inSpecs: '4500 mAh' },
    ])
  })
})
