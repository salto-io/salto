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
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { transformValues, TransformFunc } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import {
  Element, Values, ObjectType, Field, InstanceElement,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { apiName, isInstanceOfCustomObject } from '../transformers/transformer'
import { FIELD_ANNOTATIONS, CUSTOM_OBJECT_ID_FIELD } from '../constants'
import { isLookupField, isMasterDetailField } from './utils'

const { makeArray } = collections.array
const { groupByAsync, awu } = collections.asynciterable

const log = logger(module)

const replaceReferenceValues = async (
  values: Values,
  type: ObjectType,
  instancesByType: Record<string, Record<string, InstanceElement>>
): Promise<Values> => {
  const shouldReplace = (field: Field): boolean => (
    isLookupField(field) || isMasterDetailField(field)
  )

  const transformFunc: TransformFunc = ({ value, field }) => {
    if (_.isUndefined(field) || !shouldReplace(field)) {
      return value
    }
    const refTo = makeArray(field?.annotations?.[FIELD_ANNOTATIONS.REFERENCE_TO])
    const refTarget = refTo
      .map(typeName => instancesByType[typeName]?.[value])
      .filter(lowerdashValues.isDefined)
      .pop()
    return refTarget === undefined ? value : new ReferenceExpression(refTarget.elemID)
  }

  return await transformValues(
    {
      values,
      type,
      transformFunc,
      strict: false,
    }
  ) ?? values
}

const replaceLookupsWithReferences = async (elements: Element[]): Promise<void> => {
  const customObjectInstances = await awu(elements)
    .filter(isInstanceOfCustomObject)
    .toArray() as InstanceElement[]
  const instancesByType = _.mapValues(
    await groupByAsync(
      customObjectInstances,
      async instance => apiName(await instance.getType(), true)
    ),
    typeInstances =>
      _.keyBy(
        typeInstances,
        inst => inst.value[CUSTOM_OBJECT_ID_FIELD]
      )
  ) as Record<string, Record<string, InstanceElement>>
  await awu(customObjectInstances).forEach(async (instance, index) => {
    instance.value = await replaceReferenceValues(
      instance.value,
      await instance.getType(),
      instancesByType,
    )
    if (index % 500 === 0) {
      log.debug(`Replaced lookup with references for ${index} instances`)
    }
  })
}

const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    await replaceLookupsWithReferences(elements)
  },
})

export default filter
