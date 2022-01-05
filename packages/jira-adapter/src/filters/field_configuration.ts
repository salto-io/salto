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
import { Change, CORE_ANNOTATIONS, getChangeData, InstanceElement, isInstanceChange, isObjectType, isReferenceExpression, isRemovalChange, Values } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { defaultDeployChange, deployChanges } from '../deployment'
import { FilterCreator } from '../filter'

const FIELD_CONFIGURATION_TYPE_NAME = 'FieldConfiguration'
const FIELD_CONFIGURATION_ITEM_TYPE_NAME = 'FieldConfigurationItem'

const log = logger(module)

// Jira does not allow more items in a single request than this
const MAX_ITEMS_IN_REQUEST = 100

const deployFieldConfigurationItems = async (
  change: Change<InstanceElement>,
  client: clientUtils.HTTPWriteClientInterface,
): Promise<void> => {
  const instance = getChangeData(change)
  const fields = (instance.value.fields ?? [])
    .filter((fieldConf: Values) => isReferenceExpression(fieldConf.id))
    .filter((fieldConf: Values) => !fieldConf.id.value.value.isLocked)
    .map((fieldConf: Values) => ({ ...fieldConf, id: fieldConf.id.value.value.id }))

  if (fields.length === 0) {
    return
  }

  await Promise.all(
    _.chunk(fields, MAX_ITEMS_IN_REQUEST).map(async fieldsChunk =>
      client.put({
        url: `/rest/api/3/fieldconfiguration/${instance.value.id}/fields`,
        data: {
          fieldConfigurationItems: fieldsChunk,
        },
      }))
  )
}

const filter: FilterCreator = ({ config, client }) => ({
  onFetch: async elements => {
    const types = elements.filter(isObjectType)

    const fieldConfigurationType = types
      .find(type => type.elemID.name === FIELD_CONFIGURATION_TYPE_NAME)

    if (fieldConfigurationType === undefined) {
      log.warn(`${FIELD_CONFIGURATION_TYPE_NAME} type not found`)
    } else {
      fieldConfigurationType.fields.fields.annotations[CORE_ANNOTATIONS.CREATABLE] = true
      fieldConfigurationType.fields.fields.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
    }

    const fieldConfigurationItemType = types
      .find(type => type.elemID.name === FIELD_CONFIGURATION_ITEM_TYPE_NAME)

    if (fieldConfigurationItemType === undefined) {
      log.warn(`${FIELD_CONFIGURATION_ITEM_TYPE_NAME} type not found`)
    } else {
      ['id', 'description', 'isHidden', 'isRequired', 'renderer'].forEach(fieldName => {
        fieldConfigurationItemType.fields[fieldName].annotations[CORE_ANNOTATIONS.CREATABLE] = true
        fieldConfigurationItemType.fields[fieldName].annotations[CORE_ANNOTATIONS.UPDATABLE] = true
      })
    }
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && getChangeData(change).elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME
        && !isRemovalChange(change)
    )


    const deployResult = await deployChanges(
      relevantChanges as Change<InstanceElement>[],
      async change => {
        await defaultDeployChange({
          change,
          client,
          apiDefinitions: config.apiDefinitions,
          fieldsToIgnore: ['fields'],
        })
        await deployFieldConfigurationItems(change, client)
      }
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
