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

import { GetLookupNameFunc } from '@salto-io/adapter-utils'
import { isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'

const log = logger(module)

export const resolveReference: GetLookupNameFunc = async ({ ref, path }) => {
  if (path !== undefined && isReferenceExpression(ref) && isInstanceElement(ref.value)) {
    if (['projectKey', 'sampleProjectKey'].includes(path.name) && ref.value.value.key !== undefined) {
      return ref.value.value.key
    }

    if (['issueType', 'sampleIssueType'].includes(path.name) && ref.value.value.name !== undefined) {
      return ref.value.value.name
    }
  }

  log.warn('get cross-service unknown jira reference') // TODO do we want to stop the deployment?
  return ref
}
