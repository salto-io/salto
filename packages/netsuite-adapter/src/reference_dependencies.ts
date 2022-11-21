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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  isInstanceElement, isPrimitiveType, ElemID, getFieldType,
  isReferenceExpression, Value, isServiceId, isObjectType, ChangeDataType,
} from '@salto-io/adapter-api'
import { transformElement, TransformFunc } from '@salto-io/adapter-utils'
import { values as lowerDashValues, collections } from '@salto-io/lowerdash'
import wu from 'wu'
import os from 'os'
import { CUSTOM_SEGMENT, DATASET, NETSUITE, SCRIPT_ID, TRANSLATION_COLLECTION, WORKBOOK } from './constants'
import { isCustomRecordType } from './types'

const { awu } = collections.asynciterable
const { isDefined } = lowerDashValues
const log = logger(module)

const elementFullName = (element: ChangeDataType): string => element.elemID.getFullName()

export const findDependingElementsFromRefs = async (
  element: ChangeDataType
): Promise<ChangeDataType[]> => {
  const visitedIdToElement = new Map<string, ChangeDataType>()
  const isRefToServiceId = async (
    topLevelParent: ChangeDataType,
    elemId: ElemID
  ): Promise<boolean> => {
    if (isInstanceElement(topLevelParent)) {
      const fieldType = await getFieldType(
        await topLevelParent.getType(),
        elemId.createTopLevelParentID().path
      )
      return isPrimitiveType(fieldType) && isServiceId(fieldType)
    }
    return elemId.name === SCRIPT_ID
  }

  const createDependingElementsCallback: TransformFunc = async ({ value }) => {
    if (isReferenceExpression(value)) {
      const { topLevelParent, elemID } = value
      if ((isObjectType(topLevelParent) || isInstanceElement((topLevelParent)))
        && !visitedIdToElement.has(elementFullName(topLevelParent))
        && elemID.adapter === NETSUITE
        && await isRefToServiceId(topLevelParent, elemID)) {
        visitedIdToElement.set(elementFullName(topLevelParent), topLevelParent)
      }
    }
    return value
  }

  await transformElement({
    element,
    transformFunc: createDependingElementsCallback,
    strict: false,
  })
  return wu(visitedIdToElement.values()).toArray()
}

/*
 * Due to SDF bugs, sometimes referenced objects are required to be as part of the project as part
 * of deploy and writing them in the manifest.xml doesn't suffice.
 * Here we add automatically all of the referenced elements.
 */
const getAllReferencedElements = async (
  sourceElements: ReadonlyArray<ChangeDataType>
): Promise<ReadonlyArray<ChangeDataType>> => {
  const visited = new Set<string>(sourceElements.map(elementFullName))
  const getNewReferencedElement = async (
    element: ChangeDataType
  ): Promise<ChangeDataType[]> => {
    const newElements = (await findDependingElementsFromRefs(element))
      .filter(elem => !visited.has(elementFullName(elem)))
    newElements.forEach(elem => {
      log.debug(`adding referenced element: ${elementFullName(elem)}`)
      visited.add(elementFullName(elem))
    })
    return [
      ...newElements,
      ...await awu(newElements).flatMap(getNewReferencedElement).toArray(),
    ]
  }
  return [
    ...sourceElements,
    ...await awu(sourceElements).flatMap(getNewReferencedElement).toArray(),
  ]
}

/*
 * Due to SDF bugs, sometimes referenced objects are required to be as part of the project as part
 * of deploy and writing them in the manifest.xml doesn't suffice.
 * Here we add manually all of the quirks we identified.
 */
const getRequiredReferencedElements = async (
  sourceElements: ReadonlyArray<ChangeDataType>
): Promise<ReadonlyArray<ChangeDataType>> => {
  const getReferencedElement = (
    value: Value,
    predicate: (element: ChangeDataType) => boolean
  ): ChangeDataType | undefined => (
    (isReferenceExpression(value)
      && (isObjectType(value.topLevelParent) || isInstanceElement(value.topLevelParent))
      && predicate(value.topLevelParent))
      ? value.topLevelParent
      : undefined
  )

  const getRequiredDependency = (
    element: ChangeDataType
  ): ChangeDataType | undefined => {
    if (isObjectType(element) && isCustomRecordType(element)) {
      return getReferencedElement(
        element.annotations.customsegment,
        elem => isInstanceElement(elem) && elem.elemID.typeName === CUSTOM_SEGMENT
      )
    }
    if (isInstanceElement(element)) {
      switch (element.elemID.typeName) {
        case CUSTOM_SEGMENT:
          return getReferencedElement(
            element.value.recordtype,
            elem => isObjectType(elem) && isCustomRecordType(elem)
          )
        case WORKBOOK:
          return getReferencedElement(
            element.value.dependencies?.dependency,
            elem => isInstanceElement(elem) && elem.elemID.typeName === DATASET
          )
        default:
          return undefined
      }
    }
    return undefined
  }
  const requiredReferencedElements = sourceElements
    .map(getRequiredDependency)
    .filter(isDefined)

  const elements = _.uniqBy(sourceElements.concat(requiredReferencedElements), elementFullName)
  const elementsSet = new Set(elements.map(elementFullName))
  // SALTO-2974 Due to SDF bug, it seems like referenced translation collection instances
  // must be included in the SDF project.
  const referencedTranslationCollectionInstances = _.uniqBy(
    await awu(elements)
      .flatMap(findDependingElementsFromRefs)
      .filter(isInstanceElement)
      .filter(element => element.elemID.typeName === TRANSLATION_COLLECTION)
      .filter(element => !elementsSet.has(elementFullName(element)))
      .toArray(),
    elementFullName
  )

  log.debug(`adding referenced elements:${os.EOL}${
    requiredReferencedElements
      .concat(referencedTranslationCollectionInstances)
      .map(elementFullName)
      .join(os.EOL)
  }`)
  return elements.concat(referencedTranslationCollectionInstances)
}

export const getReferencedElements = async (
  elements: ReadonlyArray<ChangeDataType>,
  deployAllReferencedElements: boolean
): Promise<ReadonlyArray<ChangeDataType>> => (
  deployAllReferencedElements
    ? getAllReferencedElements(elements)
    : getRequiredReferencedElements(elements)
)
