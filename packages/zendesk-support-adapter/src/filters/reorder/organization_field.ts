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
import { createReorderFilterCreator } from './creator'

export const TYPE_NAME = 'organization_field'

/**
 * Add organization field order element with all the organization fields ordered
 */
const filterCreator = createReorderFilterCreator({
  typeName: TYPE_NAME,
  orderFieldName: 'organization_field_ids',
  iterateesToSortBy: [
    instance => !instance.value.active,
    instance => instance.value.position,
  ],
  activeFieldName: 'active',
})

export default filterCreator
