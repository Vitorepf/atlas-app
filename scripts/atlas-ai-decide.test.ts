import assert from 'node:assert/strict'
import {
  classifyDecideDestino,
  decideInitialAtlasDestination,
  shouldClassifyAtlasAiDraft,
} from '../components/sheets/atlas-ai/AtlasAiDecideModel'

{
  assert.equal(classifyDecideDestino('comprar leite'), 'captura')
  assert.equal(classifyDecideDestino('ideia: revisar onboarding'), 'captura')
  assert.equal(classifyDecideDestino('dor no ombro depois do treino'), 'captura')
  assert.equal(classifyDecideDestino('pagar aluguel 10h'), 'captura')
  assert.equal(classifyDecideDestino('nota reunião com João'), 'captura')
  assert.equal(classifyDecideDestino('R$ 42 mercado'), 'captura')
  assert.equal(classifyDecideDestino('como eu organizo isso?'), 'conversa')
  assert.equal(classifyDecideDestino('criar uma tarefa para organizar esse plano e revisar depois'.repeat(3)), 'conversa')
  assert.equal(classifyDecideDestino('estou pensando sobre minha carreira'), 'conversa')
  assert.equal(classifyDecideDestino('preciso pensar sobre esse relacionamento'), 'conversa')
  assert.equal(classifyDecideDestino('me ajuda a organizar essa semana'), 'conversa')
  assert.equal(classifyDecideDestino('acho que eu estou travando de novo'), 'conversa')
  assert.equal(classifyDecideDestino('organizar minha vida'), 'conversa')
  assert.equal(classifyDecideDestino('isso aqui faz sentido para você'), 'conversa')
  assert.equal(classifyDecideDestino(''), null)
}

{
  const capture = decideInitialAtlasDestination('comprar leite')
  assert.equal(capture.destino, 'captura')
  assert.equal(capture.confidence >= 0.74, true)
  assert.equal(capture.reasons.includes('curto'), true)

  const ambiguous = decideInitialAtlasDestination('pensar sobre produto')
  assert.equal(ambiguous.destino, 'conversa')
}

{
  assert.equal(shouldClassifyAtlasAiDraft({
    currentThreadId: null,
    pending: false,
    traceCount: 0,
  }), true)
  assert.equal(shouldClassifyAtlasAiDraft({
    currentThreadId: 'thread-1',
    pending: false,
    traceCount: 0,
  }), false)
  assert.equal(shouldClassifyAtlasAiDraft({
    currentThreadId: null,
    pending: true,
    traceCount: 0,
  }), false)
  assert.equal(shouldClassifyAtlasAiDraft({
    currentThreadId: null,
    pending: false,
    traceCount: 1,
  }), false)
}

console.info('atlas ai decide tests passed')
