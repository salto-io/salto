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
import { VARIANTS_FIELD_NAME, DYNAMIC_CONTENT_ITEM_TYPE_NAME } from '../filters/dynamic_content'

export const emptyVariantsValidator: ChangeValidator = async changes => (
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === DYNAMIC_CONTENT_ITEM_TYPE_NAME)
    .flatMap(instance => {
      if (_.isEmpty(instance.value[VARIANTS_FIELD_NAME])) {
        return [{
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Cannot make this change due to missing variants',
          detailedMessage: 'Dynamic content item must have at least one variant',
        }]
      }
      return []
    })
)
