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
import Joi from 'joi'
import {
  Change, ChangeDataType, getChangeData, InstanceElement,
  isAdditionOrModificationChange, isInstanceChange, ReferenceExpression, toChange, Value,
} from '@salto-io/adapter-api'
import {
  applyFunctionToChangeData,
  createSchemeGuard,
  getParents,
  resolveChangeElement,
  references,
  replaceTemplatesWithValues, isResolvedReferenceExpression,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { lookupFunc } from './field_references'
import { ZendeskFetchConfig } from '../config'
import { BRAND_TYPE_NAME, CUSTOM_FIELD_OPTIONS_FIELD_NAME } from '../constants'
import { prepRef } from './handle_template_expressions'

const { awu } = collections.asynciterable
const log = logger(module)
const { isArrayOfRefExprToInstances } = references
export type Condition = {
  field: string | ReferenceExpression
  value?: unknown
}
export type SubjectCondition = {
  subject: string | ReferenceExpression
  value?: unknown
}

const TYPES_WITH_SUBJECT_CONDITIONS = ['routing_attribute_value']

export const applyforInstanceChangesOfType = async (
  changes: Change<ChangeDataType>[],
  typeNames: string[],
  func: (arg: InstanceElement) => Promise<InstanceElement> | InstanceElement,
): Promise<void> => {
  await awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change => typeNames.includes(getChangeData(change).elemID.typeName))
    .forEach(change => applyFunctionToChangeData<Change<InstanceElement>>(
      change,
      func,
    ))
}

export const createAdditionalParentChanges = async (
  childrenChanges: Change<InstanceElement>[],
  shouldResolve = true,
  childrenField = CUSTOM_FIELD_OPTIONS_FIELD_NAME
): Promise<Change<InstanceElement>[] | undefined> => {
  const childrenInstance = getChangeData(childrenChanges[0])
  const parents = getParents(childrenInstance)
  if (_.isEmpty(parents) || !isArrayOfRefExprToInstances(parents)) {
    log.error(`Failed to update the following ${
      childrenInstance.elemID.typeName} instances since they have no valid parent: ${
      childrenChanges.map(getChangeData).map(e => e.elemID.getFullName())}`)
    return undefined
  }

  const changes = parents.map(parent => {
    const newParent = parent.value.clone()

    const childrenToFullName = _.keyBy(childrenChanges.map(getChangeData), child => child.elemID.getFullName())
    // the children are the instances from the elementsSource, which are the instances at the start of the deployment
    // In case the children were changed during the preDeploy, we need to update their values here
    newParent.value[childrenField] = _.isArray(newParent.value[childrenField])
      ? newParent.value[childrenField].map((child: Value) => {
        if (isResolvedReferenceExpression(child)) {
          const childFromChanges = childrenToFullName[child.elemID.getFullName()]
          if (childFromChanges !== undefined) {
            return new ReferenceExpression(child.elemID, childFromChanges)
          }
        }
        return child
      })
      : newParent.value[childrenField]

    return toChange({ before: newParent.clone(), after: newParent.clone() })
  })

  return shouldResolve
    ? awu(changes).map(change => resolveChangeElement(change, lookupFunc)).toArray()
    : changes
}

const CONDITION_SCHEMA = Joi.array().items(Joi.object({
  field: [Joi.string().required(), Joi.object().required()],
  value: Joi.optional(),
}).unknown(true)).required()

const CONDITION_SUBJECT_SCHEMA = Joi.array().items(Joi.object({
  subject: [Joi.string().required(), Joi.object().required()],
  value: Joi.optional(),
}).unknown(true)).required()

export const isConditions = createSchemeGuard<Condition[]>(CONDITION_SCHEMA, 'Found invalid values for conditions')
export const isSubjectConditions = createSchemeGuard<SubjectCondition[]>(CONDITION_SUBJECT_SCHEMA, 'Found invalid values for subject conditions')
export const conditionFieldValue = (
  condition: Condition | SubjectCondition, typeName: string
): string | ReferenceExpression => (
  TYPES_WITH_SUBJECT_CONDITIONS.includes(typeName)
    ? (condition as SubjectCondition).subject
    : (condition as Condition).field
)
export const isCorrectConditions = (value: unknown, typeName: string):
value is (Condition | SubjectCondition)[] => (
  TYPES_WITH_SUBJECT_CONDITIONS.includes(typeName)
    ? isSubjectConditions(value)
    : isConditions(value)
)

export const getBrandsForGuide = (
  elements: InstanceElement[],
  fetchConfig: ZendeskFetchConfig,
): InstanceElement[] => {
  const brandsRegexList = fetchConfig.guide?.brands ?? []
  return elements
    .filter(instance => instance.elemID.typeName === BRAND_TYPE_NAME)
    .filter(brandInstance => brandInstance.value.has_help_center)
    .filter(brandInstance => brandsRegexList.some(regex => new RegExp(regex).test(brandInstance.value.name)))
}

type CustomFieldOption = {
  // eslint-disable-next-line camelcase
  raw_name: string
  name?: string
}

const isCustomFieldOption = (value: Value): value is CustomFieldOption =>
  _.isPlainObject(value) && _.isString(value.raw_name)

export const getCustomFieldOptionsFromChanges = (parentTypeName: string, childTypeName: string, changes: Change[])
  : CustomFieldOption[] => {
  const relevantInstances = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => [parentTypeName, childTypeName].includes(instance.elemID.typeName))

  const [parentInstances, childrenInstances] = _.partition(
    relevantInstances,
    instance => instance.elemID.typeName === parentTypeName,
  )

  parentInstances.map(instance => instance.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] ?? []).forEach((options: Value[]) => {
    replaceTemplatesWithValues(
      { values: options, fieldName: 'raw_name' },
      // onDeploy this value will not exist, so we don't need the shared context
      {},
      prepRef,
    )
  })

  return childrenInstances.map(instance => instance.value)
    .concat(parentInstances.map(instance => instance.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] ?? []))
    .flat()
    .filter(isCustomFieldOption)
}
