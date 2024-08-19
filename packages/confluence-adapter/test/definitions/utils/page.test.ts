/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import {
  putHomepageIdInAdditionContext,
  homepageAdditionToModification,
  createAdjustUserReferences,
  adjustPageOnModification,
  adjustUserReferencesOnPageReverse,
} from '../../../src/definitions/utils'

describe('page definitions utils', () => {
  const pageObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, PAGE_TYPE_NAME) })
  const pageChange = toChange({ after: new InstanceElement('mockPageName', pageObjectType, { id: 'mockPageId' }) })
  const spaceObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, SPACE_TYPE_NAME) })
  const spaceChange = toChange({
    after: new InstanceElement('mockSpaceName', spaceObjectType, { id: 'mockSpaceId' }),
  })
  describe('adjustPageOnModification', () => {
    describe('updateHomepageId', () => {
      it('should do nothing if there is no space change in the change group', async () => {
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
        expect((await adjustPageOnModification(args)).value.id).toEqual('mockPageId')
      })
      it('should do nothing if there is no homepageId in the shared context', async () => {
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
        expect((await adjustPageOnModification(args)).value.id).toEqual('mockPageId')
      })
      it('should modify id when homepage id is found in the shared context', async () => {
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
        expect((await adjustPageOnModification(args)).value.id).toEqual('homepageId')
      })
    })
    describe('adjustUserReferencesOnPageReverse', () => {
      it('should adjust user references on page', async () => {
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
          value: {
            authorId: { accountId: 'authorId', displayName: 'authorId' },
            ownerId: { accountId: 'ownerId', displayName: 'ownerId' },
            notUser: 'not',
          },
        }
        expect((await adjustUserReferencesOnPageReverse(args)).value).toEqual({
          authorId: 'authorId',
          ownerId: 'ownerId',
          notUser: 'not',
        })
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
  describe('putHomepageIdInAdditionContext', () => {
    it('should return empty object if there is no space change in the change group', () => {
      const args = {
        change: pageChange,
        changeGroup: {
          changes: [pageChange],
          groupID: 'group-id',
        },
        elementSource: buildElementsSourceFromElements([]),
        sharedContext: {
          [getChangeData(spaceChange).elemID.getFullName()]: { id: 'homepageId' },
        },
      }
      expect(putHomepageIdInAdditionContext(args)).toEqual({})
    })
    it('should return empty object if there is no homepageId in the shared context', () => {
      const args = {
        change: pageChange,
        changeGroup: {
          changes: [spaceChange],
          groupID: 'group-id',
        },
        elementSource: buildElementsSourceFromElements([]),
        sharedContext: {},
      }
      expect(putHomepageIdInAdditionContext(args)).toEqual({})
    })
    it('should return homepageId in the shared context', () => {
      const args = {
        change: pageChange,
        changeGroup: {
          changes: [spaceChange],
          groupID: 'group-id',
        },
        elementSource: buildElementsSourceFromElements([]),
        sharedContext: {
          [getChangeData(spaceChange).elemID.getFullName()]: { id: 'homepageId' },
        },
      }
      expect(putHomepageIdInAdditionContext(args)).toEqual({ id: 'homepageId' })
    })
    describe('adjustUserReferencesOnPage', () => {
      it('should adjust user references on page', async () => {
        const args = {
          typeName: 'page',
          context: {},
          value: { authorId: 'authorId', ownerId: 'ownerId', notUser: 'not' },
        }
        const adjustUserReferencesOnPage = createAdjustUserReferences(PAGE_TYPE_NAME)
        expect((await adjustUserReferencesOnPage(args)).value).toEqual({
          authorId: { accountId: 'authorId', displayName: 'authorId' },
          ownerId: { accountId: 'ownerId', displayName: 'ownerId' },
          notUser: 'not',
        })
      })
    })
  })
})
