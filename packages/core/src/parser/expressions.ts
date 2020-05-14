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
  Value, ElemID, TemplateExpression, ReferenceExpression, VariableExpression,
} from '@salto-io/adapter-api'
import { HclExpression, ExpressionType, SourceRange } from './internal/types'
import {
  evaluateFunction,
  Functions,
} from './functions'
import { SourceMap } from './internal/source_map'

type ExpEvaluator = (expression: HclExpression) => Promise<Value>

export class IllegalReference {
  constructor(public ref: string, public message: string) {}
}

const evaluate = async (
  expression: HclExpression,
  functions: Functions,
  baseId?: ElemID,
  sourceMap?: SourceMap,
): Promise<Value> => {
  const evalSubExpression = (exp: HclExpression, key: string): Promise<Value> =>
    evaluate(exp, functions, baseId && baseId.createNestedID(key), sourceMap)

  const evaluators: Record<ExpressionType, ExpEvaluator> = {
    list: exp => Promise.all(exp.expressions.map((e, idx) => evalSubExpression(e, idx.toString()))),
    template: async exp => (
      exp.expressions.filter(e => e.type !== 'literal').length === 0
        ? (await Promise.all(exp.expressions.map(e => evaluate(e, functions)))).join('')
        : new TemplateExpression(
          { parts: await Promise.all(exp.expressions.map(e => evaluate(e, functions))) }
        )
    ),
    map: async exp => _.fromPairs(await Promise.all(_(exp.expressions)
      .chunk(2)
      .map(async ([keyExp, valExp]) => {
        const key = await evaluate(keyExp, functions)
        // Change source start to include the key expression as well
        const updatedValExp = {
          ...valExp,
          source: { ...valExp.source, start: keyExp.source.start },
        }
        return [key, await evalSubExpression(updatedValExp, key)]
      }).value())),
    literal: exp => Promise.resolve(exp.value),
    dynamic: _exp => Promise.resolve(undefined),
    reference: exp => {
      const traversalParts = exp.value as unknown as string[]
      const ref = traversalParts.join(ElemID.NAMESPACE_SEPARATOR)
      try {
        const elemId = ElemID.fromFullName(ref)
        return elemId.adapter === ElemID.VARIABLES_NAMESPACE
          ? Promise.resolve(new VariableExpression(elemId))
          : Promise.resolve(new ReferenceExpression(elemId))
      } catch (e) {
        return Promise.resolve(new IllegalReference(ref, e.message))
      }
    },
    func: async exp => {
      const { value: { parameters } } = exp
      const params: Value[] = await Promise.all(
        parameters.map((x: HclExpression) => evaluate(x, functions))
      )
      return evaluateFunction(
        {
          ...exp,
          ...{
            value: {
              ...exp.value,
              parameters: params,
            },
          },
        },
        functions
      )
    },
  }

  if (sourceMap && baseId && expression.source) {
    sourceMap.push(baseId.getFullName(), expression as { source: SourceRange })
  }

  return evaluators[expression.type](expression)
}

export default evaluate
