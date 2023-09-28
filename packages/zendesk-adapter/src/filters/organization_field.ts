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
import {
  Change,
  getChangeData,
  InstanceElement,
} from '@salto-io/adapter-api'
import { replaceTemplatesWithValues } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { addIdsToChildrenUponAddition, deployChange, deployChanges } from '../deployment'
import { API_DEFINITIONS_CONFIG } from '../config'
import { createAdditionalParentChanges, getCustomFieldOptionsFromChanges } from './utils'
import { CUSTOM_FIELD_OPTIONS_FIELD_NAME, ORG_FIELD_TYPE_NAME } from '../constants'
import { prepRef } from './handle_template_expressions'

export const ORG_FIELD_OPTION_TYPE_NAME = 'organization_field__custom_field_options'

const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'organizationFieldFilter',
  preDeploy: async changes => {
    getCustomFieldOptionsFromChanges(ORG_FIELD_TYPE_NAME, ORG_FIELD_OPTION_TYPE_NAME, changes).forEach(option => {
      option.name = option.raw_name
    })
  },
  onDeploy: async changes => {
    getCustomFieldOptionsFromChanges(ORG_FIELD_TYPE_NAME, ORG_FIELD_OPTION_TYPE_NAME, changes).forEach(option => {
      delete option.name
    })
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => [ORG_FIELD_TYPE_NAME, ORG_FIELD_OPTION_TYPE_NAME]
        .includes(getChangeData(change).elemID.typeName),
    )
    const [parentChanges, childrenChanges] = _.partition(
      relevantChanges,
      change => getChangeData(change).elemID.typeName === ORG_FIELD_TYPE_NAME,
    )
    const additionalParentChanges = parentChanges.length === 0 && childrenChanges.length > 0
      ? await createAdditionalParentChanges(childrenChanges)
      : []
    if (additionalParentChanges === undefined) {
      return {
        deployResult: {
          appliedChanges: [],
          errors: childrenChanges
            .map(getChangeData)
            .map(e => ({
              message: `Failed to update ${e.elemID.getFullName()} since it has no valid parent`,
              severity: 'Error',
              elemID: e.elemID,
            })),
        },
        leftoverChanges,
      }
    }

    // Because this is a fake change, it did not pass preDeploy and the templateExpressions were not converted to values
    additionalParentChanges.forEach(change => {
      const customFieldOptions = getChangeData(change).value[CUSTOM_FIELD_OPTIONS_FIELD_NAME]
      if (_.isArray(customFieldOptions)) {
        // These are fake changes which do not show in appliedChanges
        // so we don't need to worry about reverting to templates later on
        replaceTemplatesWithValues(
          { values: customFieldOptions, fieldName: 'raw_name' },
          {},
          prepRef,
        )
      }
    })

    const deployResult = await deployChanges(
      [...parentChanges, ...additionalParentChanges],
      async change => {
        const response = await deployChange(
          change, client, config.apiDefinitions
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

    const additionalParentIds = new Set(
      additionalParentChanges.map(getChangeData).map(e => e.elemID.getFullName())
    )
    return {
      deployResult: {
        errors: deployResult.errors,
        appliedChanges: deployResult.appliedChanges
          .filter(change => !additionalParentIds.has(getChangeData(change).elemID.getFullName())),
      },
      leftoverChanges,
    }
  },
})

export default filterCreator
