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
import { InstanceElement, isInstanceElement, isListType, ReferenceExpression, TypeElement, Value } from '@salto-io/adapter-api'
import { TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { isDataObjectType } from '../types'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable

const getId = (value: Value, type: TypeElement): string => `${type.elemID.name}-${value.internalId}`

const generateReference = (
  value: Value,
  type: TypeElement,
  elementsMap: Record<string, InstanceElement>,
): ReferenceExpression | undefined =>
  value.internalId
  && elementsMap[getId(value, type)]
  && new ReferenceExpression(elementsMap[getId(value, type)].elemID)

const replaceReference: (
  elementsMap: Record<string, InstanceElement>
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
  onFetch: async ({ elements }) => {
    const instances = elements.filter(isInstanceElement)
    const dataInstancesMap = await awu(instances.filter(e => e.value.internalId !== undefined))
      .keyBy(async e => `${(await e.getType()).elemID.name}-${e.value.internalId}`)

    await awu(instances)
      .filter(async e => isDataObjectType(await e.getType()))
      .forEach(async element => {
        const values = await transformValues({
          values: element.value,
          type: await element.getType(),
          transformFunc: replaceReference(dataInstancesMap),
          strict: false,
          pathID: element.elemID,
        }) ?? {}
        element.value = values
      })
  },
})

export default filterCreator
