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
import { Change, getChangeData, InstanceElement, isAdditionChange, isAdditionOrModificationChange, isInstanceChange, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import JiraClient from '../../client/client'
import { FilterCreator } from '../../filter'
import { deployContextChange, getContexts, getContextType } from './contexts'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import { FIELD_TYPE_NAME } from './constants'
import { JiraConfig } from '../../config/config'

const { awu } = collections.asynciterable

const deployField = async (
  change: Change<InstanceElement>,
  client: JiraClient,
  config: JiraConfig,
): Promise<void> => {
  await defaultDeployChange({
    change,
    client,
    apiDefinitions: config.apiDefinitions,
    fieldsToIgnore: ['contexts'],
  })

  if (isAdditionChange(change)) {
    const contextType = await getContextType(await getChangeData(change).getType())
    // When creating a field, it is created with a default context,
    // in addition to what is in the NaCl so we need to delete it
    const removalContextsChanges = isAdditionChange(change)
      ? (await getContexts(change, contextType, client))
        .map(instance => toChange({ before: instance }))
      : []

    await awu(removalContextsChanges).forEach(contextChange => deployContextChange(
      contextChange,
      client,
      config.apiDefinitions
    ))
  }
}

const filter: FilterCreator = ({ client, config }) => ({
  name: 'fieldDeploymentFilter',
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && isAdditionOrModificationChange(change)
        && getChangeData(change).elemID.typeName === FIELD_TYPE_NAME
    )

    const deployResult = await deployChanges(
      relevantChanges.filter(isInstanceChange),
      change => deployField(change, client, config),
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
