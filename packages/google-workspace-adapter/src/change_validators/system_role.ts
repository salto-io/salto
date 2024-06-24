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
import { ChangeValidator, getChangeData, isInstanceElement } from '@salto-io/adapter-api'
import { ROLE_TYPE_NAME } from '../constants'

//  Google support predefined roles that are managed by Google and can not be edited.

export const systemRoleValidator: ChangeValidator = async changes =>
  changes
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === ROLE_TYPE_NAME)
    .filter(instance => instance.value.isSystemRole === true)
    .flatMap(instance => [
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Can not edit system roles trough the API',
        detailedMessage: 'Can not edit system roles trough the API',
      },
    ])
