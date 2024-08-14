/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { increaseVersion } from '../../../src/definitions/utils/version'
import { ADAPTER_NAME } from '../../../src/constants'

describe('version utils', () => {
  const type = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'mock type') })
  const change = toChange({ after: new InstanceElement('mockName', type, { id: 'mockId' }) })
  describe('increaseVersion', () => {
    it('should increase version number', async () => {
      const args = {
        typeName: 'mockType',
        context: {
          elementSource: buildElementsSourceFromElements([]),
          changeGroup: {
            changes: [],
            groupID: 'group-id',
          },
          sharedContext: {},
          change,
        },
        value: { version: { number: 1 } },
      }
      expect((await increaseVersion(args)).value.version.number).toEqual(2)
    })

    it('should return version = 2 if the version number is not a number (homepage addition case)', async () => {
      const args = {
        typeName: 'mockType',
        context: {
          elementSource: buildElementsSourceFromElements([]),
          changeGroup: {
            changes: [],
            groupID: 'group-id',
          },
          sharedContext: {},
          change,
        },
        value: { version: { number: 'not a number' } },
      }
      expect((await increaseVersion(args)).value.version).toEqual({ number: 2 })
    })
  })
})
