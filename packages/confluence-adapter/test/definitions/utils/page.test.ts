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

import {
  ElemID,
  getChangeData,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ADAPTER_NAME, PAGE_TYPE_NAME, SPACE_TYPE_NAME } from '../../../src/constants'
import { adjustPageOnModification, homepageAdditionToModification } from '../../../src/definitions/utils'

describe('page definitions utils', () => {
  const pageObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, PAGE_TYPE_NAME) })
  const pageChange = toChange({ after: new InstanceElement('mockPageName', pageObjectType, { id: 'mockPageId' }) })
  const spaceObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, SPACE_TYPE_NAME) })
  const spaceChange = toChange({
    after: new InstanceElement('mockSpaceName', spaceObjectType, { id: 'mockSpaceId' }),
  })
  describe('adjustPageOnModification', () => {
    describe('increasePageVersion', () => {
      it('should increase the page version number', () => {
        const args = {
          typeName: 'mockType',
          context: {
            elementSource: buildElementsSourceFromElements([]),
            changeGroup: {
              changes: [],
              groupID: 'group-id',
            },
            sharedContext: {},
            change: pageChange,
          },
          value: { version: { number: 1 } },
        }
        expect(adjustPageOnModification(args).value.version.number).toEqual(2)
      })

      it('should return the same value if the version number is not a number (should not happen)', () => {
        const args = {
          typeName: 'mockType',
          context: {
            elementSource: buildElementsSourceFromElements([]),
            changeGroup: {
              changes: [],
              groupID: 'group-id',
            },
            sharedContext: {},
            change: pageChange,
          },
          value: { version: { number: 'not a number' } },
        }
        expect(adjustPageOnModification(args).value).toEqual(args.value)
      })
    })
    describe('updateHomepageId', () => {
      it('should do nothing if there is no space change in the change group', () => {
        const args = {
          typeName: 'mockType',
          context: {
            elementSource: buildElementsSourceFromElements([]),
            changeGroup: {
              changes: [pageChange],
              groupID: 'group-id',
            },
            sharedContext: {},
            change: pageChange,
          },
          value: getChangeData(pageChange).value,
        }
        expect(adjustPageOnModification(args).value.id).toEqual('mockPageId')
      })
      it('should do nothing if there is no homepageId in the shared context', () => {
        const args = {
          typeName: 'mockType',
          context: {
            elementSource: buildElementsSourceFromElements([]),
            changeGroup: {
              changes: [pageChange, spaceChange],
              groupID: 'group-id',
            },
            sharedContext: {},
            change: pageChange,
          },
          value: getChangeData(pageChange).value,
        }
        expect(adjustPageOnModification(args).value.id).toEqual('mockPageId')
      })
      it('should modify id when homepage id is found in the shared context', () => {
        const args = {
          typeName: 'mockType',
          context: {
            elementSource: buildElementsSourceFromElements([]),
            changeGroup: {
              changes: [pageChange, spaceChange],
              groupID: 'group-id',
            },
            sharedContext: {
              [getChangeData(spaceChange).elemID.getFullName()]: { id: 'homepageId' },
            },
            change: pageChange,
          },
          value: getChangeData(pageChange).value,
        }
        expect(adjustPageOnModification(args).value.id).toEqual('homepageId')
      })
    })
  })
  describe('homepageAdditionToModification', () => {
    const differentSpaceInst = new InstanceElement('mockDifferentSpaceName', spaceObjectType, {
      id: 'differentSpaceId',
    })
    const pageChangeWithRefToDifferentSpace = toChange({
      after: new InstanceElement('mockPageName', pageObjectType, {
        spaceId: new ReferenceExpression(differentSpaceInst.elemID),
      }),
    })
    const pageChangeWithRefToSpace = toChange({
      after: new InstanceElement('mockPageName', pageObjectType, {
        spaceId: new ReferenceExpression(getChangeData(spaceChange).elemID),
      }),
    })
    it('should return the original action when there is no space change in the change group', () => {
      const args = {
        change: pageChange,
        changeGroup: {
          changes: [],
          groupID: 'group-id',
        },
        elementSource: buildElementsSourceFromElements([]),
        sharedContext: {},
      }
      expect(homepageAdditionToModification(args)).toEqual([pageChange.action])
    })
    it('should return the original action if page is not pointing to space change', () => {
      const args = {
        change: pageChange,
        changeGroup: {
          changes: [spaceChange],
          groupID: 'group-id',
        },
        elementSource: buildElementsSourceFromElements([]),
        sharedContext: {},
      }
      expect(homepageAdditionToModification(args)).toEqual([pageChange.action])
    })
    it('should return the original action if page is pointing to a different space instance', () => {
      const args = {
        change: pageChangeWithRefToDifferentSpace,
        changeGroup: {
          changes: [spaceChange],
          groupID: 'group-id',
        },
        elementSource: buildElementsSourceFromElements([]),
        sharedContext: {},
      }
      expect(homepageAdditionToModification(args)).toEqual([pageChangeWithRefToDifferentSpace.action])
    })
    it('should return the original action if page change is not addition', () => {
      const pageNotAdditionChange = toChange({ before: getChangeData(pageChangeWithRefToSpace) })
      const args = {
        change: pageNotAdditionChange,
        changeGroup: {
          changes: [spaceChange],
          groupID: 'group-id',
        },
        elementSource: buildElementsSourceFromElements([]),
        sharedContext: {},
      }
      expect(homepageAdditionToModification(args)).toEqual([pageNotAdditionChange.action])
    })
    it('should return the "modify" action', () => {
      const args = {
        change: pageChangeWithRefToSpace,
        changeGroup: {
          changes: [spaceChange],
          groupID: 'group-id',
        },
        elementSource: buildElementsSourceFromElements([]),
        sharedContext: {},
      }
      expect(homepageAdditionToModification(args)).toEqual(['modify'])
    })
  })
})
