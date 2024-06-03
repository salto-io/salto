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
import { SPACE_TYPE_NAME, PAGE_TYPE_NAME, TEMPLATE_TYPE_NAME } from '../src/constants'

export const mockDefaultValues: Record<string, Values> = {
  [SPACE_TYPE_NAME]: {
    description: {
      plain: {
        value: 'some description',
        representation: 'plain',
      },
      view: {
        representation: 'view',
        value: 'some description',
      },
    },
    metadata: {
      labels: {
        start: 0,
        limit: 200,
        size: 0,
      },
    },
    type: 'global',
    status: 'current',
  },
  [PAGE_TYPE_NAME]: {
    status: 'current',
    authorId: '712020:bcde5b20-7e30-4987-8391-1108a772c143',
    ownerId: '712020:bcde5b20-7e30-4987-8391-1108a772c143',
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
