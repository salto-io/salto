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
import {
  ChangeError, ChangeValidator, ElemID, getChangeData, InstanceElement, isAdditionOrModificationChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { isInstanceOfType } from '../filters/utils'
import { ACCOUNT_SETTINGS_METADATA_TYPE, ORGANIZATION_SETTINGS, SALESFORCE } from '../constants'

const { awu } = collections.asynciterable
const log = logger(module)

const isRecordTypeInvalid = (globalSharingSettings: InstanceElement, instance: InstanceElement): boolean => (
  globalSharingSettings.value.defaultAccountAccess !== 'Read'
  && instance.value.enableAccountOwnerReport !== undefined
)

const invalidRecordTypeError = (instance: InstanceElement): ChangeError => (
  {
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Cannot set a value for \'enableAccountOwnerReport\' unless your organization-wide sharing access level for Accounts is set to Private',
    detailedMessage: `enableAccountOwnerReport is set to '${instance.value.enableAccountOwnerReport}' but the organization-wide sharing access level for Accounts is not set to 'Private'.
See https://help.salesforce.com/s/articleView?id=sf.admin_sharing.htm for instruction on how to change the organization-wide sharing defaults, or remove the 'enableAccountOwnerReport' value from ${instance.value.fullName}.`,
  }
)

const changeValidator = (): ChangeValidator => async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    log.error('Change validator did not receive an element source.')
    return []
  }

  const orgWideSettings = await elementsSource.get(new ElemID(SALESFORCE, ORGANIZATION_SETTINGS, 'instance'))

  if (!isInstanceElement(orgWideSettings)) {
    log.error('Expected a single Organization instance. Found %o instead', orgWideSettings)
    return []
  }

  return awu(changes)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(isInstanceOfType(ACCOUNT_SETTINGS_METADATA_TYPE))
    .filter(accountSettingsInstance => isRecordTypeInvalid(orgWideSettings, accountSettingsInstance))
    .map(invalidRecordTypeError)
    .toArray()
}

export default changeValidator
