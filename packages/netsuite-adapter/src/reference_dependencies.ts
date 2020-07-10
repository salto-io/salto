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
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { transformElement, TransformFunc } from '@salto-io/adapter-utils'
import wu from 'wu'
import { NETSUITE } from './constants'

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
