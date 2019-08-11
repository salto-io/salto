import devaluate from '../utils'
import { evaluate } from '../../src/parser/expressions'

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
})
