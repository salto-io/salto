/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { adjustLabelsToIdsFunc } from '../../../src/definitions/utils'

describe('label definitions utils', () => {
  describe('adjustLabelsToIdsFunc', () => {
    it('should return the same value if labels is not an array', async () => {
      const item = {
        typeName: 'mockType',
        context: {},
        value: { labels: 'not an array' },
      }
      expect((await adjustLabelsToIdsFunc(item)).value).toEqual(item.value)
    })

    it('should return the same value if labels is empty', async () => {
      const item = {
        typeName: 'mockType',
        context: {},
        value: { labels: [] },
      }
      expect((await adjustLabelsToIdsFunc(item)).value).toEqual(item.value)
    })

    it('should return the value with labels as ids', async () => {
      const item = {
        typeName: 'mockType',
        context: {},
        value: { labels: [{ id: 'label1' }, { id: 'label2' }] },
      }
      expect((await adjustLabelsToIdsFunc(item)).value).toEqual({ labels: ['label1', 'label2'] })
    })
  })
})
