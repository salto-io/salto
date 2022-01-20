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
import {
  Change, getChangeData, InstanceElement, isAdditionChange, isInstanceElement,
  Values, Element, isObjectType, Field, BuiltinTypes, ReferenceExpression,
} from '@salto-io/adapter-api'
import { deployment, client as clientUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { getParents } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { addIdUponAddition, deployChange, deployChanges } from '../../deployment'
import { applyforInstanceChangesOfType } from '../utils'
import { API_DEFINITIONS_CONFIG, ZendeskApiConfig } from '../../config'

export const CUSTOM_FIELD_OPTIONS_FIELD_NAME = 'custom_field_options'
export const DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME = 'default_custom_field_option'

type CustomFieldOptionsFilterCreatorParams = {
  parentTypeName: string
  childTypeName: string
}

const log = logger(module)
const { makeArray } = collections.array

const getMatchedCustomFieldOption = (
  change: Change<InstanceElement>,
  response: clientUtils.ResponseValue,
  dataField?: string,
): clientUtils.ResponseValue | undefined => {
  const customFieldOptionsResponse = ((
    dataField !== undefined
      ? response[dataField]
      : response
    ) as Values)?.[CUSTOM_FIELD_OPTIONS_FIELD_NAME]
  if (customFieldOptionsResponse) {
    if (_.isArray(customFieldOptionsResponse)
    && customFieldOptionsResponse.every(_.isPlainObject)) {
      return customFieldOptionsResponse.find(
        option => option.value && option.value === getChangeData(change).value.value
      )
    }
    log.warn(`Received invalid response for custom_field_options in ${getChangeData(change).elemID.getFullName()}`)
  }
  return undefined
}
const addIdsToChildrenUponAddition = (
  response: deployment.ResponseResult,
  parentChange: Change<InstanceElement>,
  childrenChanges: Change<InstanceElement>[],
  apiDefinitions: ZendeskApiConfig
): Change<InstanceElement>[] => {
  const { deployRequests } = apiDefinitions
    .types[getChangeData(parentChange).elemID.typeName]
  childrenChanges
    .filter(isAdditionChange)
    .forEach(change => {
      if (response && !_.isArray(response)) {
        const dataField = deployRequests?.add?.deployAsField
        const option = getMatchedCustomFieldOption(change, response, dataField)
        if (option) {
          addIdUponAddition(change, apiDefinitions, option)
        }
      }
    })
  return [parentChange, ...childrenChanges]
}

export const createCustomFieldOptionsFilterCreator = (
  { parentTypeName, childTypeName }: CustomFieldOptionsFilterCreatorParams
): FilterCreator => ({ config, client }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const parentType = elements
      .filter(isObjectType)
      .find(inst => inst.elemID.typeName === parentTypeName)
    if (parentType === undefined) {
      return
    }
    parentType.fields[DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME] = new Field(
      parentType,
      DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME,
      BuiltinTypes.STRING,
    )
    const parentInstances = elements
      .filter(isInstanceElement)
      .filter(inst => inst.elemID.typeName === parentTypeName)
      .filter(inst => inst.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] !== undefined)
    const parentIdToChildInstances = _(elements)
      .filter(isInstanceElement)
      .filter(inst => inst.elemID.typeName === childTypeName)
      .filter(childInst => getParents(childInst)?.[0] !== undefined)
      .groupBy(childInst => getParents(childInst)[0].value.value.id)
      .value()
    parentInstances.forEach(inst => {
      const options = parentIdToChildInstances[inst.value.id] ?? []
      const defaultOption = options.find(option => option?.value?.default === true)
      if (defaultOption) {
        inst.value[DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME] = new ReferenceExpression(
          defaultOption.elemID,
          defaultOption,
        )
      }
      options.forEach(option => {
        delete option.value.default
      })
    })
  },
  preDeploy: async changes => {
    await applyforInstanceChangesOfType(
      changes,
      parentTypeName,
      (instance: InstanceElement) => {
        const defaultValue = instance.value[DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME]
        makeArray(instance.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME])
          .forEach(option => {
            option.default = (defaultValue !== undefined) && (option.value === defaultValue)
          })
        return instance
      }
    )
  },
  onDeploy: async changes => {
    await applyforInstanceChangesOfType(
      changes,
      parentTypeName,
      (instance: InstanceElement) => {
        const options = makeArray(instance.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME])
        if (options) {
          options.forEach(option => {
            delete option.default
          })
        }
        return instance
      }
    )
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => [parentTypeName, childTypeName]
        .includes(getChangeData(change).elemID.typeName),
    )
    const [parentChanges, childrenChanges] = _.partition(
      relevantChanges,
      change => getChangeData(change).elemID.typeName === parentTypeName,
    )
    if (parentChanges.length === 0) {
      const deployResult = await deployChanges(
        childrenChanges,
        async change => {
          await deployChange(change, client, config.apiDefinitions)
        }
      )
      return { deployResult, leftoverChanges }
    }
    const deployResult = await deployChanges(
      parentChanges,
      async change => {
        const response = await deployChange(
          change, client, config.apiDefinitions, [DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME]
        )
        return addIdsToChildrenUponAddition(
          response, change, childrenChanges, config[API_DEFINITIONS_CONFIG]
        )
      }
    )
    return { deployResult, leftoverChanges }
  },
})
