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
import Joi from 'joi'
import { logger } from '@salto-io/logging'
import {
  InstanceElement,
  isInstanceElement,
  Values,
  getChangeData,
  Change,
  isInstanceChange,
} from '@salto-io/adapter-api'
import {
  transformElement,
  applyFunctionToChangeData,
  safeJsonStringify,
  createSchemeGuard,
  TransformFuncSync,
} from '@salto-io/adapter-utils'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import {
  elements as elementUtils,
  resolveValues,
  restoreChangeElement,
  restoreValues,
} from '@salto-io/adapter-components'
import {
  AUTOMATION_TYPE,
  AUTOMATION_COMPONENT_TYPE,
  AUTOMATION_COMPONENT_VALUE_TYPE,
  AUTOMATION_OPERATION,
} from '../../constants'
import { FilterCreator } from '../../filter'
import { getLookUpName } from '../../reference_mapping'

const { awu } = collections.asynciterable
const log = logger(module)
const { isDefined } = lowerDashValues

type LinkTypeObject = {
  linkType: string
  linkTypeDirection: string
}

type RawValueObject = {
  rawValue: string
}

type DeployableValueObject = {
  value: string
}

type CompareValueObject = {
  compareValue: {
    multiValue: boolean
    value: string
  }
}

type CompareFieldValueObject = {
  compareFieldValue: {
    multiValue: boolean
    value: string
    values?: string
    type: string
  }
}

type RuleScope = {
  resources: string[]
}

const LINK_TYPE_SCHEME = Joi.object({
  linkType: Joi.string().required(),
  linkTypeDirection: Joi.string().required(),
})
  .unknown(true)
  .required()

const RAW_VALUE_SCHEME = Joi.object({
  rawValue: Joi.string().required().allow(''),
})
  .unknown(true)
  .required()

const COMPARE_FIELD_VALUE_SCHEME = Joi.object({
  compareFieldValue: Joi.object({
    multiValue: Joi.boolean().required(),
    value: Joi.string(),
    values: Joi.array().items(Joi.string()),
    type: Joi.string(),
  })
    .unknown(true)
    .required(),
})
  .unknown(true)
  .required()

const RULE_SCOPE_SCHEME = Joi.object({
  resources: Joi.array().items(Joi.string()).required(),
})
  .unknown(true)
  .required()

const isLinkTypeObject = (value: unknown): value is LinkTypeObject => {
  const { error } = LINK_TYPE_SCHEME.validate(value)
  return error === undefined
}

const isRawValueObject = (value: unknown): value is RawValueObject => {
  const { error } = RAW_VALUE_SCHEME.validate(value)
  return error === undefined
}

const isCompareFieldValueObject = (value: unknown): value is CompareFieldValueObject => {
  const { error } = COMPARE_FIELD_VALUE_SCHEME.validate(value)
  return error === undefined
}

const isRuleScope = createSchemeGuard<RuleScope>(RULE_SCOPE_SCHEME, 'Wrong rule scope')

const KEYS_TO_REMOVE = ['clientKey', 'updated', 'parentId', 'ruleScope', 'conditionParentId']

const PROJECT_SCOPE_REGEX = /ari:cloud:jira:.+:project\/(.+)/
const PROJECT_TYPE_SCOPE_REGEX = /ari:cloud:(jira-.+)::site\/.+/
const GLOBAL_SCOPE_REGEX = /ari:cloud:jira::site\/.+/

export const PROJECT_TYPE_TO_RESOURCE_TYPE: Record<string, string> = {
  software: 'jira-software',
  service_desk: 'jira-servicedesk',
  business: 'jira-core',
}

const findKeyInRecordObject = (obj: Record<string, string>, value: string): string | undefined =>
  Object.entries(obj).find(([_key, val]) => val === value)?.[0]

const removeRedundantKeys: TransformFuncSync = ({ value, path }) =>
  KEYS_TO_REMOVE.includes(path !== undefined ? path.name : '') ? undefined : value

const removeInnerIds: TransformFuncSync = ({ value, path }) =>
  // We want to remove all the ids besides the id in the of the automation itself
  // and ids inside component values
  path !== undefined &&
  path.name === 'id' &&
  !path.getFullNameParts().includes('value') &&
  !path.createParentID().isTopLevel()
    ? undefined
    : value

const replaceStringValuesFieldName: TransformFuncSync = ({ value, field }) => {
  const typeName = field?.getTypeSync()?.elemID.typeName
  if (
    _.isPlainObject(value) &&
    (typeName === AUTOMATION_COMPONENT_TYPE || typeName === AUTOMATION_OPERATION) &&
    _.isString(value.value)
  ) {
    value.rawValue = value.value
    delete value.value
  }
  return value
}

