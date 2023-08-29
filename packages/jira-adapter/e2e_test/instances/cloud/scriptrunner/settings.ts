/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ElemID, Values, Element } from '@salto-io/adapter-api'
import { createReference } from '../../../utils'
import { JIRA } from '../../../../src/constants'


export const createScriptRunnerSettingsValues = (allElements: Element[]): Values => ({
  'jql_search_view@b': true,
  'filter_sync_interval@b': 10,
  'notifications_group@b': createReference(new ElemID(JIRA, 'Group', 'instance', 'system_administrators@b'), allElements, ['name']),
  'issue_polling@b': false,
  'scripts_timezone@b': 'UTC',
  'excluded_notifications_groups@b': [
    createReference(new ElemID(JIRA, 'Group', 'instance', 'system_administrators@b'), allElements, ['name']),
  ],
  'notify_assignee_reporter@b': false,
})
