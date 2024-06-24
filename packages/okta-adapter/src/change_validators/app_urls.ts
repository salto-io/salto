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
import { ChangeValidator, getChangeData, isInstanceChange, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { APPLICATION_TYPE_NAME } from '../constants'

export const DEFAULT_APP_URLS_VALIDATOR_VALUE = false

/**
 * Remind users to update environment-specific fields when moving applications between Okta tenants
 */
export const appUrlsValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === APPLICATION_TYPE_NAME)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Warning',
      message: 'Update environment-specific values when deploying application elements between Okta tenants',
      detailedMessage:
        'Update environment-specific values, such as URLs and subdomains, when deploying application elements between Okta tenants. Adjust these values by editing the relevant element in Salto.',
    }))
