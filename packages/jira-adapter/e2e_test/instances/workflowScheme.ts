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
import { Values, Element, ElemID } from '@salto-io/adapter-api'
import { createReference } from '../utils'
import { ISSUE_TYPE_NAME, JIRA, WORKFLOW_TYPE_NAME } from '../../src/constants'

export const createWorkflowSchemeValues = (name: string, allElements: Element[]): Values => ({
  name,
  description: name,
  defaultWorkflow: createReference(new ElemID(JIRA, WORKFLOW_TYPE_NAME, 'instance', 'jira'), allElements),
  items: [
    {
      issueType: createReference(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'Bug'), allElements),
      workflow: createReference(new ElemID(JIRA, WORKFLOW_TYPE_NAME, 'instance', 'jira'), allElements),
    },
  ],
})
