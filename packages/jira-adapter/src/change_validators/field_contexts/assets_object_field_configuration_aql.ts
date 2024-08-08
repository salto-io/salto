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

import { ChangeValidator, getChangeData, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { FIELD_CONTEXT_TYPE_NAME } from '../../filters/fields/constants'

const PLACEHOLDER_PATTERN = /\$\{(.*)\}/

const isAqlHasPlaceholder = (aql: string): boolean => {
  const matches = aql.match(PLACEHOLDER_PATTERN)
  return matches !== null && matches.length > 0
}

export const assetsObjectFieldConfigurationAqlValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
    .filter(instance => instance.value.assetsObjectFieldConfiguration?.issueScopeFilterQuery !== undefined)
    .filter(instance => isAqlHasPlaceholder(instance.value.assetsObjectFieldConfiguration.issueScopeFilterQuery))
    .map(instance => ({
      elemID: instance.elemID.createNestedID('assetsObjectFieldConfiguration', 'issueScopeFilterQuery'),
      severity: 'Warning',
      message: 'AQL placeholders are not supported.',
      detailedMessage:
        'This AQL expression will be deployed as is. You may need to manually edit the ids later to match the target environment.',
      deployActions: {
        postAction: {
          title: 'Edit AQL placeholders manually',
          subActions: [
            `In Jira, navigate to the field context "${instance.value.name}" > Edit Assets object/s field configuration`,
            'Inside Filter issue scope section, fix the placeholder with the correct value',
            'Click "Save"',
          ],
        },
      },
    }))
