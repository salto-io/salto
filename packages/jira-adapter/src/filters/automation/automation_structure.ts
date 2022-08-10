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
import Joi from 'joi'
import { InstanceElement, isInstanceElement, Values, getChangeData,
  Change, isInstanceChange } from '@salto-io/adapter-api'
import { transformElement, applyFunctionToChangeData, resolveValues, restoreChangeElement } from '@salto-io/adapter-utils'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { AUTOMATION_TYPE, AUTOMATION_COMPONENT_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { getLookUpName } from '../../reference_mapping'

const { awu } = collections.asynciterable

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

const LINK_TYPE_SCHEME = Joi.object({
  linkType: Joi.string().required(),
  linkTypeDirection: Joi.string().required(),
}).unknown(true).required()

const RAW_VALUE_SCHEME = Joi.object({
  rawValue: Joi.string().required(),
}).unknown(true).required()

const isLinkTypeObject = (value: unknown): value is LinkTypeObject => {
  const { error } = LINK_TYPE_SCHEME.validate(value)
  return error === undefined
}

const isRawValueObject = (value: unknown): value is RawValueObject => {
  const { error } = RAW_VALUE_SCHEME.validate(value)
  return error === undefined
}

const KEYS_TO_REMOVE = [
  'clientKey',
  'updated',
  'parentId',
  'ruleScope',
  'conditionParentId',
]

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
      path !== undefined && path.name === 'id' && !path.createParentID().isTopLevel()
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
      if (
        _.isPlainObject(value)
        && (await field?.getType())?.elemID.typeName === AUTOMATION_COMPONENT_TYPE
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
        delete value.linkTypeDirection
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
      if (
        isRawValueObject(value)
        && (await field?.getType())?.elemID.typeName === AUTOMATION_COMPONENT_TYPE
      ) {
        const { rawValue } = value
        const deployableObject: DeployableValueObject = _.omit({ ...value, value: rawValue }, 'rawValue')
        return deployableObject
      }
      return value
    },
  })).value
}


const filter: FilterCreator = () => {
  let originalAutomationChanges: Record<string, Change<InstanceElement>>
  return {
    onFetch: async elements =>
      awu(elements)
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
        .forEach(async instance => {
          instance.value = await elementUtils.removeNullValues(
            instance.value,
            await instance.getType()
          )
          await removeRedundantKeys(instance)
          await removeInnerIds(instance)
          await replaceStringValuesFieldName(instance)
          await separateLinkTypeField(instance)

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
              const resolvedInstance = await resolveValues(instance, getLookUpName)
              await consolidateLinkTypeFields(resolvedInstance)
              await changeRawValueFieldsToValue(resolvedInstance)
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
              return instance
            }
          )
        })

      const automationChanges = changes
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === AUTOMATION_TYPE)

      const automationChangesToReturn = await awu(automationChanges)
        .map(async change => restoreChangeElement(change, originalAutomationChanges, getLookUpName))
        .toArray()
      _.pullAll(changes, automationChanges)
      changes.push(...automationChangesToReturn)
    },
  }
}

export default filter
