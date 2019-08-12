import _ from 'lodash'

import { ReferenceExpression } from '../core/expressions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExpEvaluator = (expression: HCLExpression) => any

const evaluate: ExpEvaluator = expression => {
  const evaluators: Record<ExpressionType, ExpEvaluator> = {
    list: exp => exp.expressions.map(evaluate),
    template: exp => exp.expressions.map(evaluate).join(''),
    map: exp => _(exp.expressions).map(evaluate).chunk(2).fromPairs()
      .value(),
    literal: exp => exp.value,
    reference: exp => new ReferenceExpression(exp.value),
  }
  return evaluators[expression.type](expression)
}

export default evaluate
