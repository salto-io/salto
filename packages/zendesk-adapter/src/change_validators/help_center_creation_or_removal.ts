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
import {
  Change, ChangeError,
  ChangeValidator,
  getChangeData, InstanceElement, isAdditionChange,
  isInstanceChange, isModificationChange,
} from '@salto-io/adapter-api'
import { BRAND_TYPE_NAME } from '../constants'
import ZendeskClient from '../client/client'
import { ZendeskApiConfig } from '../config'
import { isBrand, invalidBrandChange } from './help_center_activation'

export const invalidBrandAdditionChange = (change: Change<InstanceElement>, fieldToCheck: 'has_help_center' | 'help_center_state')
  : boolean => {
  if (!isBrand(getChangeData(change))) {
    return false
  }
  return isAdditionChange(change)
    && (change.data.after.value[fieldToCheck] === true)
}

/**
 * This change validator checks that the field 'has_help_center' in a brand has not been changed or
 * that a brand was created and has_help_center is not equal to true.
 * This is since Salto does not support the cration or deletion of help center.
 */
export const helpCenterCreationOrRemovalValidator:
  (client: ZendeskClient, apiConfig: ZendeskApiConfig) =>
  ChangeValidator = (client, apiConfig) => async changes => {
    const relevantChanges = changes
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === BRAND_TYPE_NAME)
      .filter(change => invalidBrandChange(change, 'has_help_center')
        || invalidBrandAdditionChange(change, 'has_help_center'))

    return relevantChanges
      .flatMap((change: Change): ChangeError[] => {
        if (isModificationChange(change)) {
          return [{
            elemID: getChangeData(change).elemID,
            severity: 'Error',
            message: 'Creation or removal of help center for a certain brand is not supported via Salto.',
            detailedMessage: `Creation or removal of help center for a certain brand is not supported via Salto.
      To create or remove a help center, please go to ${client.getUrl().href}${apiConfig.types.brand.transformation?.serviceUrl?.slice(1)}`,
          }]
        }
        return [{
          elemID: getChangeData(change).elemID,
          severity: 'Warning',
          message: 'Creation of a brand with a help center is not supported via Salto.',
          detailedMessage: `Creation of a brand with a help center is not supported via Salto. The brand will be created without a help center. After creating the brand, 
            to create a help center, please go to ${client.getUrl().href}${(apiConfig.types.brand.transformation?.serviceUrl)?.slice(1)}`,
        }]
      })
  }
