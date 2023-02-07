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
import { Element, InstanceElement, isInstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from './constants'

const filter: FilterCreator = () => ({
  name: 'contextReferencesFilter',
  onFetch: async (elements: Element[]) => {
    const parentToContext = _.groupBy(
      elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME),
      instance => getParents(instance)[0].elemID.getFullName(),
    )

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
      .forEach(instance => {
        instance.value.contexts = parentToContext[instance.elemID.getFullName()]
          ?.map((context: InstanceElement) => new ReferenceExpression(context.elemID, context))
      })
  },
})

export default filter
