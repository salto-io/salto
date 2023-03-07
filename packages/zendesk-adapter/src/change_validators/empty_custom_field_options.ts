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
import _ from 'lodash'
import { ChangeValidator, getChangeData,
  isAdditionOrModificationChange, isInstanceElement } from '@salto-io/adapter-api'
import { CUSTOM_FIELD_OPTIONS_FIELD_NAME } from '../filters/custom_field_options/creator'
import { FIELD_TYPE_NAMES } from '../constants'

const RELEVANT_FIELD_TYPES = ['dropdown', 'tagger', 'multiselect']

export const emptyCustomFieldOptionsValidator: ChangeValidator = async changes => (
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => FIELD_TYPE_NAMES.includes(instance.elemID.typeName))
    .flatMap(instance => {
      if (
        RELEVANT_FIELD_TYPES.includes(instance.value.type)
        && _.isEmpty(instance.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME])
      ) {
        return [{
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Cannot make this change since dropdown, tagger and multi-select fields can’t to be empty',
          detailedMessage: 'Custom field options are required for dropdown, tagger and multi select fields',
        }]
      }
      return []
    })
)
