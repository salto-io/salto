/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
    it('should add space key from additionalContext', async () => {
      expect((await addSpaceKey(item)).value).toEqual({ something: 'else', space: { key: 'KEY' } })
    })
    it('should add an empty object if space key does not exist', async () => {
      item.context.additionalContext = {}
      expect((await addSpaceKey(item)).value).toEqual({ something: 'else', space: { key: undefined } })
    })
  })
})
