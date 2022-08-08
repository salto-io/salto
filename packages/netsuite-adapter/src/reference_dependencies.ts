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
  isInstanceElement, isPrimitiveType, ElemID, getFieldType,
  isReferenceExpression, Value, isServiceId, isObjectType, Element,
} from '@salto-io/adapter-api'
import { transformElement, TransformFunc } from '@salto-io/adapter-utils'
import { values as lowerDashValues, collections } from '@salto-io/lowerdash'
import wu from 'wu'
import os from 'os'
import { CUSTOM_SEGMENT, DATASET, NETSUITE, SCRIPT_ID, WORKBOOK } from './constants'
import { isCustomRecordType } from './types'

const { awu } = collections.asynciterable
const { isDefined } = lowerDashValues
const log = logger(module)

export const findDependingElementsFromRefs = async (
  element: Element
): Promise<Element[]> => {
  const visitedIdToElement = new Map<string, Element>()
  const isRefToServiceId = async (
    topLevelParent: Element,
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
      if (topLevelParent
        && !visitedIdToElement.has(topLevelParent.elemID.getFullName())
        && elemID.adapter === NETSUITE
        && await isRefToServiceId(topLevelParent, elemID)) {
        visitedIdToElement.set(topLevelParent.elemID.getFullName(), topLevelParent)
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
  sourceElements: ReadonlyArray<Element>
): Promise<ReadonlyArray<Element>> => {
  const visited = new Set<string>(sourceElements.map(elem => elem.elemID.getFullName()))
  const getNewReferencedElement = async (
    element: Element
  ): Promise<Element[]> => {
    const newElements = (await findDependingElementsFromRefs(element))
      .filter(elem => !visited.has(elem.elemID.getFullName()))
    newElements.forEach(elem => {
      log.debug(`adding referenced element: ${elem.elemID.getFullName()}`)
      visited.add(elem.elemID.getFullName())
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
const getRequiredReferencedElements = (
  sourceElements: ReadonlyArray<Element>
): ReadonlyArray<Element> => {
  const getReferencedElement = (
    value: Value,
    predicate: (element: Element) => boolean
  ): Element | undefined => (
    (isReferenceExpression(value)
      && value.topLevelParent
      && predicate(value.topLevelParent))
      ? value.topLevelParent
      : undefined
  )

  const getRequiredDependency = (
    element: Element
  ): Element | undefined => {
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

  log.debug(`adding referenced element:${os.EOL}${requiredReferencedElements.map(elem => elem.elemID.getFullName()).join('\n')}`)

  return Array.from(new Set(sourceElements.concat(requiredReferencedElements)))
}

export const getReferencedElements = async (
  elements: ReadonlyArray<Element>,
  deployAllReferencedElements: boolean
): Promise<ReadonlyArray<Element>> => (
  deployAllReferencedElements
    ? getAllReferencedElements(elements)
    : getRequiredReferencedElements(elements)
)
