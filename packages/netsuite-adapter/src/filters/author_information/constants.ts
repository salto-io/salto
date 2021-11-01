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
export const EMPLOYEE_NAME_QUERY = 'SELECT id, entityid FROM employee ORDER BY id ASC'
export const EMPLOYEE_SCHEMA = {
  items: {
    properties: {
      entityid: {
        type: 'string',
      },
      id: {
        type: 'string',
      },
    },
    required: [
      'entityid',
      'id',
    ],
    type: 'object',
  },
  type: 'array',
}

export type EmployeeResult = {
  id: string
  entityid: string
}

export const SYSTEM_NOTE_SCHEMA = {
  items: {
    properties: {
      name: {
        type: 'string',
      },
      recordid: {
        type: 'string',
      },
      recordtypeid: {
        type: 'string',
      },
    },
    required: [
      'name',
      'recordid',
      'recordtypeid',
    ],
    type: 'object',
  },
  type: 'array',
}

export type SystemNoteResult = {
  recordid: string
  recordtypeid: string
  name: string
}

export const SAVED_SEARCH_RESULT_SCHEMA = {
  items: {
    properties: {
      id: {
        type: 'string',
      },
      modifiedby: {
        items: {
          properties: {
            text: {
              type: 'string',
            },
            value: {
              type: 'string',
            },
          },
          required: [
            'text',
            'value',
          ],
          type: 'object',
        },
        type: 'array',
      },
    },
    required: [
      'id',
      'modifiedby',
    ],
    type: 'object',
  },
  type: 'array',
}

type modifiedbyField = {
  value: string
  text: string
}

export type SavedSearchesResult = {
  id: string
  modifiedby: modifiedbyField[]
}
