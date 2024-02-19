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
import {
  Change,
  DeployResult,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { TICKET_FIELD_TYPE_NAME, TICKET_STATUS_CUSTOM_STATUS_TYPE_NAME } from '../constants'

const log = logger(module)

/**
 * This filter deploys the ticket_field ticket status. This ticket field cannot be deployed as it is a
 * zendesk default, therefore to not fail the deployment of dependent elements (such as ticket form) we return
 * a successful deployment even though the ticket was not really deployed
 */
const filterCreator: FilterCreator = () => ({
  name: 'ticketStatusCustomStatusDeploy',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [ticketStatusCustomStatusChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        TICKET_FIELD_TYPE_NAME === getChangeData(change).elemID.typeName &&
        isInstanceChange(change) &&
        getChangeData(change).value.type === TICKET_STATUS_CUSTOM_STATUS_TYPE_NAME &&
        isAdditionChange(change),
    )

    const deployResult: DeployResult = {
      appliedChanges: ticketStatusCustomStatusChanges,
      errors: [],
    }
    if (ticketStatusCustomStatusChanges.length > 0) {
      log.warn(
        `Elements: ${ticketStatusCustomStatusChanges.map(change => getChangeData(change).elemID.getFullName())} will not be deployed`,
      )
    }
    return { deployResult, leftoverChanges }
  },
})
export default filterCreator
