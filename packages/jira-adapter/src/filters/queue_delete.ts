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

import { InstanceElement, RemovalChange, getChangeData, isInstanceChange, isRemovalChange } from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { deployChanges } from '../deployment/standard_deployment'
import { FilterCreator } from '../filter'
import { QUEUE_TYPE } from '../constants'
import JiraClient from '../client/client'

const deployQueueRemovalChange = async (
  change: RemovalChange<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const parent = getParent(getChangeData(change))
  const instanceId = getChangeData(change).value.id
  await client.put({
    url: `/rest/servicedesk/1/servicedesk/${parent.value.key}/queues`,
    data: { deleted: [instanceId] },
  })
}

const filter: FilterCreator = ({ config, client }) => ({
  name: 'queueDeleteFilter',
  deploy: async changes => {
    if (!config.fetch.enableJSM) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }
    const [queueChanges, leftoverChanges] = _.partition(
      changes,
      (change): change is RemovalChange<InstanceElement> => isInstanceChange(change)
      && getChangeData(change).elemID.typeName === QUEUE_TYPE
      && isRemovalChange(change)
    )
    const deployResult = await deployChanges(queueChanges,
      async change => deployQueueRemovalChange(change, client))

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