// linkType field is a string containing a reference to IssueLinkType and the link direction
// for example: linkType = 'inward:10025'
// we separate the field in order to resolve the reference
const separateLinkTypeField: TransformFuncSync = ({ value, path }) => {
  if (_.isPlainObject(value) && path?.name === 'value' && _.isString(value.linkType)) {
    const [linkTypeDirection, linkTypeId] = _.split(value.linkType, ':')
    if (linkTypeDirection !== undefined && linkTypeId !== undefined) {
      value.linkType = linkTypeId
      value.linkTypeDirection = linkTypeDirection
    }
  }
  return value
}

const convertToCompareFieldValue: TransformFuncSync = ({ value, path, field }) => {
  if (
    path?.name === 'value' &&
    field?.getTypeSync()?.elemID.typeName === AUTOMATION_COMPONENT_VALUE_TYPE &&
    _.isPlainObject(value?.compareValue)
  ) {
    // compareValue can be either an object or a primitive type
    // we change the field name to compareFieldValue to distinguish between the cases
    value.compareFieldValue = value.compareValue
    delete value.compareValue
    if (value.compareFieldValue.multiValue) {
      // compareFieldValue.value contains multiple references
      try {
        value.compareFieldValue.values = JSON.parse(value.compareFieldValue.value)
        delete value.compareFieldValue.value
      } catch (err) {
        log.error(
          `Failed to parse JSON string in path: ${path.createNestedID('compareFieldValue', 'value').getFullName()}`,
        )
      }
    }
  }
  return value
}

const consolidateLinkTypeFields: TransformFuncSync = ({ value, path }) => {
  if (path?.name === 'value' && isLinkTypeObject(value)) {
    value.linkType = value.linkTypeDirection.concat(':', value.linkType)
    return _.omit(value, 'linkTypeDirection')
  }
  return value
}

const changeRawValueFieldsToValue: TransformFuncSync = ({ value, field }) => {
  const typeName = field?.getTypeSync()?.elemID.typeName
  if (isRawValueObject(value) && (typeName === AUTOMATION_COMPONENT_TYPE || typeName === AUTOMATION_OPERATION)) {
    const { rawValue } = value
    const deployableObject: DeployableValueObject = _.omit({ ...value, value: rawValue }, 'rawValue')
    return deployableObject
  }
  return value
}

// For components with type = "jira.issue.hasAttachments"
// Value is a boolean, but component.value is an object in the objectType
// So we transform the value to hasAttachmentsValue and vice versa
const createTransformHasAttachmentValueFunc =
  (reverse?: boolean): TransformFuncSync =>
  ({ value }) => {
    if (
      value?.type === 'jira.issue.hasAttachments' &&
      value?.component &&
      _.isBoolean(reverse ? value.hasAttachmentsValue : value.value)
    ) {
      if (reverse) {
        value.value = value.hasAttachmentsValue
        delete value.hasAttachmentsValue
      } else {
        value.hasAttachmentsValue = value.value
        delete value.value
      }
    }
    return value
  }

const revertCompareFieldValueStructure: TransformFuncSync = ({ value, field }) => {
  if (isCompareFieldValueObject(value) && field?.getTypeSync()?.elemID.typeName === AUTOMATION_COMPONENT_VALUE_TYPE) {
    const { compareFieldValue } = value
    if (compareFieldValue.multiValue) {
      compareFieldValue.value = safeJsonStringify(compareFieldValue.values)
      delete compareFieldValue.values
    }
    const deployableObject: CompareValueObject = _.omit(
      { ...value, compareValue: compareFieldValue },
      'compareFieldValue',
    )
    return deployableObject
  }
  return value
}

const getScope = (resource: string): { projectId?: string; projectTypeKey?: string } | 'GLOBAL' | undefined => {
  const projectScope = resource.match(PROJECT_SCOPE_REGEX)
  if (projectScope) {
    return { projectId: projectScope[1] }
  }
  const projectTypeScope = resource.match(PROJECT_TYPE_SCOPE_REGEX)
  if (projectTypeScope) {
    const projectTypeKey = findKeyInRecordObject(PROJECT_TYPE_TO_RESOURCE_TYPE, projectTypeScope[1])
    if (projectTypeKey === undefined) {
      log.error(`Failed to convert automation project type: ${projectTypeScope[1]}`)
    }
    return { projectTypeKey }
  }
  if (resource.match(GLOBAL_SCOPE_REGEX)) {
    return 'GLOBAL'
  }
  log.error(`Failed to convert automation rule scope, found unknown pattern: ${resource}`)
  return undefined
}

export const convertRuleScopeValueToProjects = (
  values: Values,
):
  | {
      projectId?: string
      projectTypeKey?: string
    }[]
  | undefined => {
  const { ruleScope } = values
  if (!isRuleScope(ruleScope)) {
    return undefined
  }
  const rules = ruleScope.resources.map(getScope).filter(isDefined)

  const [globalRules, nonGlobalRules] = _.partition(rules, (rule): rule is 'GLOBAL' => rule === 'GLOBAL')

  if (globalRules.length > 0) {
    return undefined
  }

  return nonGlobalRules
}

