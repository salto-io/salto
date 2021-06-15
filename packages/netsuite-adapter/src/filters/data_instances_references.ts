/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ElemID, isInstanceElement, isListType, ReferenceExpression, TypeElement, Value } from '@salto-io/adapter-api'
import { TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { isDataObjectType } from '../types'
import { FilterCreator } from '../filter'
import { getDataInstanceId } from '../elements_source_index/elements_source_index'

const { awu } = collections.asynciterable

const generateReference = (
  value: Value,
  type: TypeElement,
  elementsMap: Record<string, { elemID: ElemID }>,
): ReferenceExpression | undefined =>
  value.internalId
  && elementsMap[getDataInstanceId(value.internalId, type)]
  && new ReferenceExpression(elementsMap[getDataInstanceId(value.internalId, type)].elemID)

const replaceReference: (
  elementsMap: Record<string, { elemID: ElemID }>
) => TransformFunc = elementsMap => async ({ value, path, field }) => {
  if (path?.isTopLevel()) {
    return value
  }

  const fieldType = await field?.getType()
  if (isListType(fieldType) && value.recordRef !== undefined) {
    return Promise.all(value.recordRef.map(
      async (val: Value) => (generateReference(
        val,
        await fieldType.getInnerType(),
        elementsMap
      )) ?? val
    ))
  }

  const reference = fieldType && generateReference(value, fieldType, elementsMap)
  if (reference !== undefined) {
    return reference
  }
  return value
}

const filterCreator: FilterCreator = () => ({
  onFetch: async ({ elements, elementsSourceIndex, isPartial }) => {
    const instances = elements.filter(isInstanceElement)
    const dataInstancesMap: Record<string, { elemID: ElemID }> = isPartial ? _.clone(
      (await elementsSourceIndex.getIndexes()).internalIdsIndex
    ) : {}

    _.assign(
      dataInstancesMap,
      await awu(instances.filter(instance => instance.value.internalId !== undefined))
        .keyBy(async instance => getDataInstanceId(
          instance.value.internalId,
          await instance.getType(),
        ))
    )

    await awu(instances)
      .filter(async e => isDataObjectType(await e.getType()))
      .forEach(async instance => {
        const values = await transformValues({
          values: instance.value,
          type: await instance.getType(),
          transformFunc: replaceReference(dataInstancesMap),
          strict: false,
          pathID: instance.elemID,
        }) ?? instance.value
        instance.value = values
      })
  },
})

export default filterCreator
