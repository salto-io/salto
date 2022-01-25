/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ElemID, Values, Element, ReferenceExpression } from '@salto-io/adapter-api'
import { createReference } from '../utils'
import { JIRA } from '../../src/constants'

const p1Option = {
  value: 'p1',
  disabled: false,
  cascadingOptions: {
    c11: {
      value: 'c11',
      disabled: false,
      position: 0,
    },
    c12: {
      value: 'c12',
      disabled: false,
      position: 1,
    },
  },
  position: 0,
}

export const createFieldValues = (name: string): Values => ({
  name,
  description: 'desc!',
  searcherKey: 'com.atlassian.jira.plugin.system.customfieldtypes:cascadingselectsearcher',
  type: 'com.atlassian.jira.plugin.system.customfieldtypes:cascadingselect',
})

export const createContextValues = (name: string, allElements: Element[]): Values => ({
  name,
  options: {
    p1: p1Option,
    p2: {
      value: 'p2',
      disabled: false,
      cascadingOptions: {
        c22: {
          value: 'c22',
          disabled: false,
          position: 0,
        },
      },
      position: 1,
    },
    p3: {
      value: 'p3',
      disabled: true,
      position: 2,
    },
    p4: {
      value: 'p4',
      disabled: false,
      position: 3,
    },
  },
  defaultValue: {
    type: 'option.cascading',
    optionId: new ReferenceExpression(
      new ElemID(JIRA, 'Field', 'instance', name, 'contexts', 'CustomConfigurationScheme_for_CustomSelectList@s', 'options', 'p1'),
      p1Option
    ),
    cascadingOptionId: new ReferenceExpression(
      new ElemID(JIRA, 'Field', 'instance', name, 'contexts', 'CustomConfigurationScheme_for_CustomSelectList@s', 'options', 'p1', 'cascadingOptions', 'c11'),
      p1Option.cascadingOptions.c11
    ),
  },
  issueTypeIds: [
    createReference(new ElemID(JIRA, 'IssueType', 'instance', 'Epic'), allElements),
    createReference(new ElemID(JIRA, 'IssueType', 'instance', 'Story'), allElements),
  ],
})
