import _ from 'lodash'

export interface HCLExpression {type: string}
export type HCLComplexExpression = HCLExpression&{expressions: HCLExpression[]}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HCLLiteralExpression = HCLExpression&{value: any}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const evaluate = (exp: HCLExpression): any => {
  const evaluateList = (
    listExp: HCLComplexExpression
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any[] => listExp.expressions.map(evaluate)

  const evaluateTemplate = (
    templateExp: HCLComplexExpression
  ): string => templateExp.expressions.map(evaluate).join('')

  const evaluateMap = (
    mapExp: HCLComplexExpression
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Record<string, any> => _(mapExp.expressions).map(
    e => evaluate(e)
  ).chunk(2).fromPairs()
    .value()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const evaluateLiteral = (literalExp: HCLLiteralExpression): any => literalExp.value

  if (exp.type === 'list') {
    return evaluateList(exp as HCLComplexExpression)
  }
  if (exp.type === 'template') {
    return evaluateTemplate(exp as HCLComplexExpression)
  }
  if (exp.type === 'map') {
    return evaluateMap(exp as HCLComplexExpression)
  }
  if (exp.type === 'literal') {
    return evaluateLiteral(exp as HCLLiteralExpression)
  }
  throw new Error(`unsupported expression! ${exp.type}`)
}
