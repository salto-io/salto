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
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'

/**
 * Change Board type structure to fit the deployment endpoint
 */
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === 'Board')
      .forEach(instance => {
        instance.value.filterId = instance.value.config?.filter?.id
        delete instance.value.config?.filter
      })
  },
})

export default filter
