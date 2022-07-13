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
import { InstanceElement, isInstanceElement, Values, getChangeData,
  Change, isInstanceChange } from '@salto-io/adapter-api'
import { transformElement, applyFunctionToChangeData, resolveValues } from '@salto-io/adapter-utils'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { AUTOMATION_TYPE, AUTOMATION_COMPONENT_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { getLookUpName } from '../../reference_mapping'

const { awu } = collections.asynciterable

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
      if (_.isPlainObject(value)
      && (await field?.getType())?.elemID.typeName === AUTOMATION_COMPONENT_TYPE
      && _.isString(value.value)) {
        value.rawValue = value.value
        value.value = undefined
      }
      return value
    },
  })).value
}

// linkType field is a string containing a reference to IssueLinkType and the link direction
// we separate the field in order to resolve the reference
const separateLinkTypeField = async (instance: InstanceElement): Promise<void> => {
  instance.value = (await transformElement({
    element: instance,
    strict: false,
    allowEmpty: true,
    transformFunc: async ({ value, path }) => {
      if (_.isPlainObject(value)
      && path?.name === 'value' && _.isString(value.linkType)) {
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
      if (_.isPlainObject(value) && path?.name === 'value'
      && value.linkType !== undefined && value.linkTypeDirection !== undefined) {
        value.linkType = value.linkTypeDirection.concat(':', value.linkType)
        // maybe change to undefined
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
      if (_.isPlainObject(value)
      && (await field?.getType())?.elemID.typeName === AUTOMATION_COMPONENT_TYPE
      && value.value === undefined && _.isString(value.rawValue)) {
        value.value = value.rawValue
        delete value.rawValue
      }
      return value
    },
  })).value
}


const filter: FilterCreator = () => {
  let originalAutomationChanges: Change<InstanceElement>[]
  let deployableAutomationChanges: Change<InstanceElement>[]
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
      originalAutomationChanges = changes
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === AUTOMATION_TYPE)

      deployableAutomationChanges = await awu(originalAutomationChanges)
        .map(async change =>
          applyFunctionToChangeData<Change<InstanceElement>>(
            change,
            async instance => {
              const resolvedInstance = await resolveValues(instance, getLookUpName)
              await consolidateLinkTypeFields(resolvedInstance)
              await changeRawValueFieldsToValue(resolvedInstance)
              return resolvedInstance
            }
          ))
        .toArray()

      _.pullAll(changes, originalAutomationChanges)
      changes.push(...deployableAutomationChanges)
    },

    onDeploy: async changes => {
      _.pullAll(changes, deployableAutomationChanges)
      changes.push(...originalAutomationChanges)
    },
  }
}

export default filter
