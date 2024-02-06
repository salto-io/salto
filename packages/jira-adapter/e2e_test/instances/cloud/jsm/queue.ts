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

import { ElemID, Values, Element, TemplateExpression } from '@salto-io/adapter-api'
import { createReference } from '../../../utils'
import { JIRA } from '../../../../src/constants'

export const createQueueValues = (name: string, allElements: Element[]): Values => ({
  name,
  jql: new TemplateExpression({ parts: [
    createReference(new ElemID(JIRA, 'Field', 'instance', 'Resolution__resolution'), allElements),
    ' = UNRESOLVED',
  ] }),
  columns: [
    createReference(new ElemID(JIRA, 'Field', 'instance', 'Issue_Type__issuetype@suu'), allElements),
    createReference(new ElemID(JIRA, 'Field', 'instance', 'Key'), allElements),
    createReference(new ElemID(JIRA, 'Field', 'instance', 'Summary__string'), allElements),
    createReference(new ElemID(JIRA, 'Field', 'instance', 'Reporter__user'), allElements),
    createReference(new ElemID(JIRA, 'Field', 'instance', 'Assignee__user'), allElements),
    createReference(new ElemID(JIRA, 'Field', 'instance', 'Status__status'), allElements),
  ],
  canBeHidden: false,
  favourite: false,
})
