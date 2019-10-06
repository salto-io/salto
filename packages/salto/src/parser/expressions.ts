import _ from 'lodash'
import {
  Value, ElemID, TemplateExpression, ReferenceExpression,
} from 'adapter-api'
import { HclExpression, ExpressionType } from './internal/hcl'
import { SourceMap, SourceRange } from './internal/types'

type ExpEvaluator = (expression: HclExpression) => Value

const evaluate = (expression: HclExpression, baseId?: ElemID, sourceMap?: SourceMap): Value => {
  const evalSubExpression = (exp: HclExpression, key: string): Value =>
    evaluate(exp, baseId && baseId.createNestedID(key), sourceMap)

  const evaluators: Record<ExpressionType, ExpEvaluator> = {
    list: exp => exp.expressions.map((e, idx) => evalSubExpression(e, idx.toString())),
    template: exp => (
      exp.expressions.filter(e => e.type !== 'literal').length === 0
        ? exp.expressions.map(e => evaluate(e)).join('')
        : new TemplateExpression({ parts: exp.expressions.map(e => evaluate(e)) })
    ),
    map: exp => _(exp.expressions)
      .chunk(2)
      .map(([keyExp, valExp]) => {
        const key = evaluate(keyExp)
        // Change source start to include the key expression as well
        const updatedValExp = {
          ...valExp,
          source: { ...valExp.source, start: keyExp.source.start },
        }
        return [key, evalSubExpression(updatedValExp, key)]
      })
      .fromPairs()
      .value(),
    literal: exp => exp.value,
    reference: exp => new ReferenceExpression({ traversalParts: exp.value }),
  }

  if (sourceMap && baseId && expression.source) {
    sourceMap.push(baseId, expression as { source: SourceRange })
  }

  return evaluators[expression.type](expression)
}

export default evaluate
