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
import {
  Change,
  DeployResult,
  getChangeData,
  InstanceElement, isAdditionChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { TICKET_FIELD_TYPE_NAME,
  ticketStatusCustomStatusName } from '../constants'

const log = logger(module)

/**
 * This filter deploys the ticket_filed ticket status. This ticket field cannot be deployed as it is a
 * zendesk default, therefore to not fail the deployment of dependent elements (such as ticket form) we return
 * a successful deployment even though the ticket was not really deployed
 */
const filterCreator: FilterCreator = () => ({
  name: 'ticketStatusCustomStatusDeploy',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [TicketStatusCustomStatusChanges, leftoverChanges] = _.partition(
      changes,
      change => ticketStatusCustomStatusName === getChangeData(change).elemID.name
      && TICKET_FIELD_TYPE_NAME === getChangeData(change).elemID.typeName
      && isAdditionChange(change),
    )

    const deployResult: DeployResult = {
      appliedChanges: TicketStatusCustomStatusChanges,
      errors: [],
    }
    log.warn(`Elements: ${TicketStatusCustomStatusChanges.map(change => getChangeData(change).elemID.getFullName()).toString()} will not be deployed`)
    return { deployResult, leftoverChanges }
  },
})
export default filterCreator
