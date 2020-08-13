/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ObjectType } from '../src/elements'
import { ElemID } from '../src/element_id'
import { BuiltinTypes } from '../src/builtins'
import { isAdditionGroup, isRemovalGroup, isModificationGroup } from '../src/change_group'

describe('change group utils tests', () => {
  const objElemID = new ElemID('adapter', 'type')
  const obj = new ObjectType({
    elemID: objElemID,
    fields: { field: { type: BuiltinTypes.STRING } },
  })
  describe('isAdditionGroup', () => {
    it('should be true for all add group', () => {
      expect(isAdditionGroup({
        groupID: 'additionId',
        changes: [
          { action: 'add', data: { after: obj } },
          { action: 'add', data: { after: obj } },
        ],
      })).toBeTruthy()
    })

    it('should be false for mixed group', () => {
      expect(isAdditionGroup({
        groupID: 'mixedId',
        changes: [
          { action: 'add', data: { after: obj } },
          { action: 'remove', data: { before: obj } },
        ],
      })).toBeFalsy()
    })
  })

  describe('isRemovalGroup', () => {
    it('should be true for all remove group', () => {
      expect(isRemovalGroup({
        groupID: 'removalId',
        changes: [
          { action: 'remove', data: { before: obj } },
          { action: 'remove', data: { before: obj } },
        ],
      })).toBeTruthy()
    })

    it('should be false for mixed group', () => {
      expect(isRemovalGroup({
        groupID: 'mixedId',
        changes: [
          { action: 'add', data: { after: obj } },
          { action: 'remove', data: { before: obj } },
        ],
      })).toBeFalsy()
    })
  })

  describe('isModificationGroup', () => {
    it('should be true for all modify group', () => {
      expect(isModificationGroup({
        groupID: 'modificationId',
        changes: [
          { action: 'modify', data: { before: obj, after: obj } },
          { action: 'modify', data: { before: obj, after: obj } },
        ],
      })).toBeTruthy()
    })

    it('should be false for mixed group', () => {
      expect(isModificationGroup({
        groupID: 'additionId',
        changes: [
          { action: 'modify', data: { before: obj, after: obj } },
          { action: 'remove', data: { before: obj } },
        ],
      })).toBeFalsy()
    })
  })
})
