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
import { ElemID, Values, Element } from '@salto-io/adapter-api'
import { createReference } from '../../../utils'
import { ISSUE_TYPE_NAME, JIRA } from '../../../../src/constants'
import { FIELD_TYPE_NAME } from '../../../../src/filters/fields/constants'

export const createBehaviorValues = (name: string, allElements: Element[]): Values => ({
  name,
  description: 'description',
  enabled: true,
  projects: [createReference(new ElemID(JIRA, 'Project', 'instance', 'Test_Project@s'), allElements, ['id'])],
  issueTypes: [
    createReference(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'Story'), allElements, ['id']),
    createReference(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'Bug'), allElements, ['id']),
  ],
  config: [
    {
      event: ['ONLOAD'],
      fieldName: '',
      javascript: 'getFieldById("description").setName("Customer Priority Level");',
      typescript: 'getFieldById("description").setName("Customer Priority Level");',
      affectedFields: [
        createReference(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Description__string'), allElements, ['name']),
      ],
    },
  ],
})
