/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { references as referenceUtils } from '@salto-io/adapter-components'


export const referencesRules: referenceUtils.FieldReferenceDefinition<never>[] = [
  {
    src: { field: 'issueTypeId', parentTypes: ['IssueTypeScreenSchemeItem', 'FieldConfigurationIssueTypeItem'] },
    serializationStrategy: 'id',
    target: { type: 'IssueType' },
  },
  {
    src: { field: 'fieldConfigurationId', parentTypes: ['FieldConfigurationIssueTypeItem'] },
    serializationStrategy: 'id',
    target: { type: 'FieldConfiguration' },
  },
  {
    src: { field: 'screenSchemeId', parentTypes: ['IssueTypeScreenSchemeItem'] },
    serializationStrategy: 'id',
    target: { type: 'ScreenScheme' },
  },
  {
    src: { field: 'defaultIssueTypeId', parentTypes: ['IssueTypeScheme'] },
    serializationStrategy: 'id',
    target: { type: 'IssueType' },
  },
  {
    src: { field: 'issueTypeIds', parentTypes: ['IssueTypeScheme'] },
    serializationStrategy: 'id',
    target: { type: 'IssueType' },
  },
]

export const getLookUpName = referenceUtils.generateLookupFunc(referencesRules)
