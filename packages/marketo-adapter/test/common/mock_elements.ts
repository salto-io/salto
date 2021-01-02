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

const firstLeadMock = {
  id: 1,
  dataType: 'string',
  displayName: 'Test Lead',
  rest: {
    name: 'test',
  },
  soap: {
    name: 'test',
  },
}

export const leadsMockArray = [
  firstLeadMock,
] as unknown

const firstCustomObjectMock = {
  name: 'test',
  idField: 'test',
  displayName: 'Test',
  pluralName: 'tests',
  description: 'unit test',
  dedupeFields: ['dedupe'],
  searchableFields: [],
  fields: [
    {
      name: 'field',
      dataType: 'string',
    },
  ],
  relationships: [],
  createdAt: '',
  updatedAt: '',
  apiName: 'test',
  version: 'draft',
}

export const customObjectsMockArray = [
  firstCustomObjectMock,
] as unknown
