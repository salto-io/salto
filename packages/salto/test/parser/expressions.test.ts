import _ from 'lodash'
import {
  evaluate, HCLExpression, HCLComplexExpression, HCLLiteralExpression,
} from '../../src/parser/expressions'

describe('HCL Expression', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devalute = (value: any): HCLExpression => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devaluteValue = (v: any): HCLLiteralExpression => ({
      type: 'literal',
      value: v,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devaluteString = (str: string): HCLComplexExpression => ({
      type: 'template',
      expressions: [devaluteValue(str)],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devaluteArray = (arr: any[]): HCLComplexExpression => ({
      type: 'list',
      expressions: arr.map(e => devalute(e)),
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devaluteObject = (obj: Record<string, any>): HCLComplexExpression => ({
      type: 'map',
      expressions: _(obj).entries().flatten().map(e => devalute(e))
        .value(),
    })

    if (_.isString(value)) {
      return devaluteString(value as string)
    }
    if (_.isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return devaluteArray(value as any[])
    }
    if (_.isPlainObject(value)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return devaluteObject(value as Record<string, any>)
    }
    return devaluteValue(value)
  }

  it('should evaluate strings', () => {
    const ref = 'This must be Thursday. I never could get the hang of Thursdays.'
    const exp = devalute(ref)
    expect(evaluate(exp)).toEqual(ref)
  })

  it('should evaluate maps', () => {
    const ref = { time: 'an illusion', lunchtime: 'doubly so' }
    const exp = devalute(ref)
    expect(evaluate(exp)).toEqual(ref)
  })

  it('should evaluate lists', () => {
    const ref = [1, 2, 4, 16, 31]
    const exp = devalute(ref)
    expect(evaluate(exp)).toEqual(ref)
  })

  it('should evaluate number', () => {
    const ref = 12
    const exp = devalute(ref)
    expect(evaluate(exp)).toEqual(ref)
  })

  it('should evaluate boolean', () => {
    const ref = true
    const exp = devalute(ref)
    expect(evaluate(exp)).toEqual(ref)
  })

  it('should throw expresion on unsupported types', () => {
    expect(() => evaluate({ type: 'I oppose' })).toThrow()
  })
})
