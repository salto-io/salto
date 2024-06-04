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
import { Values } from '@salto-io/adapter-api'
import { e2eUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { SPACE_TYPE_NAME, PAGE_TYPE_NAME, TEMPLATE_TYPE_NAME } from '../src/constants'

export const uniqueFieldsPerType: Record<string, string[]> = {
  [SPACE_TYPE_NAME]: ['key', 'name'],
  [PAGE_TYPE_NAME]: ['title'],
  [TEMPLATE_TYPE_NAME]: ['name'],
}

const mockDefaultValues: Record<string, Values> = {
  [SPACE_TYPE_NAME]: {
    type: 'global',
    status: 'current',
    description: {
      plain: {
        value: 'some description',
        representation: 'plain',
      },
    },
  },
  [PAGE_TYPE_NAME]: {
    status: 'current',
    parentType: 'page',
    restriction: [
      {
        operation: 'update',
      },
    ],
  },
  [TEMPLATE_TYPE_NAME]: {
    description: 'some description',
    templateType: 'page',
    editorVersion: 'v2',
    body: {
      storage: {
        value: '<p>some value</p>',
        representation: 'storage',
      },
    },
  },
}

export const getMockValues = (testSuffix: string): Record<string, Values> =>
  _.mapValues(mockDefaultValues, (values, typeName) => ({
    ...Object.fromEntries(
      uniqueFieldsPerType[typeName].map(field => [field, `${e2eUtils.TEST_PREFIX}${typeName}${testSuffix}`]),
    ),
    ...values,
  }))
