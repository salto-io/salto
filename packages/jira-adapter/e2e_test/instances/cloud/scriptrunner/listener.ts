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
import { JIRA } from '../../../../src/constants'

export const createScriptRunnerListenerValues = (name: string, allElements: Element[]): Values => ({
  projects: [createReference(new ElemID(JIRA, 'Project', 'instance', 'Test_Project@s'), allElements)],
  script: 'import java.time.LocalDate;return LocalDate.now().minusDays(1)',
  enabled: true,
  events: ['comment_created'],
  executionCondition: 'AA = B',
  description: name,
  executionUser: 'INITIATING_USER',
})
