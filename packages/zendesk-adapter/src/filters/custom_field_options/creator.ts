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
  Change, getChangeData, InstanceElement, isInstanceElement, Element,
  isObjectType, Field, BuiltinTypes, ReferenceExpression, isRemovalChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { getParents } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { addIdsToChildrenUponAddition, deployChange, deployChanges, deployChangesByGroups } from '../../deployment'
import { applyforInstanceChangesOfType } from '../utils'
import { API_DEFINITIONS_CONFIG } from '../../config'

export const CUSTOM_FIELD_OPTIONS_FIELD_NAME = 'custom_field_options'
export const DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME = 'default_custom_field_option'

type CustomFieldOptionsFilterCreatorParams = {
  parentTypeName: string
  childTypeName: string
}

const { makeArray } = collections.array

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
      [parentTypeName],
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
      [parentTypeName],
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
      // The service does not allow us to have a field with no options - therefore, we need to do
      //  the removal changes last
      const [removalChanges, nonRemovalChanges] = _.partition(childrenChanges, isRemovalChange)
      const deployResult = await deployChangesByGroups(
        [nonRemovalChanges, removalChanges] as Change<InstanceElement>[][],
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
        return addIdsToChildrenUponAddition({
          response,
          parentChange: change,
          childrenChanges,
          apiDefinitions: config[API_DEFINITIONS_CONFIG],
          childFieldName: CUSTOM_FIELD_OPTIONS_FIELD_NAME,
          childUniqueFieldName: 'value',
        })
      }
    )
    return { deployResult, leftoverChanges }
  },
})
