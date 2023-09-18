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
import { logger } from '@salto-io/logging'
import { InstanceElement, isInstanceElement, Values, getChangeData,
  Change, isInstanceChange } from '@salto-io/adapter-api'
import { transformElement, applyFunctionToChangeData, resolveValues, restoreChangeElement, safeJsonStringify, restoreValues, createSchemeGuard } from '@salto-io/adapter-utils'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { AUTOMATION_TYPE, AUTOMATION_COMPONENT_TYPE, AUTOMATION_COMPONENT_VALUE_TYPE, AUTOMATION_OPERATION } from '../../constants'
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
}).unknown(true).required()

const RAW_VALUE_SCHEME = Joi.object({
  rawValue: Joi.string().required().allow(''),
}).unknown(true).required()

const COMPARE_FIELD_VALUE_SCHEME = Joi.object({
  compareFieldValue: Joi.object({
    multiValue: Joi.boolean().required(),
    value: Joi.string(),
    values: Joi.array().items(Joi.string()),
    type: Joi.string(),
  }).unknown(true).required(),
}).unknown(true).required()

const RULE_SCOPE_SCHEME = Joi.object({
  resources: Joi.array().items(Joi.string()).required(),
}).unknown(true).required()

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

const KEYS_TO_REMOVE = [
  'clientKey',
  'updated',
  'parentId',
  'ruleScope',
  'conditionParentId',
]

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

const removeRedundantKeys = async (instance: InstanceElement): Promise<void> => {
  instance.value = (await transformElement({
    element: instance,
    strict: false,
    allowEmpty: true,
    transformFunc: async ({ value, path }) => (
      KEYS_TO_REMOVE.includes(path !== undefined ? path.name : '')
        ? undefined
        : value
    ),
  })).value
}

const removeInnerIds = async (instance: InstanceElement): Promise<void> => {
  instance.value = (await transformElement({
    element: instance,
    strict: false,
    allowEmpty: true,
    transformFunc: async ({ value, path }) => (
      // We want to remove all the ids besides the id in the of the automation itself
      // and ids inside component values
      path !== undefined
        && path.name === 'id'
        && !path.getFullNameParts().includes('value')
        && !path.createParentID().isTopLevel()
        ? undefined
        : value
    ),
  })).value
}

const replaceStringValuesFieldName = async (instance: InstanceElement): Promise<void> => {
  instance.value = (await transformElement({
    element: instance,
    strict: false,
    allowEmpty: true,
    transformFunc: async ({ value, field }) => {
      const typeName = (await field?.getType())?.elemID.typeName
      if (
        _.isPlainObject(value)
        && (typeName === AUTOMATION_COMPONENT_TYPE || typeName === AUTOMATION_OPERATION)
        && _.isString(value.value)
      ) {
        value.rawValue = value.value
        delete value.value
      }
      return value
    },
  })).value
}

// linkType field is a string containing a reference to IssueLinkType and the link direction
// for example: linkType = 'inward:10025'
// we separate the field in order to resolve the reference
const separateLinkTypeField = async (instance: InstanceElement): Promise<void> => {
  instance.value = (await transformElement({
    element: instance,
    strict: false,
    allowEmpty: true,
    transformFunc: async ({ value, path }) => {
      if (
        _.isPlainObject(value)
        && path?.name === 'value'
        && _.isString(value.linkType)
      ) {
        const [linkTypeDirection, linkTypeId] = _.split(value.linkType, ':')
        if (linkTypeDirection !== undefined && linkTypeId !== undefined) {
          value.linkType = linkTypeId
          value.linkTypeDirection = linkTypeDirection
        }
      }
      return value
    },
  })).value
}

const convertToCompareFieldValue = async (instance: InstanceElement): Promise<void> => {
  instance.value = (await transformElement({
    element: instance,
    strict: false,
    allowEmpty: true,
    transformFunc: async ({ value, path, field }) => {
      if (
        path?.name === 'value'
        && (await field?.getType())?.elemID.typeName === AUTOMATION_COMPONENT_VALUE_TYPE
        && _.isPlainObject(value?.compareValue)
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
            log.error(`Failed to parse JSON string in path: ${path.createNestedID('compareFieldValue', 'value').getFullName()}`)
          }
        }
      }
      return value
    },
  })).value
}

const consolidateLinkTypeFields = async (instance: InstanceElement): Promise<void> => {
  instance.value = (await transformElement({
    element: instance,
    strict: false,
    allowEmpty: true,
    transformFunc: async ({ value, path }) => {
      if (
        path?.name === 'value'
        && isLinkTypeObject(value)
      ) {
        value.linkType = value.linkTypeDirection.concat(':', value.linkType)
        return _.omit(value, 'linkTypeDirection')
      }
      return value
    },
  })).value
}

