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
import { ChangeValidator, getChangeData,
  isAdditionChange, isInstanceElement } from '@salto-io/adapter-api'
import { BRAND_NAME } from '../constants'

export const brandCreationValidator: ChangeValidator = async changes => (
  changes
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === BRAND_NAME)
    .flatMap(instance => (
      [{
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Verify brand subdomain uniqueness',
        detailedMessage: `Brand subdomains are globally unique, please make sure to set an available subdomain for brand ${instance.value.name} before attempting to create it from Salto`,
      }]
    ))
)