const convertRuleScopeToProjects = (instance: InstanceElement): void => {
  instance.value.projects = convertRuleScopeValueToProjects(instance.value)
}

const removeProjectsForGlobalDCAutomation = (instance: InstanceElement): void => {
  if (instance.value.projects.length === 0) {
    instance.value.projects = undefined
  }
}

// When component type is "jira.issue.delete.link"
// linkTypes field is returned from the service as a list of objects,
// Since linkTypes is a string array in component objectType, we change the field name to deleteLinkTypes
const createTransformDeleteLinkTypesFunc =
  (reverse?: boolean): TransformFuncSync =>
  ({ value }) => {
    if (value?.type === 'jira.issue.delete.link' && value?.component) {
      if (reverse) {
        value.value.linkTypes = value.value?.deleteLinkTypes
        delete value.value.deleteLinkTypes
      } else {
        value.value.deleteLinkTypes = value.value?.linkTypes
        delete value.value.linkTypes
      }
    }
    return value
  }

const createAutomationTransformFunc =
  (transformFuncs: TransformFuncSync[]): TransformFuncSync =>
  ({ value, ...args }) => {
    const newValue = transformFuncs.reduce((currentVal, func) => {
      const updatedValue = func({ value: currentVal, ...args })
      return updatedValue
    }, value)
    return newValue
  }

const filter: FilterCreator = ({ client }) => {
  let originalAutomationChanges: Record<string, Change<InstanceElement>>
  return {
    name: 'automationStructureFilter',
    onFetch: async elements =>
      awu(elements)
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
        .forEach(async instance => {
          if (client.isDataCenter) {
            removeProjectsForGlobalDCAutomation(instance)
          } else {
            convertRuleScopeToProjects(instance)
          }
          const automationTransformFunc = createAutomationTransformFunc([
            elementUtils.removeNullValuesTransformFunc,
            removeRedundantKeys,
            removeInnerIds,
            separateLinkTypeField,
            replaceStringValuesFieldName,
            convertToCompareFieldValue,
            createTransformDeleteLinkTypesFunc(),
            createTransformHasAttachmentValueFunc(),
          ])
          instance.value = (
            await transformElement({
              element: instance,
              strict: false,
              allowEmpty: true,
              transformFunc: automationTransformFunc,
            })
          ).value

          instance.value.projects = instance.value.projects?.map(({ projectId, projectTypeKey }: Values) =>
            projectId !== undefined ? { projectId } : { projectTypeKey },
          )
        }),

    preDeploy: async changes => {
      originalAutomationChanges = Object.fromEntries(
        changes
          .filter(isInstanceChange)
          .filter(change => getChangeData(change).elemID.typeName === AUTOMATION_TYPE)
          .map(change => [getChangeData(change).elemID.getFullName(), _.cloneDeep(change)]),
      )

      await awu(changes)
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === AUTOMATION_TYPE)
        .forEach(async change =>
          applyFunctionToChangeData<Change<InstanceElement>>(change, async instance => {
            const resolvedInstance = await resolveValues(instance, getLookUpName, undefined, true)
            const automationTransformFunc = createAutomationTransformFunc([
              consolidateLinkTypeFields,
              changeRawValueFieldsToValue,
              revertCompareFieldValueStructure,
              createTransformDeleteLinkTypesFunc(true),
              createTransformHasAttachmentValueFunc(true),
            ])
            instance.value = (
              await transformElement({
                element: resolvedInstance,
                strict: false,
                allowEmpty: true,
                transformFunc: automationTransformFunc,
              })
            ).value
            return instance
          }),
        )
    },

    onDeploy: async changes => {
      await awu(changes)
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === AUTOMATION_TYPE)
        .forEach(async change => {
          await applyFunctionToChangeData<Change<InstanceElement>>(change, async instance => {
            const automationTransformFunc = createAutomationTransformFunc([
              replaceStringValuesFieldName,
              separateLinkTypeField,
              convertToCompareFieldValue,
              createTransformDeleteLinkTypesFunc(),
              createTransformHasAttachmentValueFunc(),
            ])
            instance.value = (
              await transformElement({
                element: instance,
                strict: false,
                allowEmpty: true,
                transformFunc: automationTransformFunc,
              })
            ).value
            return instance
          })
        })

      const automationChanges = changes
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === AUTOMATION_TYPE)

      const automationChangesToReturn = await awu(automationChanges)
        .map(async change =>
          restoreChangeElement(
            change,
            originalAutomationChanges,
            getLookUpName,
            (source, targetElement, lookUpNameFunc) => restoreValues(source, targetElement, lookUpNameFunc),
          ),
        )
        .toArray()
      _.pullAll(changes, automationChanges)
      changes.push(...automationChangesToReturn)
    },
  }
}

export default filter
