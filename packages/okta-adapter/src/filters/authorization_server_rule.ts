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
import { logger } from '@salto-io/logging'
import { getParent } from '@salto-io/adapter-utils'
import { CORE_ANNOTATIONS, isInstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { AUTHORIZATION_POLICY_RULE } from '../constants'

const log = logger(module)

/**
 * Add AuthorizationServer instance as a second parent to the associated AuthorizationServerPolicyRule instance
 */
const filter: FilterCreator = () => ({
  name: 'authorizationServerPolicyRuleFilter',
  onFetch: async elements => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === AUTHORIZATION_POLICY_RULE)
      .forEach(instance => {
        try {
          const parentPolicy = getParent(instance)
          const parentAuthorizationServerId = getParent(parentPolicy)
          const parents = instance.annotations[CORE_ANNOTATIONS.PARENT]
          if (Array.isArray(parents)) {
            parents.push(new ReferenceExpression(parentAuthorizationServerId.elemID, parentAuthorizationServerId))
          }
        } catch (error) {
          log.error(
            `Could not run authorizationServerPolicyRuleFilter for instance ${instance.elemID.getFullName()}, error: ${error}`,
          )
        }
      })
  },
})

export default filter
