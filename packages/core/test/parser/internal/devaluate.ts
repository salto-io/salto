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
  ReferenceExpression, TemplateExpression,
} from '@salto-io/adapter-api'
import { SourceRange, HclExpression } from '../../../src/parser/internal/types'
import { getFunctionExpression } from '../../../src/parser/functions'
import { FunctionExpression } from '../../../src/parser/internal/functions'

const source: SourceRange = {
  filename: 'dummy',
  start: { line: 0, col: 0, byte: 0 },
  end: { line: 0, col: 0, byte: 0 },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const devaluate = async (value: any): Promise<HclExpression> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devaluateValue = (v: any): HclExpression => ({
    type: 'literal',
    expressions: [],
    value: v,
    source,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devaluateString = (str: string): HclExpression => ({
    type: 'template',
    expressions: [devaluateValue(str)],
    source,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devaluateArray = async (arr: any[]): Promise<HclExpression> => ({
    type: 'list',
    expressions: await Promise.all(arr.map(e => devaluate(e))),
    source,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devaluateObject = async (obj: Record<string, any>): Promise<HclExpression> => ({
    type: 'map',
    expressions: await Promise.all(_(obj).entries().flatten().map(e => devaluate(e))
      .value()),
    source,
  })

  const devaluateReference = (ref: ReferenceExpression): HclExpression => ({
    type: 'reference',
    value: ref.traversalParts,
    expressions: [],
    source,
  })

  const devaluateTemplateExpression = (templateExp: TemplateExpression): HclExpression => ({
    type: 'template',
    expressions: templateExp.parts.map(p => (
      p instanceof ReferenceExpression ? devaluateReference(p) : devaluateValue(p)
    )),
    source,
  })

  const devaluateFunction = async (funcExp: FunctionExpression): Promise<HclExpression> => ({
    type: 'func',
    expressions: [],
    value: {
      funcName: funcExp.funcName,
      parameters: await Promise.all(funcExp.parameters.map(devaluate)),
    },
    source,
  })

  if (_.isString(value)) {
    return Promise.resolve(devaluateString(value as string))
  }
  if (_.isArray(value)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Promise.resolve(devaluateArray(value as any[]))
  }
  if (_.isPlainObject(value)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return devaluateObject(value as Record<string, any>)
  }
  if (value instanceof ReferenceExpression) {
    return Promise.resolve(devaluateReference(value))
  }
  if (value instanceof TemplateExpression) {
    return Promise.resolve(devaluateTemplateExpression(value))
  }

  const funcValue = await getFunctionExpression(value)

  return funcValue === undefined
    ? Promise.resolve(devaluateValue(value))
    : devaluateFunction(funcValue)
}

export default devaluate
