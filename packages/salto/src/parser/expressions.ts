import _ from 'lodash'
import { Value, ElemID } from 'adapter-api'
import {
  HCLExpression, ExpressionType, SourceMap, SourceRange,
} from './hcl'
import { ReferenceExpression, TemplateExpression } from '../core/expressions'

type ExpEvaluator = (expression: HCLExpression) => Value

const evaluate = (expression: HCLExpression, baseId?: ElemID, srcMap?: SourceMap): Value => {
  const evalSubExpression = (exp: HCLExpression, key: string): Value =>
    evaluate(exp, baseId && baseId.createNestedID(key), srcMap)

  const evaluators: Record<ExpressionType, ExpEvaluator> = {
    list: exp => exp.expressions.map((e, idx) => evalSubExpression(e, idx.toString())),
    template: exp => (exp.expressions.filter(e => e.type !== 'literal').length === 0
      ? exp.expressions.map(e => evaluate(e)).join('')
      : new TemplateExpression(exp.expressions.map(e => evaluate(e)))),
    map: exp => _(exp.expressions)
      .chunk(2)
      .map(([keyExp, valExp]) => {
        const key = evaluate(keyExp)
        return [key, evalSubExpression(valExp, key)]
      })
      .fromPairs()
      .value(),
    literal: exp => exp.value,
    reference: exp => new ReferenceExpression(exp.value),
  }

  if (srcMap !== undefined && baseId !== undefined) {
    srcMap.get(baseId.getFullName()).push(expression.source as SourceRange)
  }
  return evaluators[expression.type](expression)
}

export default evaluate
