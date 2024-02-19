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

import { Values, ElemID, Element } from '@salto-io/adapter-api'
import { createReference } from '../../utils'
import { JIRA } from '../../../src/constants'

export const createIssueLayoutValues = (allElements: Element[]): Values => ({
  extraDefinerId: createReference(
    new ElemID(JIRA, 'Screen', 'instance', 'TP__Kanban_Default_Issue_Screen@fssss'),
    allElements,
  ),
  issueLayoutConfig: {
    items: [
      {
        type: 'FIELD',
        sectionType: 'PRIMARY',
        key: createReference(new ElemID(JIRA, 'Field', 'instance', 'Assignee__user'), allElements),
      },
    ],
  },
})
