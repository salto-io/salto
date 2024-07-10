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
import { getParent, pathNaclCase } from '@salto-io/adapter-utils'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { FixElementsHandler } from './types'
import { TICKET_FIELD_CUSTOM_FIELD_OPTION, TICKET_FIELD_TYPE_NAME } from '../constants'

const { isDefined } = lowerDashValues
const { awu } = collections.asynciterable
const log = logger(module)

const PARENT_TO_CHILD_MAP: Record<string, string> = {
  [TICKET_FIELD_TYPE_NAME]: TICKET_FIELD_CUSTOM_FIELD_OPTION,
}

const ALL_TYPES = Object.entries(PARENT_TO_CHILD_MAP).flatMap(couple => couple)

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
  const parentNamesFromChild = new Set(
    childElements
      .map(child => {
        try {
          return getParent(child)
        } catch (e) {
          log.warn(
            `could not find parent for child ${child.elemID.getFullName()}, with error ${e}, will not fix this parent`,
          )
        }
        return undefined
      })
      .filter(isDefined)
      .map(parent => parent.elemID.getFullName())
      // we need to get all the parent names that don't appear already in the elements
      .filter(name => !parentNames.has(name)),
  )
  const parentElementsFromElementSource: InstanceElement[] = await awu(await elementsSource.list())
    .filter(id => id.idType === 'instance' && parentNamesFromChild.has(id.getFullName()))
    .map(id => elementsSource.get(id))
    .toArray()
  return parentElements.concat(parentElementsFromElementSource)
}

const getChildrenElemIdByParent = (allParents: InstanceElement[], elemIdsList: ElemID[]): Record<string, ElemID[]> =>
  Object.fromEntries(
    allParents.map(parent => {
      const parentElemId = parent.elemID
      const childrenElemIds = elemIdsList.filter(id =>
        id
          .getFullName()
          .startsWith(
            `${parentElemId.adapter}.${PARENT_TO_CHILD_MAP[parentElemId.typeName] ?? ''}.instance.${pathNaclCase(parentElemId.name)}`,
          ),
      )
      return [parentElemId.getFullName(), childrenElemIds]
    }),
  )

type FixedParentResult = { fixedParent: InstanceElement; childrenAdded: string[] }

const fixParent = (
  parent: InstanceElement,
  childrenElemIdByParent: Record<string, ElemID[]>,
  allChildrenByFullName: Record<string, InstanceElement>,
): FixedParentResult | undefined => {
  const parentOptions = parent.value.custom_field_options
  if (!_.isArray(parentOptions)) {
    return undefined
  }
  const parentOptionsElemIdSet = new Set(
    parentOptions.map(option => (isReferenceExpression(option) ? option.elemID.getFullName() : option)),
  )
  const childrenIdsFromElementSource = childrenElemIdByParent[parent.elemID.getFullName()]
  const childrenAdded: string[] = []
  const optionsToAdd = childrenIdsFromElementSource.flatMap(childElemId => {
    if (!parentOptionsElemIdSet.has(childElemId.getFullName())) {
      const optionToAdd = allChildrenByFullName[childElemId.getFullName()]
      if (!isInstanceElement(optionToAdd)) {
        return []
      }
      childrenAdded.push(optionToAdd.elemID.getFullName())
      return [new ReferenceExpression(optionToAdd.elemID, optionToAdd)]
    }
    return []
  })
  const fixedParent = parent.clone()
  const newOptions = parentOptions.concat(optionsToAdd)
  fixedParent.value.custom_field_options = !_.isEmpty(childrenAdded)
    ? newOptions
    : fixedParent.value.custom_field_options
  // we cannot have removed children (only in parent and not in elementSource) as they will appear in the dependency
  return !_.isEmpty(childrenAdded) ? { fixedParent, childrenAdded } : undefined
}

const getFixedParents = async (
  allParents: InstanceElement[],
  elementsSource: ReadOnlyElementsSource,
): Promise<FixedParentResult[]> => {
  const elemIdsList = await awu(await elementsSource.list()).toArray()
  const childrenElemIdByParent = getChildrenElemIdByParent(allParents, elemIdsList)
  const allChildrenElemIds = Object.values(childrenElemIdByParent).flatMap(list => list)
  const allChildren: InstanceElement[] = await awu(allChildrenElemIds)
    .map(id => elementsSource.get(id))
    .toArray()
  const allChildrenByFullName = _.keyBy(allChildren, child => child.elemID.getFullName())
  return allParents.map(parent => fixParent(parent, childrenElemIdByParent, allChildrenByFullName)).filter(isDefined)
}

const getError = (fixedParentsRes: FixedParentResult): ChangeError => ({
  elemID: fixedParentsRes.fixedParent.elemID,
  severity: 'Warning',
  message: 'custom_field_options were updated',
  detailedMessage: `${fixedParentsRes.fixedParent.elemID.typeName} custom_field_options were updated.
  The following options were added at the end of the list: ${fixedParentsRes.childrenAdded.join(', ')}.`,
})

/**
 * In this fixer we merge custom_field_options, by updating the father list to include all options from the elementsSource.
 * Therefor if there is a custom option that was deleted from the list however its instance was not deleted we will add it back to the list.
 */
export const mergeListsHandler: FixElementsHandler =
  ({ config, elementsSource }) =>
  async elements => {
    if (config.deploy?.fixParentOption !== true) {
      return {
        fixedElements: [],
        errors: [],
      }
    }
    const relevantElements = elements.filter(isRelevantElement)
    const allParents = await getAllParents(relevantElements, elementsSource)
    const fixedParentsResult = await getFixedParents(allParents, elementsSource)

    return {
      fixedElements: fixedParentsResult.map(res => res.fixedParent),
      errors: fixedParentsResult.map(getError),
    }
  }
