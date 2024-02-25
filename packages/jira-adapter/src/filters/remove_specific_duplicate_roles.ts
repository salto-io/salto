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
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { PROJECT_ROLE_TYPE } from '../constants'

const log = logger(module)

const BUILT_IN_PROJECT_ROLE_NAME = 'atlassian-addons-project-access'
// This is a bandage fix for a Jira bug.
// When you create a team-managed project several project-scoped roles are created by default,
//  including atlassian-addons-project-access
// When you delete a team-managed project all its project-scope roles are not really deleted.
// They keep appearing in the roles API answer, but without the project scope. They are not visible in the UI
// This fix will only address atlassian-addons-project-access as it is a built-in role, will always be there
// and the global role will (hopefully) always have the lower id
const filter: FilterCreator = ({ config }) => ({
  name: 'projectRoleRemoveTeamManagedDuplicatesFilter',
  onFetch: async (elements: Element[]) => {
    if (!config.fetch.removeDuplicateProjectRoles) {
      return
    }
    const builtInProjectRoles = elements
      .filter(isInstanceElement)
      .filter(
        instance =>
          instance.elemID.typeName === PROJECT_ROLE_TYPE && instance.value.name === BUILT_IN_PROJECT_ROLE_NAME,
      )
    if (builtInProjectRoles.length <= 1) {
      return
    }
    // as this is a built-in role, we assume that the one with the lowest id is the global one
    const originalElementId = _.minBy(builtInProjectRoles, instance => instance.value.id)?.value.id
    log.info(
      `Found ${builtInProjectRoles.length} instances of ${BUILT_IN_PROJECT_ROLE_NAME} role, keeping only lowest id ${originalElementId}`,
    )
    _.remove(
      elements,
      element =>
        isInstanceElement(element) &&
        element.elemID.typeName === PROJECT_ROLE_TYPE &&
        element.value.name === BUILT_IN_PROJECT_ROLE_NAME &&
        element.value.id !== originalElementId,
    )
  },
})

export default filter
