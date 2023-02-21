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
import { ChangeValidator, isInstanceElement, isModificationChange, getChangeData } from '@salto-io/adapter-api'
import { FIELD_TYPE_NAME } from '../filters/fields/constants'


export const systemFieldsValidator: ChangeValidator = async changes => (
  changes
    .map(change => (isModificationChange(change) ? change.data.before : getChangeData(change)))
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
    .filter(instance => instance.value.schema !== undefined)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Can not deploy changes to a Jira system field',
      detailedMessage: 'This is a built-in Jira system field, and can not be edited or deleted. Changes to this field will not be deployed.',
    }))
)
