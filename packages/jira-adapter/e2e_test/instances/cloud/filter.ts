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
import { ElemID, TemplateExpression, Values, Element } from '@salto-io/adapter-api'
import { createReference } from '../../utils'
import { GROUP_TYPE_NAME, JIRA, PROJECT_TYPE } from '../../../src/constants'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'


export const createFilterValues = (name: string, allElements: Element[]): Values => ({
  name,
  jql: new TemplateExpression({ parts: [
    createReference(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Project__project'), allElements),
    ' = ',
    createReference(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'Test_Project@s'), allElements, ['key']),
    ' ORDER BY ',
    createReference(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Rank__gh_lexo_rank__c@uubbuu'), allElements, ['name']),
    ' ASC',
  ] }),
  sharePermissions: [
    { type: 'project',
      project: {
        id: createReference(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'Test_Project@s'), allElements),
      } },
    // project should be before group- that is the fetch order
    { type: 'group',
      group: {
        name: createReference(new ElemID(JIRA, GROUP_TYPE_NAME, 'instance', 'site_admins@b'), allElements),
      } },
  ],
  editPermissions: [
    {
      type: 'user',
      user: {
        id: '557058:f58131cb-b67d-43c7-b30d-6b58d40bd077',
        displayName: 'Automation for Jira',
      },
    },
  ],
})
