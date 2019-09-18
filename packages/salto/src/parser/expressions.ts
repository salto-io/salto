import _ from 'lodash'
import { Value, ElemID } from 'adapter-api'
import { TemplateExpression, ReferenceExpression } from '../core/expressions'
import { HCLExpression, ExpressionType } from './hcl'
import { SourceMap, SourceRange } from './parser_internal_types'

type ExpEvaluator = (expression: HCLExpression) => Value

const evaluate = (expression: HCLExpression, baseId?: ElemID, sourceMap?: SourceMap): Value => {
  const evalSubExpression = (exp: HCLExpression, key: string): Value =>
    evaluate(exp, baseId && baseId.createNestedID(key), sourceMap)

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

  if (sourceMap && baseId && expression.source) {
    sourceMap.push(baseId, expression as { source: SourceRange })
  }

  return evaluators[expression.type](expression)
}

export default evaluate
