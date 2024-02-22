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
import { ElemID, Values, Element, ReferenceExpression, InstanceElement } from '@salto-io/adapter-api'
import { createReference } from '../../utils'
import { JIRA } from '../../../src/constants'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'

export const createSecuritySchemeValues = (name: string, level: InstanceElement): Values => ({
  name,
  description: name,
  defaultLevel: new ReferenceExpression(level.elemID, level),
})

export const createSecurityLevelValues = (name: string, allElements: Element[]): Values => ({
  name,
  description: name,
  members: [
    {
      holder: {
        type: 'user',
        parameter: {
          id: '61d44bf59ee70a00685fa6b6',
          displayName: 'Testing salto',
        },
      },
    },
    {
      holder: {
        type: 'projectLead',
      },
    },
    {
      holder: {
        type: 'assignee',
      },
    },
    {
      holder: {
        type: 'projectRole',
        parameter: createReference(new ElemID(JIRA, 'ProjectRole', 'instance', 'Administrators'), allElements),
      },
    },
    {
      holder: {
        type: 'groupCustomField',
        parameter: createReference(
          new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Epic_Status__gh_epic_status__c@suubbuu'),
          allElements,
        ),
      },
    },
    {
      holder: {
        type: 'group',
        parameter: createReference(new ElemID(JIRA, 'Group', 'instance', 'system_administrators@b'), allElements, [
          'name',
        ]),
      },
    },
  ],
})
