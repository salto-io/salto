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

import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { ChangeError, ChangeValidator, getChangeData, InstanceElement, isAdditionOrModificationChange,
  isInstanceElement } from '@salto-io/adapter-api'
import { buildSelectQueries, isInstanceOfType, queryClient } from '../filters/utils'
import { SalesforceRecord } from '../client/types'
import SalesforceClient from '../client/client'

const { awu } = collections.asynciterable
const log = logger(module)

const isRecordTypeInvalid = (globalSharingSettings: SalesforceRecord, instance: InstanceElement): boolean => (
  globalSharingSettings.DefaultAccountAccess !== 'Read'
  && instance.value.enableAccountOwnerReport !== undefined
)

const invalidRecordTypeError = (instance: InstanceElement): ChangeError => (
  {
    elemID: instance.elemID,
    severity: 'Error',
    message: 'You cannot set a value for AccountSettings.enableAccountOwnerReport unless your organization-wide sharing access level for Accounts is set to Private',
    detailedMessage: `In ${instance.elemID.getFullName()}, enableAccountOwnerReport is set to '${instance.value.enableAccountOwnerReport}' but the organization-wide sharing access level for Accounts is not set to 'Private'.`,
  }
)

const changeValidator = (client: SalesforceClient): ChangeValidator => async changes => {
  const query = await buildSelectQueries('Organization', ['DefaultAccountAccess'])
  const queryResult = await queryClient(client, query)

  if (queryResult.length !== 1) {
    log.error(`Expected a single Organization instance. Found ${queryResult ? queryResult.length : 0} instead`)
    log.error('Unexpected Organization instances: %o', queryResult)
    return []
  }

  const changedInstances = changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)

  return awu(changedInstances)
    .filter(isInstanceOfType('AccountSettings'))
    .filter(accountSettingsInstance => isRecordTypeInvalid(queryResult[0], accountSettingsInstance))
    .map(invalidRecordTypeError)
    .toArray()
}

export default changeValidator
