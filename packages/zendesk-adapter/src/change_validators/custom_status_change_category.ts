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
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { CUSTOM_STATUS_TYPE_NAME } from '../constants'

export const customStatusCategoryChangeValidator: ChangeValidator = async changes => changes
  .filter(change => getChangeData(change).elemID.typeName === CUSTOM_STATUS_TYPE_NAME)
  .filter(isModificationChange)
  .filter(isInstanceChange)
  .filter(change => change.data.before.value.status_category !== change.data.after.value.status_category)
  .map(getChangeData)
  .flatMap(instance => (
    [{
      elemID: instance.elemID,
      severity: 'Warning',
      message: 'It is not possible to update the category on an existing status in zendesk',
      detailedMessage: `The category of ${instance.elemID.name} will not be updated since it is not possible to update the category on an existing status in zendesk`,
    }]
  ))
