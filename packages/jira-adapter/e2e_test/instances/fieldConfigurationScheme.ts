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
import { ISSUE_TYPE_NAME, JIRA } from '../../src/constants'

export const createFieldConfigurationSchemeValues = (name: string, allElements: Element[]): Values => ({
  name,
  description: name,
  items: [
    {
      issueTypeId: 'default',
      fieldConfigurationId: createReference(
        new ElemID(JIRA, 'FieldConfiguration', 'instance', 'Default_Field_Configuration@s'),
        allElements,
      ),
    },
    {
      issueTypeId: createReference(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'Bug'), allElements),
      fieldConfigurationId: createReference(
        new ElemID(JIRA, 'FieldConfiguration', 'instance', 'Default_Field_Configuration@s'),
        allElements,
      ),
    },
  ],
})