const changeRawValueFieldsToValue = async (instance: InstanceElement): Promise<void> => {
  instance.value = (await transformElement({
    element: instance,
    strict: false,
    allowEmpty: true,
    transformFunc: async ({ value, field }) => {
      const typeName = (await field?.getType())?.elemID.typeName
      if (
        isRawValueObject(value)
        && (typeName === AUTOMATION_COMPONENT_TYPE || typeName === AUTOMATION_OPERATION)
      ) {
        const { rawValue } = value
        const deployableObject: DeployableValueObject = _.omit({ ...value, value: rawValue }, 'rawValue')
        return deployableObject
      }
      return value
    },
  })).value
}

const revertCompareFieldValueStructure = async (instance: InstanceElement): Promise<void> => {
  instance.value = (await transformElement({
    element: instance,
    strict: false,
    allowEmpty: true,
    transformFunc: async ({ value, field }) => {
      if (
        isCompareFieldValueObject(value)
        && (await field?.getType())?.elemID.typeName === AUTOMATION_COMPONENT_VALUE_TYPE
      ) {
        const { compareFieldValue } = value
        if (compareFieldValue.multiValue) {
          compareFieldValue.value = safeJsonStringify(compareFieldValue.values)
          delete compareFieldValue.values
        }
        const deployableObject: CompareValueObject = _.omit({ ...value, compareValue: compareFieldValue }, 'compareFieldValue')
        return deployableObject
      }
      return value
    },
  })).value
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

export const convertRuleScopeValueToProjects = (values: Values): {
  projectId?: string
  projectTypeKey?: string
}[] | undefined => {
  const { ruleScope } = values
  if (!isRuleScope(ruleScope)) {
    return undefined
  }
  const rules = ruleScope.resources
    .map(getScope)
    .filter(isDefined)

  const [globalRules, nonGlobalRules] = _.partition(rules, (rule): rule is 'GLOBAL' => rule === 'GLOBAL')

  if (globalRules.length > 0) {
    return undefined
  }

  return nonGlobalRules
}


const convertRuleScopeToProjects = (instance: InstanceElement): void => {
  instance.value.projects = convertRuleScopeValueToProjects(instance.value)
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
          instance.value = await elementUtils.removeNullValues(
            instance.value,
            await instance.getType(),
            true,
          )
          if (!client.isDataCenter) {
            convertRuleScopeToProjects(instance)
          }
          await removeRedundantKeys(instance)
          await removeInnerIds(instance)
          await replaceStringValuesFieldName(instance)
          await separateLinkTypeField(instance)
          await convertToCompareFieldValue(instance)

          instance.value.projects = instance.value.projects
            ?.map(
              ({ projectId, projectTypeKey }: Values) => (
                projectId !== undefined
                  ? { projectId }
                  : { projectTypeKey })
            )
        }),

    preDeploy: async changes => {
      originalAutomationChanges = Object.fromEntries(changes
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === AUTOMATION_TYPE)
        .map(change => [getChangeData(change).elemID.getFullName(), _.cloneDeep(change)]))

      await awu(changes)
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === AUTOMATION_TYPE)
        .forEach(async change =>
          applyFunctionToChangeData<Change<InstanceElement>>(
            change,
            async instance => {
              const resolvedInstance = await resolveValues(instance, getLookUpName, undefined, true)
              await consolidateLinkTypeFields(resolvedInstance)
              await changeRawValueFieldsToValue(resolvedInstance)
              await revertCompareFieldValueStructure(resolvedInstance)
              instance.value = resolvedInstance.value
              return instance
            }
          ))
    },

    onDeploy: async changes => {
      await awu(changes)
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === AUTOMATION_TYPE)
        .forEach(async change => {
          await applyFunctionToChangeData<Change<InstanceElement>>(
            change,
            async instance => {
              await replaceStringValuesFieldName(instance)
              await separateLinkTypeField(instance)
              await convertToCompareFieldValue(instance)
              return instance
            }
          )
        })

      const automationChanges = changes
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === AUTOMATION_TYPE)

      const automationChangesToReturn = await awu(automationChanges)
        .map(async change => restoreChangeElement(
          change,
          originalAutomationChanges,
          getLookUpName,
          (source, targetElement, lookUpNameFunc) => restoreValues(
            source,
            targetElement,
            lookUpNameFunc,
          )
        ))
        .toArray()
      _.pullAll(changes, automationChanges)
      changes.push(...automationChangesToReturn)
    },
  }
}

export default filter
