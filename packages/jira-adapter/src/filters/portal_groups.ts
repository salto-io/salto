/*
 *                      Copyright 2024 Salto Labs Ltd.
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

import { ReferenceExpression, getChangeData, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { getParent, isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { PORTAL_GROUP_TYPE } from '../constants'
import { defaultDeployChange, deployChanges } from '../deployment/standard_deployment'

const filter: FilterCreator = ({ config, client }) => ({
  name: 'portalGroupsFilter',
  deploy: async changes => {
    const { jsmApiDefinitions } = config
    if (!config.fetch.enableJSM || jsmApiDefinitions === undefined) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }

    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === PORTAL_GROUP_TYPE,
    )
    const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), async change => {
      await defaultDeployChange({ change, client, apiDefinitions: jsmApiDefinitions })
      if (isModificationChange(change)) {
        const instance = getChangeData(change)
        const project = getParent(instance)
        const ticketTypeIds = instance.value.ticketTypeIds
          .filter(isResolvedReferenceExpression)
          .map((ticketType: ReferenceExpression) => ticketType.value.value.id)
        await client.post({
          url: `/rest/servicedesk/1/servicedesk/${project.value.id}/portal-groups/request-types`,
          data: {
            groups: [
              {
                groupId: instance.value.id,
                ticketTypeIds,
              },
            ],
          },
        })
      }
    })
    return { deployResult, leftoverChanges }
  },
})
export default filter
