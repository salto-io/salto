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
import { ChangeValidator, getChangeData, isInstanceElement, isModificationChange } from '@salto-io/adapter-api'
import { LOCALE_TYPE_NAME } from '../constants'

export const localeModificationValidator: ChangeValidator = async changes =>
  changes
    .filter(isModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === LOCALE_TYPE_NAME)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Modification of locale is not supported',
      detailedMessage: `Failed to update ${instance.elemID.getFullName()} since modification of locale is not supported by Zendesk`,
    }))
