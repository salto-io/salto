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
import { isInstanceElement, ReferenceExpression, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { DOMAIN_TYPE_NAME } from '../constants'

/**
 * Set the parent of the domain to be the brand it is associated with.
 *
 * Domains always have a `brandId` field that references a brand. This filter changes the
 * reference to be the parent of the domain.
 */
const filterCreator: FilterCreator = () => ({
  name: 'domainParentFilter',
  onFetch: async elements => {
    const instances = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === DOMAIN_TYPE_NAME)

    // Instead of having a `Brand` reference expression, make it the parent of the domain.
    instances.forEach(instance => {
      instance.annotations[CORE_ANNOTATIONS.PARENT] = [instance.value.brandId as ReferenceExpression]
      delete instance.value.brandId
    })
  },
})

export default filterCreator
