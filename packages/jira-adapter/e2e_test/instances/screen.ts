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
import { createReference } from '../utils'
import { JIRA } from '../../src/constants'

export const createScreenValues = (name: string, allElements: Element[]): Values => ({
  name,
  description: name,
  tabs: {
    tab2: {
      name: 'tab2',
      position: 0,
    },
    'Field_Tab@s': {
      name: 'Field Tab',
      fields: [
        createReference(new ElemID(JIRA, 'Field', 'instance', 'Assignee__user'), allElements),
      ],
      position: 2,
    },
    tab3: {
      name: 'tab3',
      fields: [
        createReference(new ElemID(JIRA, 'Field', 'instance', 'Created__datetime'), allElements),
        createReference(new ElemID(JIRA, 'Field', 'instance', 'Creator__user'), allElements),
      ],
      position: 1,
    },
  },
})
