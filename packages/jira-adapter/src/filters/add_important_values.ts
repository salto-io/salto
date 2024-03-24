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
import { CORE_ANNOTATIONS, Element, isObjectType } from '@salto-io/adapter-api'
import { ImportantValues } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import {
  APPLICATION_PROPERTY_TYPE,
  AUTOMATION_TYPE,
  BOARD_TYPE_NAME,
  DASHBOARD_TYPE,
  FIELD_CONFIGURATION_SCHEME_TYPE,
  FIELD_CONFIGURATION_TYPE_NAME,
  FILTER_TYPE_NAME,
  PROJECT_TYPE,
  SCHEDULED_JOB_TYPE,
  SCRIPTED_FIELD_TYPE,
  SCRIPT_RUNNER_LISTENER_TYPE,
  STATUS_TYPE_NAME,
  WEBHOOK_TYPE,
} from '../constants'
import { FIELD_TYPE_NAME } from './fields/constants'

const importantValuesMap: Record<string, ImportantValues> = {
  [APPLICATION_PROPERTY_TYPE]: [{ value: 'type', highlighted: false, indexed: true }],
  [AUTOMATION_TYPE]: [
    { value: 'name', highlighted: true, indexed: false },
    { value: 'state', highlighted: true, indexed: true },
    { value: 'description', highlighted: true, indexed: false },
    { value: 'authorAccountId', highlighted: true, indexed: false },
    { value: 'authorAccountId.displayName', highlighted: false, indexed: true },
    { value: 'projects', highlighted: true, indexed: false },
    { value: 'trigger', highlighted: true, indexed: false },
    { value: 'components', highlighted: true, indexed: false },
    { value: 'trigger.type', highlighted: false, indexed: true },
  ],
  [BOARD_TYPE_NAME]: [
    { value: 'name', highlighted: true, indexed: false },
    { value: 'type', highlighted: true, indexed: true },
    { value: 'location', highlighted: true, indexed: false },
    { value: 'filterId', highlighted: true, indexed: false },
  ],
  [DASHBOARD_TYPE]: [
    { value: 'name', highlighted: true, indexed: false },
    { value: 'description', highlighted: true, indexed: false },
    { value: 'gadgets', highlighted: true, indexed: false },
  ],
  [FIELD_TYPE_NAME]: [
    { value: 'name', highlighted: true, indexed: false },
    { value: 'description', highlighted: true, indexed: false },
    { value: 'isLocked', highlighted: false, indexed: true },
    { value: 'type', highlighted: true, indexed: true },
  ],
  [FIELD_CONFIGURATION_TYPE_NAME]: [
    { value: 'name', highlighted: true, indexed: false },
    { value: 'description', highlighted: true, indexed: false },
  ],
  [FIELD_CONFIGURATION_SCHEME_TYPE]: [
    { value: 'name', highlighted: true, indexed: false },
    { value: 'description', highlighted: true, indexed: false },
  ],
  [FILTER_TYPE_NAME]: [
    { value: 'name', highlighted: true, indexed: false },
    { value: 'description', highlighted: true, indexed: false },
    { value: 'owner', highlighted: true, indexed: false },
    { value: 'owner.displayName', highlighted: false, indexed: true },
    { value: 'jql', highlighted: true, indexed: false },
  ],
  [PROJECT_TYPE]: [
    { value: 'name', highlighted: true, indexed: false },
    { value: 'description', highlighted: true, indexed: false },
    { value: 'key', highlighted: true, indexed: false },
    { value: 'projectTypeKey', highlighted: true, indexed: true },
    { value: 'leadAccountID', highlighted: true, indexed: false },
    { value: 'leadAccountID.displayName', highlighted: false, indexed: true },
  ],
  [SCHEDULED_JOB_TYPE]: [
    { value: 'name', highlighted: true, indexed: false },
    { value: 'enabled', highlighted: true, indexed: true },
    { value: 'script', highlighted: true, indexed: false },
    { value: 'atlassianUser', highlighted: true, indexed: false },
    { value: 'atlassianUser.displayName', highlighted: false, indexed: true },
  ],
  [SCRIPTED_FIELD_TYPE]: [
    { value: 'enabled', highlighted: false, indexed: true },
    { value: 'scriptedFieldType', highlighted: false, indexed: true },
  ],
  [SCRIPT_RUNNER_LISTENER_TYPE]: [{ value: 'enabled', highlighted: false, indexed: true }],
  [STATUS_TYPE_NAME]: [{ value: 'statusCategory', highlighted: false, indexed: true }],
  [WEBHOOK_TYPE]: [{ value: 'Enabled', highlighted: false, indexed: true }],
}

// Adds relevant important values for the Jira adapter
const filter: FilterCreator = ({ config }) => ({
  name: 'addImportantValues',
  onFetch: async (elements: Element[]): Promise<void> => {
    if (!config.fetch.showImportantValues) {
      return
    }
    const objectTypes = elements.filter(isObjectType)
    objectTypes.forEach(obj => {
      const { typeName } = obj.elemID
      const importantValuesArray = importantValuesMap[typeName]
      if (Array.isArray(importantValuesArray)) {
        obj.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES] = importantValuesArray
      }
    })
  },
})

export default filter
