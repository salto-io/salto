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
import {
  InstanceElement, isInstanceElement, isPrimitiveType, ElemID, getFieldType, BuiltinTypes,
  isReferenceExpression, Value,
} from '@salto-io/adapter-api'
import { transformElement, TransformFunc } from '@salto-io/adapter-utils'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import wu from 'wu'
import {
  CUSTOM_RECORD_TYPE, CUSTOM_SEGMENT, DATASET, NETSUITE, TRANSACTION_COLUMN_CUSTOM_FIELD,
  WORKBOOK,
} from './constants'

const { isDefined } = lowerDashValues

export const findDependingInstancesFromRefs = (instance: InstanceElement): InstanceElement[] => {
  const visitedIdToInstance = new Map<string, InstanceElement>()
  const isRefToServiceId = (topLevelParent: InstanceElement, elemId: ElemID): boolean => {
    const fieldType = getFieldType(topLevelParent.type, elemId.createTopLevelParentID().path)
    return isPrimitiveType(fieldType) && fieldType.isEqual(BuiltinTypes.SERVICE_ID)
  }

  const createDependingElementsCallback: TransformFunc = ({ value }) => {
    if (isReferenceExpression(value)) {
      const { topLevelParent, elemId } = value
      if (isInstanceElement(topLevelParent)
        && !visitedIdToInstance.has(topLevelParent.elemID.getFullName())
        && elemId.adapter === NETSUITE
        && isRefToServiceId(topLevelParent, elemId)) {
        visitedIdToInstance.set(topLevelParent.elemID.getFullName(), topLevelParent)
      }
    }
    return value
  }

  transformElement({
    element: instance,
    transformFunc: createDependingElementsCallback,
    strict: true,
  })
  return wu(visitedIdToInstance.values()).toArray()
}

/*
 * Due to SDF bugs, sometimes referenced objects are required to be as part of the project as part
 * of deploy and writing them in the manifest.xml doesn't suffice.
 * Here we add automatically all of the referenced instances.
 */
export const getAllReferencedInstances = (
  sourceInstances: ReadonlyArray<InstanceElement>
): ReadonlyArray<InstanceElement> => {
  const visited = new Set<string>(sourceInstances.map(inst => inst.elemID.getFullName()))
  const getNewReferencedInstances = (instance: InstanceElement): InstanceElement[] => {
    const newInstances = findDependingInstancesFromRefs(instance)
      .filter(inst => !visited.has(inst.elemID.getFullName()))
    newInstances.forEach(inst => visited.add(inst.elemID.getFullName()))
    return [...newInstances, ...newInstances.flatMap(getNewReferencedInstances)]
  }
  return [
    ...sourceInstances,
    ...sourceInstances.flatMap(getNewReferencedInstances),
  ]
}

/*
 * Due to SDF bugs, sometimes referenced objects are required to be as part of the project as part
 * of deploy and writing them in the manifest.xml doesn't suffice.
 * Here we add manually all of the quirks we identified manually.
 */
export const getRequiredReferencedInstances = (
  sourceInstances: ReadonlyArray<InstanceElement>
): ReadonlyArray<InstanceElement> => {
  const getReferencedInstance = (value: Value, type?: string): InstanceElement | undefined => (
    (isReferenceExpression(value)
      && isInstanceElement(value.topLevelParent)
      && (type === undefined || value.topLevelParent.elemID.typeName === type))
      ? value.topLevelParent
      : undefined
  )

  const getInstanceRequiredDependency = (
    instance: InstanceElement
  ): InstanceElement | undefined => {
    switch (instance.elemID.typeName) {
      case CUSTOM_RECORD_TYPE:
        return getReferencedInstance(instance.value.customsegment, CUSTOM_SEGMENT)
      case CUSTOM_SEGMENT:
        return getReferencedInstance(instance.value.recordtype, CUSTOM_RECORD_TYPE)
      case WORKBOOK:
        return getReferencedInstance(instance.value.dependencies?.dependency, DATASET)
      case TRANSACTION_COLUMN_CUSTOM_FIELD:
        return getReferencedInstance(instance.value.sourcefrom) // might reference a lot of types
      default:
        return undefined
    }
  }
  const sourceInstancesIds = new Set(sourceInstances.map(inst => inst.elemID.getFullName()))
  const requiredReferencedInstances = sourceInstances
    .map(getInstanceRequiredDependency)
    .filter(isDefined)
    .filter(inst => !sourceInstancesIds.has(inst.elemID.getFullName()))

  return sourceInstances.concat(requiredReferencedInstances)
}
