import { ReferenceExpression, TemplateExpression } from 'adapter-api'
import devaluate from './internal/devaluate'
import evaluate from '../../src/parser/expressions'

describe('HCL Expression', () => {
  it('should evaluate strings', () => {
    const ref = 'This must be Thursday. I never could get the hang of Thursdays.'
    const exp = devaluate(ref)
    expect(evaluate(exp)).toEqual(ref)
  })

  it('should evaluate maps', () => {
    const ref = { time: 'an illusion', lunchtime: 'doubly so' }
    const exp = devaluate(ref)
    expect(evaluate(exp)).toEqual(ref)
  })

  it('should evaluate lists', () => {
    const ref = [1, 2, 4, 16, 31]
    const exp = devaluate(ref)
    expect(evaluate(exp)).toEqual(ref)
  })

  it('should evaluate number', () => {
    const ref = 12
    const exp = devaluate(ref)
    expect(evaluate(exp)).toEqual(ref)
  })

  it('should evaluate boolean', () => {
    const ref = true
    const exp = devaluate(ref)
    expect(evaluate(exp)).toEqual(ref)
  })

  it('should evaluate reference', () => {
    const ref = new ReferenceExpression({ traversalParts: ['a', 'b', 'c'] })
    const exp = devaluate(ref)
    expect(evaluate(exp)).toEqual(ref)
  })

  it('should evaluate template reference', () => {
    const ref = new ReferenceExpression({ traversalParts: ['a', 'b', 'c'] })
    const templ = new TemplateExpression({ parts: [ref] })
    const exp = devaluate(templ)
    expect(evaluate(exp)).toEqual(templ)
  })
})
