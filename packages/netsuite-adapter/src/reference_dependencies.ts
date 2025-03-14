/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  isInstanceElement,
  isPrimitiveType,
  ElemID,
  getFieldType,
  isReferenceExpression,
  Value,
  isServiceId,
  isObjectType,
  ChangeDataType,
  TopLevelElement,
} from '@salto-io/adapter-api'
import { transformElement, TransformFunc } from '@salto-io/adapter-utils'
import { values as lowerDashValues, collections } from '@salto-io/lowerdash'
import wu from 'wu'
import os from 'os'
import { CUSTOM_SEGMENT, NETSUITE, SCRIPT_ID, TRANSLATION_COLLECTION } from './constants'
import { isCustomRecordType } from './types'
import { DEFAULT_DEPLOY_REFERENCED_ELEMENTS } from './config/constants'

const { awu } = collections.asynciterable
const { isDefined } = lowerDashValues
const log = logger(module)

const isTopLevelElement = (value: unknown): value is TopLevelElement => isObjectType(value) || isInstanceElement(value)

const elementFullName = (element: ChangeDataType): string => element.elemID.getFullName()

export const findDependingElementsFromRefs = async (element: ChangeDataType): Promise<TopLevelElement[]> => {
  const visitedIdToElement = new Map<string, TopLevelElement>()
  const isRefToServiceId = async (topLevelParent: TopLevelElement, elemId: ElemID): Promise<boolean> => {
    if (isInstanceElement(topLevelParent)) {
      const fieldType = await getFieldType(await topLevelParent.getType(), elemId.createTopLevelParentID().path)
      return isPrimitiveType(fieldType) && isServiceId(fieldType)
    }
    return elemId.name === SCRIPT_ID
  }

  const createDependingElementsCallback: TransformFunc = async ({ value }) => {
    if (isReferenceExpression(value)) {
      const { topLevelParent, elemID } = value
      if (
        isTopLevelElement(topLevelParent) &&
        !visitedIdToElement.has(elementFullName(topLevelParent)) &&
        elemID.adapter === NETSUITE &&
        (await isRefToServiceId(topLevelParent, elemID))
      ) {
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
 * Here we add automatically all of the referenced elements (recursively).
 */
const getAllReferencedElements = async (
  sourceElements: ReadonlyArray<ChangeDataType>,
): Promise<ReadonlyArray<TopLevelElement>> => {
  const visited = new Set<string>(sourceElements.map(elementFullName))
  const getNewReferencedElement = async (element: ChangeDataType): Promise<TopLevelElement[]> => {
    const newElements = (await findDependingElementsFromRefs(element)).filter(
      elem => !visited.has(elementFullName(elem)),
    )
    newElements.forEach(elem => {
      log.debug(`adding referenced element: ${elementFullName(elem)}`)
      visited.add(elementFullName(elem))
    })
    return [...newElements, ...(await awu(newElements).flatMap(getNewReferencedElement).toArray())]
  }
  return awu(sourceElements).flatMap(getNewReferencedElement).toArray()
}

/*
 * Due to SDF bugs, sometimes referenced objects are required to be as part of the project as part
 * of deploy and writing them in the manifest.xml doesn't suffice.
 * Here we add manually all of the quirks we identified.
 */
export const getRequiredReferencedElements = async (
  sourceElements: ReadonlyArray<ChangeDataType>,
): Promise<ReadonlyArray<TopLevelElement>> => {
  const getReferencedElement = (
    value: Value,
    predicate: (element: TopLevelElement) => boolean,
  ): TopLevelElement | undefined =>
    isReferenceExpression(value) && isTopLevelElement(value.topLevelParent) && predicate(value.topLevelParent)
      ? value.topLevelParent
      : undefined

  const getRequiredDependency = (element: ChangeDataType): TopLevelElement | undefined => {
    if (isObjectType(element) && isCustomRecordType(element)) {
      return getReferencedElement(
        element.annotations.customsegment,
        elem => isInstanceElement(elem) && elem.elemID.typeName === CUSTOM_SEGMENT,
      )
    }
    if (isInstanceElement(element)) {
      switch (element.elemID.typeName) {
        case CUSTOM_SEGMENT:
          return getReferencedElement(element.value.recordtype, elem => isObjectType(elem) && isCustomRecordType(elem))
        default:
          return undefined
      }
    }
    return undefined
  }

  const sourceElementsSet = new Set(sourceElements.map(elementFullName))
  const requiredReferencedElements = _.uniqBy(
    sourceElements
      .map(getRequiredDependency)
      .filter(isDefined)
      .filter(elem => !sourceElementsSet.has(elementFullName(elem))),
    elementFullName,
  )
  const elements = sourceElements.concat(requiredReferencedElements)
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
    elementFullName,
  )

  const result = requiredReferencedElements.concat(referencedTranslationCollectionInstances)
  if (result.length > 0) {
    log.debug(`adding referenced elements:${os.EOL}${result.map(elementFullName).join(os.EOL)}`)
  }
  return result
}

export const getReferencedElements = async (
  elements: ReadonlyArray<ChangeDataType>,
  deployAllReferencedElements = DEFAULT_DEPLOY_REFERENCED_ELEMENTS,
): Promise<ReadonlyArray<TopLevelElement>> =>
  deployAllReferencedElements ? getAllReferencedElements(elements) : getRequiredReferencedElements(elements)
