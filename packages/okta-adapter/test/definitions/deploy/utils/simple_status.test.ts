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

import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { toActionNames } from '../../../../src/definitions/deploy/utils/simple_status'
import { NETWORK_ZONE_TYPE_NAME } from '../../../../src/constants'

describe('simple_status', () => {
  const type = new ObjectType({
    elemID: new ElemID('salto', NETWORK_ZONE_TYPE_NAME),
  })
  const activeInst = new InstanceElement('instance', type, { status: 'ACTIVE' })
  const inactiveInst = new InstanceElement('instance', type, { status: 'INACTIVE' })

  describe('toActionNames', () => {
    describe('addition change', () => {
      const additionChange = toChange({ after: activeInst })
      it('should return the correct action names', () => {
        expect(
          toActionNames({
            change: additionChange,
            sharedContext: {},
            changeGroup: { groupID: 'groupID', changes: [additionChange] },
            elementSource: buildElementsSourceFromElements([]),
          }),
        ).toEqual(['add', 'deactivate', 'activate'])
      })
    })

    describe('modification change', () => {
      describe('activation change', () => {
        const activationChange = toChange({ before: inactiveInst, after: activeInst })
        it('should return the correct action names', () => {
          expect(
            toActionNames({
              change: activationChange,
              sharedContext: {},
              changeGroup: { groupID: 'groupID', changes: [activationChange] },
              elementSource: buildElementsSourceFromElements([]),
            }),
          ).toEqual(['modify', 'activate'])
        })
      })
      describe('deactivation change', () => {
        const deactivationChange = toChange({ before: activeInst, after: inactiveInst })
        it('should return the correct action names', () => {
          expect(
            toActionNames({
              change: deactivationChange,
              sharedContext: {},
              changeGroup: { groupID: 'groupID', changes: [deactivationChange] },
              elementSource: buildElementsSourceFromElements([]),
            }),
          ).toEqual(['deactivate', 'modify'])
        })
      })
      describe('no status change', () => {
        const change = toChange({ before: activeInst, after: activeInst })
        it('should return the correct action names', () => {
          expect(
            toActionNames({
              change,
              sharedContext: {},
              changeGroup: { groupID: 'groupID', changes: [change] },
              elementSource: buildElementsSourceFromElements([]),
            }),
          ).toEqual(['modify'])
        })
      })
    })
    describe('removal change', () => {
      const removalChange = toChange({ before: activeInst })
      it('should return the correct action names', () => {
        expect(
          toActionNames({
            change: removalChange,
            sharedContext: {},
            changeGroup: { groupID: 'groupID', changes: [removalChange] },
            elementSource: buildElementsSourceFromElements([]),
          }),
        ).toEqual(['remove'])
      })
    })
  })
})
