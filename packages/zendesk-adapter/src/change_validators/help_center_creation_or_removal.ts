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
  ChangeValidator,
  getChangeData,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { BRAND_TYPE_NAME } from '../constants'
import { invalidBrandChange } from './help_center_activation'
import ZendeskClient from '../client/client'
import { ZendeskApiConfig } from '../config'

export const helpCenterCreationOrRemovalValidator:
  (client: ZendeskClient, apiConfig: ZendeskApiConfig) =>
  ChangeValidator = (client, apiConfig) => async changes => {
    const relevantInstances = changes
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === BRAND_TYPE_NAME)
      .filter(change => invalidBrandChange(change, 'has_help_center'))
      .map(getChangeData)

    return relevantInstances
      .flatMap(instance => [{
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Creation or removal of help center for a certain brand is not supported via Salto.',
        detailedMessage: `Creation or removal of help center for a certain brand is not supported via Salto.
        To create or remove a help center, please go to ${client.getUrl().href}${apiConfig.types.brand.transformation?.serviceUrl}`,
      }])
  }
