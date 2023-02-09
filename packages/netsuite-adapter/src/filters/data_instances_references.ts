/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ElemID, isElement, isInstanceElement, isListType, isReferenceExpression, ObjectType, ReferenceExpression, TypeElement, Value } from '@salto-io/adapter-api'
import { applyFunctionToChangeData, TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { getElementValueOrAnnotations, isDataObjectType } from '../types'
import { FilterCreator, FilterWith } from '../filter'
import { assignToInternalIdsIndex, getDataInstanceId } from '../elements_source_index/elements_source_index'
import { PARENT } from '../constants'

const { awu } = collections.asynciterable

const generateReference = (
  value: Value,
  type: TypeElement | undefined,
  elementsMap: Record<string, ElemID>,
): ReferenceExpression | undefined => {
  if (!value.internalId) {
    return undefined
  }
  if (type && elementsMap[getDataInstanceId(value.internalId, type.elemID.name)]) {
    return new ReferenceExpression(
      elementsMap[getDataInstanceId(value.internalId, type.elemID.name)]
    )
  }
  if (elementsMap[getDataInstanceId(value.internalId, value.typeId)]) {
    return new ReferenceExpression(
      elementsMap[getDataInstanceId(value.internalId, value.typeId)]
    )
  }
  return undefined
}

const generateParentReference = (
  value: Value,
  path: ElemID | undefined,
  type: ObjectType,
  elementsMap: Record<string, ElemID>,
): ReferenceExpression | undefined => (
  value.internalId
  && path && path.nestingLevel === 1 && path.name === PARENT
  && elementsMap[getDataInstanceId(value.internalId, type.elemID.name)]
    ? new ReferenceExpression(
      elementsMap[getDataInstanceId(value.internalId, type.elemID.name)]
    )
    : undefined
)

const replaceReference = (
  type: ObjectType,
  elementsMap: Record<string, ElemID>
): TransformFunc => async ({ value, path, field }) => {
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

  const reference = generateReference(value, fieldType, elementsMap)
  if (reference !== undefined) {
    return reference
  }
  const parentReference = generateParentReference(value, path, type, elementsMap)
  if (parentReference !== undefined) {
    return parentReference
  }
  return value
}

const getReferenceInternalId = (reference: ReferenceExpression): Value => (
  isElement(reference.value)
    ? getElementValueOrAnnotations(reference.value)
    : reference.value ?? {}
).internalId

const filterCreator: FilterCreator = ({ elementsSourceIndex, isPartial }): FilterWith<'onFetch'> => ({
  name: 'dataInstancesReferences',
  onFetch: async elements => {
    const elementsMap: Record<string, ElemID> = isPartial ? _.clone(
      (await elementsSourceIndex.getIndexes()).internalIdsIndex ?? {}
    ) : {}

    await awu(elements).forEach(async element => {
      await assignToInternalIdsIndex(element, elementsMap)
    })

    await awu(elements)
      .filter(isInstanceElement)
      .filter(async e => isDataObjectType(await e.getType()))
      .forEach(async instance => {
        const type = await instance.getType()
        instance.value = await transformValues({
          values: instance.value,
          type,
          transformFunc: replaceReference(type, elementsMap),
          strict: false,
          pathID: instance.elemID,
        }) ?? {}
      })
  },

  preDeploy: async changes => {
    await awu(changes)
      .forEach(async change =>
        applyFunctionToChangeData(
          change,
          async element => {
            if (!isInstanceElement(element) || !isDataObjectType(await element.getType())) {
              return element
            }

            element.value = await transformValues({
              values: element.value,
              type: await element.getType(),
              strict: false,
              pathID: element.elemID,
              transformFunc: async ({ value, field }) => {
                if (isReferenceExpression(value)) {
                  return { internalId: getReferenceInternalId(value) }
                }
                if (Array.isArray(value) && field?.annotations.isReference) {
                  return {
                    'platformCore:recordRef': value.map(val => (
                      isReferenceExpression(val)
                        ? { attributes: { internalId: getReferenceInternalId(val) } }
                        : val
                    )),
                  }
                }
                return value
              },
            }) ?? element.value

            return element
          }
        ))
  },
})

export default filterCreator
