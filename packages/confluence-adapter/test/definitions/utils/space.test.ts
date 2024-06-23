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

import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import {
  createPermissionUniqueKey,
  isPermissionObject,
  restructurePermissionsAndCreateInternalIdMap,
  spaceChangeGroupWithItsHomepage,
  spaceMergeAndTransformAdjust,
  transformPermissionAndUpdateIdMap,
} from '../../../src/definitions/utils'
import { ADAPTER_NAME, SPACE_TYPE_NAME } from '../../../src/constants'

describe('space definitions utils', () => {
  const spaceObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, SPACE_TYPE_NAME) })
  const permissions = [
    {
      id: 'internalId1',
      principal: {
        type: 'type1',
        id: 'id1',
      },
      operation: {
        key: 'key1',
        targetType: 'targetType1',
      },
    },
    {
      id: 'internalId2',
      principal: {
        type: 'type2',
        id: 'id2',
      },
      operation: {
        key: 'key2',
        targetType: 'targetType2',
      },
    },
  ]

  describe('createPermissionUniqueKey', () => {
    it('should create a unique key for a permission object', () => {
      const permissionObject = {
        type: 'type',
        principalId: 'principalId',
        key: 'key',
        targetType: 'targetType',
      }
      const uniqueKey = createPermissionUniqueKey(permissionObject)
      expect(uniqueKey).toEqual('type_principalId_key_targetType')
    })
  })

  describe('isPermissionObject', () => {
    it('should return true for a valid permission object', () => {
      const permissionObject = {
        type: 'type',
        principalId: 'principalId',
        key: 'key',
        targetType: 'targetType',
      }
      const result = isPermissionObject(permissionObject)
      expect(result).toBe(true)
    })

    it('should return false for an invalid permission object', () => {
      const permissionObject = {
        type: 'type',
        principalId: 'principalId',
        key: 'key',
      }
      const result = isPermissionObject(permissionObject)
      expect(result).toBe(false)
    })
  })

  describe('transformPermissionAndUpdateIdMap', () => {
    describe('on fetch', () => {
      const permissionFromFetch = {
        id: 'internalId',
        principal: {
          type: 'type',
          id: 'id',
        },
        operation: {
          key: 'key',
          targetType: 'targetType',
        },
      }
      const permissionInternalIdMap: Record<string, string> = {}
      it('should return undefined when some attribute is not defined', () => {
        expect(
          transformPermissionAndUpdateIdMap(
            { ...permissionFromFetch, operation: undefined },
            permissionInternalIdMap,
            true,
          ),
        ).toBeUndefined()
      })
      it('should return undefined when there is no internal id', () => {
        expect(
          transformPermissionAndUpdateIdMap({ ...permissionFromFetch, id: undefined }, permissionInternalIdMap, true),
        ).toBeUndefined()
      })
      it('should return restructured permission and update the id map', () => {
        const result = transformPermissionAndUpdateIdMap(permissionFromFetch, permissionInternalIdMap, true)
        expect(result).toEqual({
          type: 'type',
          principalId: 'id',
          key: 'key',
          targetType: 'targetType',
        })
        expect(permissionInternalIdMap).toEqual({ type_id_key_targetType: 'internalId' })
      })
    })
    describe('on deploy', () => {
      const permissionFromFetch = {
        id: 'internalId',
        subject: {
          type: 'type',
          identifier: 'id',
        },
        operation: {
          key: 'key',
          target: 'target',
        },
      }
      const permissionInternalIdMap: Record<string, string> = {}
      it('should return undefined when some attribute is not defined', () => {
        expect(
          transformPermissionAndUpdateIdMap({ ...permissionFromFetch, operation: undefined }, permissionInternalIdMap),
        ).toBeUndefined()
      })
      it('should return undefined when there is no internal id', () => {
        expect(
          transformPermissionAndUpdateIdMap({ ...permissionFromFetch, id: undefined }, permissionInternalIdMap),
        ).toBeUndefined()
      })
      it('should return restructured permission and update the id map', () => {
        const result = transformPermissionAndUpdateIdMap(permissionFromFetch, permissionInternalIdMap)
        expect(result).toEqual({
          type: 'type',
          principalId: 'id',
          key: 'key',
          targetType: 'target',
        })
        expect(permissionInternalIdMap).toEqual({ type_id_key_target: 'internalId' })
      })
    })
  })

  describe('restructurePermissionsAndCreateInternalIdMap', () => {
    it('should do nothing when there is no permissions array', () => {
      const space = new InstanceElement('mock', spaceObjectType, { permissions: 'notArray' })
      const spaceClone = space.clone()
      restructurePermissionsAndCreateInternalIdMap(space.value)
      expect(spaceClone.value).toEqual(space.value)
    })
    it('should restructure permissions array and create an internal id map', () => {
      const space = new InstanceElement('mock', spaceObjectType, { permissions })
      const spaceClone = space.clone()
      restructurePermissionsAndCreateInternalIdMap(space.value)
      expect(spaceClone.value).not.toEqual(space.value)
      expect(space.value.permissions).toEqual([
        {
          type: 'type1',
          principalId: 'id1',
          key: 'key1',
          targetType: 'targetType1',
        },
        {
          type: 'type2',
          principalId: 'id2',
          key: 'key2',
          targetType: 'targetType2',
        },
      ])
      expect(space.value.permissionInternalIdMap).toEqual({
        type1_id1_key1_targetType1: 'internalId1',
        type2_id2_key2_targetType2: 'internalId2',
      })
    })
  })

  describe('spaceMergeAndTransformAdjust', () => {
    it('should adjust a space instance upon fetch', () => {
      const space = new InstanceElement('mock', spaceObjectType, { permissions })
      spaceMergeAndTransformAdjust({ value: space.value, context: { fragments: [] }, typeName: SPACE_TYPE_NAME })
      expect(space.value).toEqual({
        permissions: [
          {
            type: 'type1',
            principalId: 'id1',
            key: 'key1',
            targetType: 'targetType1',
          },
          {
            type: 'type2',
            principalId: 'id2',
            key: 'key2',
            targetType: 'targetType2',
          },
        ],
        permissionInternalIdMap: {
          type1_id1_key1_targetType1: 'internalId1',
          type2_id2_key2_targetType2: 'internalId2',
        },
      })
    })
  })

  describe('spaceChangeGroupWithItsHomepage', () => {
    const pageObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'page') })
    const homepageInstance = new InstanceElement('mockPageName', pageObjectType, { id: 'homepageId' })
    it('should return element full name when change is not instance change', async () => {
      const change = toChange({ after: spaceObjectType })
      expect(await spaceChangeGroupWithItsHomepage(change)).toEqual('confluence.space')
    })

    it('should return element full name when change is not addition change', async () => {
      const spaceInstance = new InstanceElement('mockSpaceName', spaceObjectType, {
        homepageId: new ReferenceExpression(homepageInstance.elemID),
      })
      const change = toChange({ before: spaceInstance })
      expect(await spaceChangeGroupWithItsHomepage(change)).toEqual('confluence.space.instance.mockSpaceName')
    })
    it('should return homepage full name when change is addition', async () => {
      const spaceInstance = new InstanceElement('mockName', spaceObjectType, {
        homepageId: new ReferenceExpression(homepageInstance.elemID),
      })
      const change = toChange({ after: spaceInstance })
      expect(await spaceChangeGroupWithItsHomepage(change)).toEqual('confluence.page.instance.mockPageName')
    })
  })
})
