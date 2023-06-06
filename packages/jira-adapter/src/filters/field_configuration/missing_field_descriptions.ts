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
import { Element, isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FIELD_CONFIGURATION_ITEM_TYPE_NAME } from '../../constants'
import { FilterCreator } from '../../filter'


const filter: FilterCreator = () => ({
  name: 'missingFieldDescriptionsFilter',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_ITEM_TYPE_NAME)
      .filter(instance => _.isEmpty(instance.value.description))
      .filter(instance => isReferenceExpression(instance.value.id)
        && isInstanceElement(instance.value.id.value))
      .forEach(instance => {
        instance.value.description = instance.value.id.value.value.description ?? ''
      })
  },
})

export default filter
