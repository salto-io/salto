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
import { AdditionChange, CORE_ANNOTATIONS, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, isModificationChange, isObjectType, ModificationChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { getParents, resolveChangeElement } from '@salto-io/adapter-utils'
import { defaultDeployChange, deployChanges } from '../../deployment'
import { FilterCreator } from '../../filter'
import JiraClient from '../../client/client'
import { JiraConfig } from '../../config'
import { getLookUpName } from '../../reference_mapping'
import { covertFields } from './fields'

const { awu } = collections.asynciterable

const SCREEN_TAB_TYPE_NAME = 'ScreenableTab'

const deployTabFields = async (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  client: JiraClient
): Promise<void> => {
  const resolvedChange = await resolveChangeElement(change, getLookUpName)

  const fieldsAfter = resolvedChange.data.after.value.fields ?? []
  const fieldsBefore = isModificationChange(resolvedChange)
    ? resolvedChange.data.before.value.fields ?? []
    : []

  const fieldsAfterSet = new Set(fieldsAfter)
  const fieldsBeforeSet = new Set(fieldsBefore)

  const addedFields = Array.from(fieldsAfter).filter(field => !fieldsBeforeSet.has(field))
  const removedFields = Array.from(fieldsBefore).filter(field => !fieldsAfterSet.has(field))

  const instance = getChangeData(resolvedChange)
  const instanceParents = getParents(instance)
  if (instanceParents?.[0]?.id === undefined || instanceParents.length > 1) {
    throw new Error('Cannot deploy tab fields without a parent screen')
  }

  const screenId = getParents(instance)[0].id
  const tabId = instance.value.id

  await Promise.all(addedFields.map(id => client.post({
    url: `/rest/api/3/screens/${screenId}/tabs/${tabId}/fields`,
    data: {
      fieldId: id,
    },
  })))

  await Promise.all(removedFields.map(id => client.delete({
    url: `/rest/api/3/screens/${screenId}/tabs/${tabId}/fields/${id}`,
  })))

  if (!_.isEqual(fieldsBefore, fieldsAfter) && fieldsAfter.length > 1) {
    await client.post({
      url: `/rest/api/3/screens/${screenId}/tabs/${tabId}/fields/${fieldsAfter[0]}/move`,
      data: {
        position: 'First',
      },
    })

    await awu(fieldsAfter.slice(1)).forEach(async (fieldId, index) => {
      await client.post({
        url: `/rest/api/3/screens/${screenId}/tabs/${tabId}/fields/${fieldId}/move`,
        data: {
          after: fieldsAfter[index],
        },
      })
    })
  }
}

const deployScreenTab = async (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  client: JiraClient,
  config: JiraConfig
): Promise<void> => {
  const nameAfter = change.data.after.value.name
  const nameBefore = isModificationChange(change)
    ? change.data.before.value.name
    : undefined
  await defaultDeployChange({
    change,
    client,
    apiDefinitions: config.apiDefinitions,
    fieldsToIgnore: nameAfter === nameBefore
      // If we try to deploy a screen tab with the same name,
      // we get an error that the name is already in use
      ? ['fields', 'name']
      : ['fields'],
  })
  await deployTabFields(change, client)
}

const filter: FilterCreator = ({ config, client }) => ({
  onFetch: async elements => {
    covertFields(elements, SCREEN_TAB_TYPE_NAME, 'fields')

    const screenTabType = elements.filter(isObjectType).find(
      type => type.elemID.name === SCREEN_TAB_TYPE_NAME
    )
    if (screenTabType !== undefined) {
      screenTabType.fields.fields.annotations = {
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      }
    }
  },
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && isAdditionOrModificationChange(change)
        && getChangeData(change).elemID.typeName === SCREEN_TAB_TYPE_NAME
    )

    const deployResult = await deployChanges(
      relevantChanges
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange),
      async change => deployScreenTab(
        change,
        client,
        config
      )
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
