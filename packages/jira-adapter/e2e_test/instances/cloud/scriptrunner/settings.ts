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
import {
  ElemID,
  Element,
  InstanceElement,
  ModificationChange,
  Values,
  isInstanceElement,
  toChange,
} from '@salto-io/adapter-api'
import { createReference } from '../../../utils'
import { JIRA, SCRIPT_RUNNER_SETTINGS_TYPE } from '../../../../src/constants'

const createScriptRunnerSettingsValues = (allElements: Element[]): Values => ({
  'jql_search_view@b': true,
  'filter_sync_interval@b': 10,
  'notifications_group@b': createReference(
    new ElemID(JIRA, 'Group', 'instance', 'system_administrators@b'),
    allElements,
    ['name'],
  ),
  'issue_polling@b': false,
  'scripts_timezone@b': 'UTC',
  'excluded_notifications_groups@b': [
    createReference(new ElemID(JIRA, 'Group', 'instance', 'system_administrators@b'), allElements, ['name']),
  ],
  'notify_assignee_reporter@b': false,
})

export const createScriptRunnerSettingsInstances = (allElements: Element[]): ModificationChange<InstanceElement> => {
  const fetchSettings = allElements
    .filter(isInstanceElement)
    .find(instance => instance.elemID.typeName === SCRIPT_RUNNER_SETTINGS_TYPE)
  if (fetchSettings === undefined) {
    throw new Error('ScriptRunner settings instance not found')
  }
  const before = fetchSettings.clone()
  before.value = createScriptRunnerSettingsValues(allElements)
  before.value['issue_polling@b'] = !fetchSettings.value['issue_polling@b']
  const after = fetchSettings.clone()
  after.value = createScriptRunnerSettingsValues(allElements)
  return toChange({ before, after }) as ModificationChange<InstanceElement>
}
