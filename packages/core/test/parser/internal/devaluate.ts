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
  ReferenceExpression, TemplateExpression, StaticAssetExpression,
} from '@salto-io/adapter-api'
import { SourceRange, HclExpression } from '../../../src/parser/internal/types'

const source: SourceRange = {
  filename: 'dummy',
  start: { line: 0, col: 0, byte: 0 },
  end: { line: 0, col: 0, byte: 0 },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const devaluate = (value: any): HclExpression => {
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
  const devaluateArray = (arr: any[]): HclExpression => ({
    type: 'list',
    expressions: arr.map(e => devaluate(e)),
    source,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devaluateObject = (obj: Record<string, any>): HclExpression => ({
    type: 'map',
    expressions: _(obj).entries().flatten().map(e => devaluate(e))
      .value(),
    source,
  })

  const devaluateReference = (ref: ReferenceExpression): HclExpression => ({
    type: 'reference',
    value: ref.traversalParts,
    expressions: [],
    source,
  })

  const devaluateStaticAsset = (ref: StaticAssetExpression): HclExpression => ({
    type: 'staticFileAsset',
    value: {
      filePath: ref.filePath,
      text: ref.text,
    },
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

  if (_.isString(value)) {
    return devaluateString(value as string)
  }
  if (_.isArray(value)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return devaluateArray(value as any[])
  }
  if (_.isPlainObject(value)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return devaluateObject(value as Record<string, any>)
  }
  if (value instanceof StaticAssetExpression) {
    return devaluateStaticAsset(value)
  }

  if (value instanceof ReferenceExpression) {
    return devaluateReference(value)
  }
  if (value instanceof TemplateExpression) {
    return devaluateTemplateExpression(value)
  }

  return devaluateValue(value)
}

export default devaluate
