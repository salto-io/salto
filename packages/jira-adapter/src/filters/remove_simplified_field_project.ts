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

import { isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { PROJECT_TYPE } from '../constants'

const filter: FilterCreator = () => ({
  name: 'removeSimplifiedFieldProjectFilter',
  onFetch: async elements => {
    elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === PROJECT_TYPE)
      .forEach(project => {
        delete project.value.simplified
      })
  },
})
export default filter
