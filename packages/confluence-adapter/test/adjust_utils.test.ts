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

import { adjustLabelsToIdsFunc } from '../src/definitions/adjust_utils'

describe('Adjust utils', () => {
  describe('adjustLabelsToIdsFunc', () => {
    it('should return the same item if labels is not an array', () => {
      const item = {
        typeName: 'mockType',
        context: {},
        value: { labels: 'not an array' },
      }
      expect(adjustLabelsToIdsFunc(item)).toEqual(item)
    })

    it('should return the same item if labels is empty', () => {
      const item = {
        typeName: 'mockType',
        context: {},
        value: { labels: [] },
      }
      expect(adjustLabelsToIdsFunc(item)).toEqual(item)
    })

    it('should return the item with labels as ids', () => {
      const item = {
        typeName: 'mockType',
        context: {},
        value: { labels: [{ id: 'label1' }, { id: 'label2' }] },
      }
      expect(adjustLabelsToIdsFunc(item).value).toEqual({ labels: ['label1', 'label2'] })
    })
  })
})
