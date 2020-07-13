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
import { isPlainObject } from 'lodash'
import { serialization, strings } from '@salto-io/lowerdash'
import {
  isReferenceExpression, ReferenceExpression, isStaticFile, StaticFile, isElement,
} from '@salto-io/adapter-api'
import { prototypeToClassName } from './common'

const { stableCollator } = strings

const sortObjectProps = (o: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(
  Object.entries(o).sort(([k1], [k2]) => stableCollator.compare(k1, k2))
)

const serializeStaticFile = (v: StaticFile): StaticFile => new StaticFile({
  filepath: v.filepath,
  hash: v.hash,
})

export type SerializeOpts = {
  referenceSerializerMode: 'replaceRefWithValue' | 'keepRef'
  stable: boolean
}

export const serialize = (
  data: unknown,
  {
    referenceSerializerMode = 'replaceRefWithValue',
    stable = false,
  }: Partial<SerializeOpts> = {},
): string => {
  const serializeReferenceExpression = (e: ReferenceExpression): unknown => {
    if (e.value === undefined || referenceSerializerMode === 'keepRef') {
      return e.createWithValue(undefined)
    }

    // Replace ref with value in order to keep the result from changing between
    // a fetch and a deploy.

    if (isElement(e.value)) {
      return new ReferenceExpression(e.value.elemID)
    }

    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return serializeAccordingToType(e.value)
  }

  const serializeAccordingToType = (v: unknown): unknown => {
    let result = v
    if (isReferenceExpression(result)) {
      result = serializeReferenceExpression(result)
    }

    if (isStaticFile(result)) {
      result = serializeStaticFile(result)
    }

    if (stable && isPlainObject(result)) {
      // Sort objects so that the state file won't change for the same data
      result = sortObjectProps(result as Record<string, unknown>)
    }

    return result
  }

  return serialization.jsonSerializer({
    knownPrototypes: prototypeToClassName,
  }).stringify(
    data, (
      _propName: string, propValue: unknown
    ): unknown => serializeAccordingToType(propValue),
  )
}
