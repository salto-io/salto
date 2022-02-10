/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { logger } from '@salto-io/logging'
import {
  InstanceElement, isInstanceElement, isPrimitiveType, ElemID, getFieldType,
  isReferenceExpression, Value, isServiceId,
} from '@salto-io/adapter-api'
import { transformElement, TransformFunc } from '@salto-io/adapter-utils'
import { values as lowerDashValues, collections } from '@salto-io/lowerdash'
import wu from 'wu'
import os from 'os'
import {
  CUSTOM_RECORD_TYPE, CUSTOM_SEGMENT, DATASET, NETSUITE, WORKBOOK,
} from './constants'

const { awu } = collections.asynciterable
const { isDefined } = lowerDashValues
const log = logger(module)

export const findDependingInstancesFromRefs = async (
  instance: InstanceElement
): Promise<InstanceElement[]> => {
  const visitedIdToInstance = new Map<string, InstanceElement>()
  const isRefToServiceId = async (
    topLevelParent: InstanceElement,
    elemId: ElemID
  ): Promise<boolean> => {
    const fieldType = await getFieldType(
      await topLevelParent.getType(),
      elemId.createTopLevelParentID().path
    )
    return (isPrimitiveType(fieldType)
      && isServiceId(fieldType))
  }

  const createDependingElementsCallback: TransformFunc = async ({ value }) => {
    if (isReferenceExpression(value)) {
      const { topLevelParent, elemID } = value
      if (isInstanceElement(topLevelParent)
        && !visitedIdToInstance.has(topLevelParent.elemID.getFullName())
        && elemID.adapter === NETSUITE
        && await isRefToServiceId(topLevelParent, elemID)) {
        visitedIdToInstance.set(topLevelParent.elemID.getFullName(), topLevelParent)
      }
    }
    return value
  }

  await transformElement({
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
const getAllReferencedInstances = async (
  sourceInstances: ReadonlyArray<InstanceElement>
): Promise<ReadonlyArray<InstanceElement>> => {
  const visited = new Set<string>(sourceInstances.map(inst => inst.elemID.getFullName()))
  const getNewReferencedInstances = async (
    instance: InstanceElement
  ): Promise<InstanceElement[]> => {
    const newInstances = (await findDependingInstancesFromRefs(instance))
      .filter(inst => !visited.has(inst.elemID.getFullName()))
    newInstances.forEach(inst => {
      log.debug(`adding referenced instance: ${inst.elemID.getFullName()}`)
      visited.add(inst.elemID.getFullName())
    })
    return [
      ...newInstances,
      ...await awu(newInstances).flatMap(getNewReferencedInstances).toArray(),
    ]
  }
  return [
    ...sourceInstances,
    ...await awu(sourceInstances).flatMap(getNewReferencedInstances).toArray(),
  ]
}

/*
 * Due to SDF bugs, sometimes referenced objects are required to be as part of the project as part
 * of deploy and writing them in the manifest.xml doesn't suffice.
 * Here we add manually all of the quirks we identified.
 */
const getRequiredReferencedInstances = (
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
      default:
        return undefined
    }
  }
  const requiredReferencedInstances = sourceInstances
    .map(getInstanceRequiredDependency)
    .filter(isDefined)

  log.debug(`adding referenced instances:${os.EOL}${requiredReferencedInstances.map(inst => inst.elemID.getFullName()).join('\n')}`)

  return Array.from(new Set(sourceInstances.concat(requiredReferencedInstances)))
}

export const getReferencedInstances = async (
  instances: ReadonlyArray<InstanceElement>,
  deployAllReferencedElements: boolean
): Promise<ReadonlyArray<InstanceElement>> => (
  deployAllReferencedElements
    ? getAllReferencedInstances(instances)
    : getRequiredReferencedInstances(instances)
)
