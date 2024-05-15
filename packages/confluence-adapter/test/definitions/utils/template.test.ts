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

import { definitions } from '@salto-io/adapter-components'
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { addSpaceKey } from '../../../src/definitions/utils'

describe('template definitions utils', () => {
  let item: definitions.GeneratedItem<definitions.ContextParams & definitions.deploy.ChangeAndContext, unknown>
  describe('addSpaceKey', () => {
    beforeEach(() => {
      const change = toChange({
        after: new InstanceElement('aaa', new ObjectType({ elemID: new ElemID('salto', 'type') }), {
          something: 'else',
        }),
      })
      item = {
        typeName: 'mockType',
        context: {
          additionalContext: {
            space_key: 'KEY',
          },
          change,
          changeGroup: {
            groupID: 'a',
            changes: [change],
          },
          elementSource: buildElementsSourceFromElements([]),
          sharedContext: {},
        },
        value: { something: 'else' },
      }
    })
    it('should add space key from additionalContext', () => {
      expect(addSpaceKey(item).value).toEqual({ something: 'else', space: { key: 'KEY' } })
    })
    it('should add an empty object if space key does not exist', () => {
      item.context.additionalContext = {}
      expect(addSpaceKey(item).value).toEqual({ something: 'else', space: { key: undefined } })
    })
  })
})
