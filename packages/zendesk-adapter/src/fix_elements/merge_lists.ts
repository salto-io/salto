/*
 *                      Copyright 2024 Salto Labs Ltd.
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
/* eslint-disable no-console */

import {
  ChangeError,
  ElemID,
  InstanceElement,
  isInstanceElement,
  isReferenceExpression,
  ReadOnlyElementsSource,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { getParents, pathNaclCase } from '@salto-io/adapter-utils'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { FixElementsHandler } from './types'
import { TICKET_FIELD_CUSTOM_FIELD_OPTION, TICKET_FIELD_TYPE_NAME } from '../constants'

const { isDefined } = lowerDashValues
const { awu } = collections.asynciterable
const log = logger(module)

const PARENT_TO_CHILD_MAP: Record<string, string> = {
  [TICKET_FIELD_TYPE_NAME]: TICKET_FIELD_CUSTOM_FIELD_OPTION,
}

const ALL_TYPES = Object.entries(PARENT_TO_CHILD_MAP).flat()

const isRelevantElement = (element: unknown): element is InstanceElement =>
  isInstanceElement(element) && ALL_TYPES.includes(element.elemID.typeName)

const getAllParents = async (
  relevantElements: InstanceElement[],
  elementsSource: ReadOnlyElementsSource,
): Promise<InstanceElement[]> => {
  const [parentElements, childElements] = _.partition(relevantElements, elem =>
    Object.keys(PARENT_TO_CHILD_MAP).includes(elem.elemID.typeName),
  )
  const parentNames = new Set(parentElements.map(parent => parent.elemID.getFullName()))
  const additionalRelevantParentNames = childElements
    .map(child => {
      const parent = getParents(child)[0]
      if (isReferenceExpression(parent)) {
        return parent
      }
      log.warn(
        `could not find parent for child ${child.elemID.getFullName()}, parent is not a reference expression, will not fix this parent`,
      )
      return undefined
    })
    .filter(isDefined)
    // we need to get all the parent names that don't appear already in the elements
    .filter(parent => !parentNames.has(parent.elemID.getFullName()))
    .map(parent => parent.elemID)

  const parentElementsFromElementSource: InstanceElement[] = await awu(additionalRelevantParentNames)
    .map(id => elementsSource.get(id))
    .toArray()
  return parentElements.concat(parentElementsFromElementSource)
}

const getChildrenElemIdByParent = (
  allParents: InstanceElement[],
  childElemIdsList: ElemID[],
): Record<string, ElemID[]> => {
  const parentsByType = _.groupBy(allParents, parent => parent.elemID.typeName)
  const childrenByType = _.groupBy(childElemIdsList, childElemId => childElemId.typeName)
  return Object.fromEntries(
    Object.entries(parentsByType).flatMap(([type, parents]) =>
      parents.map(parent => {
        const parentElemId = parent.elemID
        const childrenElemIds = childrenByType[PARENT_TO_CHILD_MAP[type]].filter(id =>
          id
            .getFullName()
            .startsWith(
              `${parentElemId.adapter}.${PARENT_TO_CHILD_MAP[parentElemId.typeName] ?? ''}.instance.${pathNaclCase(parentElemId.name)}`,
            ),
        )
        return [parentElemId.getFullName(), childrenElemIds]
      }),
    ),
  )
}

type FixedParentResult = { fixedParent: InstanceElement; childrenAdded: string[]; childrenRemoved: string[] }

const fixParent = (
  parent: InstanceElement,
  childrenElemIdByParent: Record<string, ElemID[]>,
  allChildrenByFullName: Record<string, ElemID>,
): FixedParentResult | undefined => {
  // custom_field_options will have to be configurable if we decide to support other types beside ticket, user and org field
  const parentOptions = parent.value.custom_field_options
  if (!_.isArray(parentOptions)) {
    return undefined
  }
  const parentOptionsElemIdSet = new Set(
    parentOptions.map(option => (isReferenceExpression(option) ? option.elemID.getFullName() : option)),
  )
  const childrenIdsFromElementSource = childrenElemIdByParent[parent.elemID.getFullName()]
  const childrenIdsFromElementSourceSet = new Set(childrenIdsFromElementSource.map(elemId => elemId.getFullName()))
  const childrenAdded: string[] = []
  const childrenRemoved: string[] = []
  const optionsToAdd = childrenIdsFromElementSource.flatMap(childElemId => {
    if (!parentOptionsElemIdSet.has(childElemId.getFullName())) {
      const optionToAdd = allChildrenByFullName[childElemId.getFullName()]
      if (optionToAdd === undefined) {
        return []
      }
      childrenAdded.push(optionToAdd.getFullName())
      return [new ReferenceExpression(optionToAdd)]
    }
    return []
  })
  const fixedParent = parent.clone()
  const newOptions = parentOptions.concat(optionsToAdd).filter(option => {
    if (isReferenceExpression(option) && !childrenIdsFromElementSourceSet.has(option.elemID.getFullName())) {
      childrenRemoved.push(option.elemID.getFullName())
      return false
    }
    return true
  })
  const shouldUpdateParent = !_.isEmpty(childrenAdded) || !_.isEmpty(childrenRemoved)
  fixedParent.value.custom_field_options = shouldUpdateParent ? newOptions : fixedParent.value.custom_field_options
  return shouldUpdateParent ? { fixedParent, childrenAdded, childrenRemoved } : undefined
}

const getFixedParents = async (
  allParents: InstanceElement[],
  elementsSource: ReadOnlyElementsSource,
): Promise<FixedParentResult[]> => {
  const childElemIdsList = await awu(await elementsSource.list())
    .filter(id => Object.values(PARENT_TO_CHILD_MAP).includes(id.typeName))
    .toArray()
  const childrenElemIdByParent = getChildrenElemIdByParent(allParents, childElemIdsList)
  const allChildren: ElemID[] = Object.values(childrenElemIdByParent).flat()
  const allChildrenByFullName = _.keyBy(allChildren, childElemId => childElemId.getFullName())
  return allParents.map(parent => fixParent(parent, childrenElemIdByParent, allChildrenByFullName)).filter(isDefined)
}

const getError = (fixedParentsRes: FixedParentResult): ChangeError => {
  const childrenAddedMsg = !_.isEmpty(fixedParentsRes.childrenAdded)
    ? `\nThe following custom field options were added at the end of the list: ${fixedParentsRes.childrenAdded.join(', ')}.`
    : ''
  const childrenRemovedMsg = !_.isEmpty(fixedParentsRes.childrenRemoved)
    ? `\nThe following custom field options were removed from the list: ${fixedParentsRes.childrenRemoved.join(', ')}.`
    : ''
  return {
    elemID: fixedParentsRes.fixedParent.elemID,
    severity: 'Warning',
    message: 'The list of custom field options was automatically updated',
    detailedMessage: `${childrenAddedMsg}${childrenRemovedMsg}`,
  }
}

/**
 * In this fixer we merge custom_field_options, by updating the father list to include all options from the elementsSource.
 * Therefor if there is a custom option that was deleted from the list however its instance was not deleted we will add it back to the list.
 */
export const mergeListsHandler: FixElementsHandler =
  ({ elementsSource }) =>
  async elements => {
    const relevantElements = elements.filter(isRelevantElement)
    if (_.isEmpty(relevantElements)) {
      return {
        fixedElements: [],
        errors: [],
      }
    }
    const allParents = await getAllParents(relevantElements, elementsSource)
    const fixedParentsResult = await getFixedParents(allParents, elementsSource)

    return {
      fixedElements: fixedParentsResult.map(res => res.fixedParent),
      errors: fixedParentsResult.map(getError),
    }
  }
