require('./helpers/electron-stub')

const assert = require('node:assert/strict')
const test = require('node:test')

const { OptimizationAdvisor } = require('../main/services/OptimizationAdvisor')
const { DBService } = require('../main/services/DBService')

// analyze() derives all of its advice from DBService.getPrompts(); each test
// feeds it a synthetic prompt log and restores the real method afterwards.
function withPrompts(prompts, fn) {
  const orig = DBService.getPrompts
  DBService.getPrompts = () => prompts
  try {
    return fn()
  } finally {
    DBService.getPrompts = orig
  }
}

const categories = (result) => result.suggestions.map((s) => s.category)

test('reports an info message when there are no prompts', () => {
  withPrompts([], () => {
    const result = OptimizationAdvisor.analyze(1)
    // No-prompts path returns a bare array, not the { suggestions, stats } shape.
    assert.ok(Array.isArray(result))
    assert.equal(result[0].type, 'info')
  })
})

test('flags a batch of very long prompts', () => {
  const long = { prompt_text: 'x'.repeat(3001), input_tokens: 1000, output_tokens: 500 }
  withPrompts([long, long, long, long], () => {
    const result = OptimizationAdvisor.analyze(1)
    assert.ok(categories(result).includes('Prompt Length'))
  })
})

test('flags repeated context when many prompts share an opening', () => {
  const shared = 'SYSTEM CONTEXT: '.repeat(20) // > 200 chars, identical prefix
  const prompts = Array.from({ length: 8 }, (_, i) => ({
    prompt_text: shared + `unique tail ${i}`,
    input_tokens: 100,
    output_tokens: 80,
  }))
  withPrompts(prompts, () => {
    assert.ok(categories(OptimizationAdvisor.analyze(1)).includes('Repeated Context'))
  })
})

test('flags heavy-model use on short prompts', () => {
  const short = { prompt_text: 'hi', model: 'claude-opus-4-8', input_tokens: 50, output_tokens: 40 }
  withPrompts([short, short, short], () => {
    assert.ok(categories(OptimizationAdvisor.analyze(1)).includes('Model Selection'))
  })
})

test('flags a low output-to-input ratio as context waste', () => {
  const wasteful = Array.from({ length: 5 }, () => ({
    prompt_text: 'analyze this',
    input_tokens: 1000,
    output_tokens: 50, // 5% ratio, under the 10% floor
  }))
  withPrompts(wasteful, () => {
    assert.ok(categories(OptimizationAdvisor.analyze(1)).includes('Context Efficiency'))
  })
})

test('flags slow prompts', () => {
  const slow = { prompt_text: 'go', input_tokens: 100, output_tokens: 90, duration_ms: 45000 }
  withPrompts([slow, slow, slow, slow], () => {
    assert.ok(categories(OptimizationAdvisor.analyze(1)).includes('Speed'))
  })
})

test('returns an all-clear success when nothing is wrong', () => {
  const healthy = Array.from({ length: 5 }, () => ({
    prompt_text: 'concise task',
    model: 'claude-haiku-4-5',
    input_tokens: 200,
    output_tokens: 150, // healthy ratio
    duration_ms: 1200,
  }))
  withPrompts(healthy, () => {
    const result = OptimizationAdvisor.analyze(1)
    assert.deepEqual(categories(result), ['All Clear'])
    assert.equal(result.suggestions[0].type, 'success')
  })
})

test('computes summary stats over the prompt log', () => {
  const prompts = [
    { prompt_text: 'a', input_tokens: 100, output_tokens: 50, duration_ms: 100 },
    { prompt_text: 'b', input_tokens: 300, output_tokens: 150, duration_ms: 100 },
  ]
  withPrompts(prompts, () => {
    const { stats } = OptimizationAdvisor.analyze(1)
    assert.equal(stats.totalPrompts, 2)
    assert.equal(stats.totalTokens, 600)
    assert.equal(stats.avgInputTokens, 200)
    assert.equal(stats.avgOutputTokens, 100)
  })
})
