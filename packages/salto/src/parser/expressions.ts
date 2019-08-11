import _ from 'lodash'

type ExpressionType = 'list'|'map'|'template'|'literal'
export interface HCLExpression {
  type: ExpressionType
  expressions: HCLExpression[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value?: any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExpEvaluator = (expression: HCLExpression) => any

export const evaluate: ExpEvaluator = expression => {
  const evaluators: Record<ExpressionType, ExpEvaluator> = {
    list: exp => exp.expressions.map(evaluate),
    template: exp => exp.expressions.map(evaluate).join(''),
    map: exp => _(exp.expressions).map(evaluate).chunk(2).fromPairs()
      .value(),
    literal: exp => exp.value,
  }

  return evaluators[expression.type](expression)
}
