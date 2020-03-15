/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import _ from 'lodash'
import {
  Value, ElemID, TemplateExpression, ReferenceExpression,
} from '@salto-io/adapter-api'
import { HclExpression, ExpressionType, SourceMap, SourceRange } from './internal/types'
import { UnresolvedReference } from '../core/expressions'
import { functionFactory } from './internal/functions/factory'

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
    dynamic: _exp => undefined,
    reference: exp => {
      const traversalParts = exp.value as unknown as string[]
      const ref = traversalParts.join(ElemID.NAMESPACE_SEPARATOR)
      try {
        return new ReferenceExpression(
          ElemID.fromFullName(ref)
        )
      } catch (e) {
        return new UnresolvedReference(ref)
      }
    },
    func: exp => {
      const { value: { parameters } } = exp
      const params: Value[] = (parameters.type && parameters.type === 'list')
        ? evaluators[parameters.type as ExpressionType](parameters)
        : parameters.map((x: HclExpression) => evaluate(x, baseId, sourceMap))
      exp.value.parameters = params
      return functionFactory(
        exp
      )
    },

  }

  if (sourceMap && baseId && expression.source) {
    sourceMap.push(baseId, expression as { source: SourceRange })
  }

  return evaluators[expression.type](expression)
}

export default evaluate
