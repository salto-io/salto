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

import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import {
  GetInsightsFunc,
  InstanceElement,
  isInstanceElement,
  isReferenceExpression,
  Value,
} from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from '../filters/fields/constants'
import { isReferenceToInstance } from './workflow_v1_transitions'
import { SCREEN_TYPE_NAME } from '../constants'

const { DefaultMap } = collections.map
const { makeArray } = collections.array

export const isFieldInstance = (instance: InstanceElement): boolean => instance.elemID.typeName === FIELD_TYPE_NAME

const isCustomFieldInstance = (instance: InstanceElement): boolean =>
  isFieldInstance(instance) && instance.value.schema === undefined

const isCustomFieldContextInstance = (instance: InstanceElement): boolean =>
  instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME

const isScreenInstance = (instance: InstanceElement): boolean => instance.elemID.typeName === SCREEN_TYPE_NAME

const isCustomFieldWithoutDescription = (instance: InstanceElement): boolean =>
  instance.value.description === undefined || instance.value.description === ''

const isCustomFieldWithoutContext = (instance: InstanceElement): boolean =>
  instance.value.contexts === undefined || instance.value.contexts.length === 0

const isCustomFieldContextOptionsNotSorted = (instance: InstanceElement): boolean => {
  const options = Object.values(instance.value.options ?? {}).filter(_.isPlainObject)
  const alphabericSorted = _.sortBy(options, (option: Value) => option.value)
  const positionSorted = _.sortBy(options, (option: Value) => option.position)
  return !_.isEqual(alphabericSorted, positionSorted)
}

const isCustomFieldContextGlobal = (instance: InstanceElement): boolean => instance.value.isGlobalContext === true

const getDuplicateNamesCustomFieldsOnSameIssueType = (customFieldInstances: InstanceElement[]): InstanceElement[] => {
  const duplicatedNameFields = Object.values(_.groupBy(customFieldInstances, instance => instance.value.name)).filter(
    fields => fields.length > 1,
  )

  const duplicatedNameFieldsInSameIssueType = duplicatedNameFields.flatMap(fields => {
    const issueTypesToFields = new DefaultMap<string, InstanceElement[]>(() => [])
    fields.forEach(field =>
      makeArray(field.value.contexts)
        .filter(isReferenceToInstance)
        .forEach(ref =>
          makeArray(ref.value.value.issueTypeIds)
            .filter(isReferenceExpression)
            .forEach(issueType => {
              issueTypesToFields.get(issueType.elemID.getFullName()).push(field)
            }),
        ),
    )
    return Array.from(issueTypesToFields).flatMap(([_issueType, fieldsOnIssueType]) =>
      fieldsOnIssueType.length > 1 ? fieldsOnIssueType : [],
    )
  })

  return _.uniqBy(duplicatedNameFieldsInSameIssueType, instance => instance.elemID.getFullName())
}

const getCustomFieldsThatNotOnAnyScreen = (
  customFieldInstances: InstanceElement[],
  screenInstances: InstanceElement[],
): InstanceElement[] => {
  const fieldsInScreens = new Set(
    screenInstances.flatMap(instance =>
      Object.values(instance.value.tabs ?? {})
        .filter(_.isPlainObject)
        .flatMap((tab: Value) => makeArray(tab.fields))
        .filter(isReferenceExpression)
        .map(ref => ref.elemID.getFullName()),
    ),
  )

  return customFieldInstances.filter(instance => !fieldsInScreens.has(instance.elemID.getFullName()))
}

const getInsights: GetInsightsFunc = elements => {
  const instances = elements.filter(isInstanceElement)
  const customFieldInstances = instances.filter(isCustomFieldInstance)
  const customFieldContextInstances = instances.filter(isCustomFieldContextInstance)
  const screenInstances = instances.filter(isScreenInstance)

  const customFieldsWithoutDescription = customFieldInstances
    .filter(isCustomFieldWithoutDescription)
    .map(instance => ({ path: instance.elemID, message: 'Custom Field without description' }))

  const customFieldsWithoutContext = customFieldInstances
    .filter(isCustomFieldWithoutContext)
    .map(instance => ({ path: instance.elemID, message: 'Custom Field without context' }))

  const customFieldOptionsNotSorted = customFieldContextInstances
    .filter(isCustomFieldContextOptionsNotSorted)
    .map(instance => ({
      path: getParent(instance).elemID,
      message: 'Custom Field Select list options are not sorted alphabetically',
    }))

  const customFieldContextIsGlobal = customFieldContextInstances.filter(isCustomFieldContextGlobal).map(instance => ({
    path: getParent(instance).elemID,
    message: 'Custom Field have a global context',
  }))

  const duplicateNamesCustomFieldsOnSameIssueType = getDuplicateNamesCustomFieldsOnSameIssueType(
    customFieldInstances,
  ).map(instance => ({ path: instance.elemID, message: 'Custom Field with duplicate name on the same issue type' }))

  const customFieldsThatNotOnAnyScreen = getCustomFieldsThatNotOnAnyScreen(customFieldInstances, screenInstances).map(
    instance => ({ path: instance.elemID, message: 'Custom Field is not on any screen' }),
  )

  return customFieldsWithoutDescription
    .concat(customFieldsWithoutContext)
    .concat(customFieldOptionsNotSorted)
    .concat(customFieldContextIsGlobal)
    .concat(duplicateNamesCustomFieldsOnSameIssueType)
    .concat(customFieldsThatNotOnAnyScreen)
}

export default getInsights
