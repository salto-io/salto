/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType, ElemID, toChange, ChangeGroup, InstanceElement, getChangeData } from '@salto-io/adapter-api'
import { definitions as definitionsUtils, fetch, filterUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import deploySpaceAndPermissions from '../../src/filters/deploy_space_and_permissions'
import { DEFAULT_CONFIG, UserConfig } from '../../src/config'
import { Options } from '../../src/definitions/types'
import { ADAPTER_NAME, SPACE_TYPE_NAME } from '../../src/constants'
import { createDeployDefinitions, createFetchDefinitions } from '../../src/definitions'

const mockDeployChanges = jest.fn()
const mockRequestAllForResource = jest.fn()
jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChanges: jest.fn((...args) => mockDeployChanges(...args)),
    },
    fetch: {
      ...actual.fetch,
      request: {
        ...actual.fetch.request,
        getRequester: jest.fn().mockReturnValue({
          requestAllForResource: jest.fn((...args) => mockRequestAllForResource(...args)),
        }),
      },
    },
  }
})

describe('deploySpaceAndPermissions', () => {
  let filter: filterUtils.Filter<filterUtils.FilterResult>
  const spaceObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, SPACE_TYPE_NAME) })
  const notSpaceObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'notSpace') })
  const notSpaceChange = toChange({ after: new InstanceElement('mock', notSpaceObjectType) })
  const fetchDef = createFetchDefinitions(DEFAULT_CONFIG)
  const deployDef = createDeployDefinitions()
  const mockChangeGroup = {} as ChangeGroup
  const mockDefinitions = {
    fetch: fetchDef,
    deploy: deployDef,
  } as definitionsUtils.ApiDefinitions<Options>
  const mockFilterArgs = {
    adapterName: ADAPTER_NAME,
    config: {} as UserConfig,
    elementSource: buildElementsSourceFromElements([]),
    sharedContext: {},
    fetchQuery: {} as fetch.query.ElementQuery,
    definitions: mockDefinitions,
  }

  describe('deploy', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })
    describe('when there is no fetch definitions', () => {
      beforeEach(() => {
        filter = deploySpaceAndPermissions(mockFilterArgs)({
          ...mockFilterArgs,
          definitions: { ...mockDefinitions, fetch: undefined },
        })
      })

      it('should should throw an error', async () => {
        await expect(filter.deploy?.([notSpaceChange], mockChangeGroup)).rejects.toThrow(
          'could not find space and space_permission definitions',
        )
      })
    })
    describe('when there is no deploy definitions', () => {
      beforeEach(() => {
        filter = deploySpaceAndPermissions(mockFilterArgs)({
          ...mockFilterArgs,
          definitions: { ...mockDefinitions, deploy: undefined },
        })
      })

      it('should should throw an error', async () => {
        await expect(filter.deploy?.([notSpaceChange], mockChangeGroup)).rejects.toThrow(
          'could not find space and space_permission definitions',
        )
      })
    })
    describe('when there is no changeGroup', () => {
      beforeEach(() => {
        filter = deploySpaceAndPermissions(mockFilterArgs)(mockFilterArgs)
      })

      it('should should throw an error', async () => {
        await expect(filter.deploy?.([notSpaceChange])).rejects.toThrow('change group not provided')
      })
    })
    describe('when deploy of the space throws an error', () => {
      const mockError = new Error('mock server error')
      beforeEach(() => {
        filter = deploySpaceAndPermissions(mockFilterArgs)(mockFilterArgs)
        mockDeployChanges.mockReturnValue({ errors: [new Error('mock server error')] })
      })
      it('should return errors as part of the deploy results and not deploy permissions', async () => {
        const spaceInstBefore = new InstanceElement('mock', spaceObjectType, { key: '111' })
        const spaceInstAfter = new InstanceElement('mock', spaceObjectType, { key: '222' })
        const modificationChange = toChange({ before: spaceInstBefore, after: spaceInstAfter })
        const res = await filter.deploy?.([notSpaceChange, modificationChange], mockChangeGroup)
        expect(mockDeployChanges).toHaveBeenCalledTimes(1)
        expect(res).toEqual({
          deployResult: { appliedChanges: [], errors: [mockError] },
          leftoverChanges: [notSpaceChange],
        })
      })
    })
    describe('modification change', () => {
      beforeEach(() => {
        filter = deploySpaceAndPermissions(mockFilterArgs)(mockFilterArgs)
        mockDeployChanges.mockReturnValue({
          appliedChanges: [
            toChange({
              after: new InstanceElement('moc', notSpaceObjectType, {
                id: 'superInternalId',
                subject: {
                  type: 'user',
                  identifier: 'will',
                },
                operation: {
                  key: 'be',
                  target: 'added',
                },
              }),
            }),
          ],
          errors: [],
        })
      })
      it('should deploy space the correct permissions diff', async () => {
        const spaceInstBefore = new InstanceElement('mock', spaceObjectType, {
          key: '111',
          permissionInternalIdMap: {
            group_to_stay: '1',
            user_be_removed: '2',
          },
          permissions: [
            {
              type: 'group',
              principalId: 'here',
              key: 'to',
              targetType: 'stay',
            },
            {
              type: 'user',
              principalId: 'will',
              key: 'be',
              targetType: 'removed',
            },
          ],
        })
        const spaceInstAfter = new InstanceElement('mock', spaceObjectType, {
          key: '222',
          permissionInternalIdMap: {
            group_to_stay: '1',
            user_be_removed: '2',
          },
          permissions: [
            {
              type: 'group',
              principalId: 'here',
              key: 'to',
              targetType: 'stay',
            },
            {
              type: 'user',
              principalId: 'will',
              key: 'be',
              targetType: 'added',
            },
          ],
        })
        const modificationChange = toChange({ before: spaceInstBefore, after: spaceInstAfter })
        const res = await filter.deploy?.([notSpaceChange, modificationChange], mockChangeGroup)
        expect(res).toEqual({
          deployResult: { appliedChanges: [modificationChange], errors: [] },
          leftoverChanges: [notSpaceChange],
        })
        expect(getChangeData(modificationChange).value.permissionInternalIdMap).toEqual({
          group_to_stay: '1',
          user_be_removed: '2',
          user_be_added: 'superInternalId',
        })
        expect(getChangeData(modificationChange).value.permissions).toEqual([
          {
            type: 'group',
            principalId: 'here',
            key: 'to',
            targetType: 'stay',
          },
          {
            type: 'user',
            principalId: 'will',
            key: 'be',
            targetType: 'added',
          },
        ])
        // one for space, one for delete permissions and one for add permissions
        expect(mockDeployChanges).toHaveBeenCalledTimes(3)
        expect(mockDeployChanges.mock.calls[0]).toEqual([
          expect.objectContaining({ changes: expect.arrayContaining([modificationChange]) }),
        ])
        expect(mockDeployChanges.mock.calls[1]).toEqual([
          expect.objectContaining({ changes: expect.arrayContaining([expect.objectContaining({ action: 'remove' })]) }),
        ])
        expect(mockDeployChanges.mock.calls[2]).toEqual([
          expect.objectContaining({ changes: expect.arrayContaining([expect.objectContaining({ action: 'add' })]) }),
        ])
      })
    })
    describe('addition change', () => {
      beforeEach(() => {
        filter = deploySpaceAndPermissions(mockFilterArgs)(mockFilterArgs)
        mockRequestAllForResource.mockReturnValue([
          {
            value: {
              id: 'addedDefaultPermissionInternalId',
              principal: {
                type: 'group',
                id: 'defaultPermission',
              },
              operation: {
                key: 'key',
                targetType: 'target',
              },
            },
          },
          {
            value: {
              id: 'removeDefaultPermissionInternalId',
              principal: {
                type: 'user',
                id: 'defaultPermission',
              },
              operation: {
                key: 'anotherKey',
                targetType: 'remove',
              },
            },
          },
        ])
        mockDeployChanges.mockReturnValue({
          appliedChanges: [
            toChange({
              after: new InstanceElement('moc', notSpaceObjectType, {
                id: 'superInternalId',
                subject: {
                  type: 'user',
                  identifier: 'will',
                },
                operation: {
                  key: 'be',
                  target: 'added',
                },
              }),
            }),
          ],
          errors: [],
        })
      })
      it('should deploy space and permissions, and delete unwanted default permissions created in the service', async () => {
        const spaceInstAfter = new InstanceElement('mock', spaceObjectType, {
          key: '222',
          permissions: [
            {
              type: 'group',
              principalId: 'here',
              key: 'to',
              targetType: 'stay',
            },
            {
              type: 'user',
              principalId: 'will',
              key: 'be',
              targetType: 'added',
            },
          ],
        })
        const additionChange = toChange({ after: spaceInstAfter })
        const res = await filter.deploy?.([notSpaceChange, additionChange], mockChangeGroup)
        expect(res).toEqual({
          deployResult: { appliedChanges: [additionChange], errors: [] },
          leftoverChanges: [notSpaceChange],
        })
        expect(getChangeData(additionChange).value.permissionInternalIdMap).toEqual({
          group_key_target: 'addedDefaultPermissionInternalId',
          user_be_added: 'superInternalId',
          user_anotherKey_remove: 'removeDefaultPermissionInternalId',
        })
        expect(getChangeData(additionChange).value.permissions).toEqual([
          {
            type: 'group',
            principalId: 'here',
            key: 'to',
            targetType: 'stay',
          },
          {
            type: 'user',
            principalId: 'will',
            key: 'be',
            targetType: 'added',
          },
        ])
        expect(mockRequestAllForResource).toHaveBeenCalledTimes(1)

        // one for space, one for delete permissions and one for add permissions
        expect(mockDeployChanges).toHaveBeenCalledTimes(3)
        expect(mockDeployChanges.mock.calls[0]).toEqual([
          expect.objectContaining({ changes: expect.arrayContaining([additionChange]) }),
        ])
        expect(mockDeployChanges.mock.calls[1]).toEqual([
          expect.objectContaining({
            changes: expect.arrayContaining([expect.objectContaining({ action: 'remove' })]),
          }),
        ])
        expect(mockDeployChanges.mock.calls[2]).toEqual([
          expect.objectContaining({ changes: expect.arrayContaining([expect.objectContaining({ action: 'add' })]) }),
        ])
      })
    })
  })
})
