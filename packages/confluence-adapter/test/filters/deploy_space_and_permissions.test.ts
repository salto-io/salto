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
import { ObjectType, ElemID, toChange, ChangeGroup, InstanceElement, getChangeData } from '@salto-io/adapter-api'
import { definitions as definitionsUtils, fetch, filterUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import deploySpaceAndPermissions from '../../src/filters/deploy_space_and_permissions'
import { UserConfig } from '../../src/config'
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
  const fetchDef = createFetchDefinitions()
  const deployDef = createDeployDefinitions()
  const mockChangeGroup = {} as ChangeGroup
  const mockDefinitions = {
    fetch: fetchDef,
    deploy: deployDef,
  } as definitionsUtils.ApiDefinitions<Options>
  const mockFilterArgs = {
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
                  type: 'will',
                  identifier: 'be',
                },
                operation: {
                  key: 'added',
                  target: 'yay',
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
            here_to_stay_yay: '1',
            will_be_removed_Oy: '2',
          },
          permissions: [
            {
              type: 'here',
              principalId: 'to',
              key: 'stay',
              targetType: 'yay',
            },
            {
              type: 'will',
              principalId: 'be',
              key: 'removed',
              targetType: 'Oy',
            },
          ],
        })
        const spaceInstAfter = new InstanceElement('mock', spaceObjectType, {
          key: '222',
          permissionInternalIdMap: {
            here_to_stay_yay: '1',
            will_be_removed_Oy: '2',
          },
          permissions: [
            {
              type: 'here',
              principalId: 'to',
              key: 'stay',
              targetType: 'yay',
            },
            {
              type: 'will',
              principalId: 'be',
              key: 'added',
              targetType: 'yay',
            },
          ],
        })
        const modificationChange = toChange({ before: spaceInstBefore, after: spaceInstAfter })
        const res = await filter.deploy?.([notSpaceChange, modificationChange], mockChangeGroup)
        expect(res).toEqual({
          deployResult: { appliedChanges: [modificationChange], errors: [] },
          leftoverChanges: [notSpaceChange],
        })
        expect((getChangeData(modificationChange) as InstanceElement).value.permissionInternalIdMap).toEqual({
          here_to_stay_yay: '1',
          will_be_removed_Oy: '2',
          will_be_added_yay: 'superInternalId',
        })
        expect((getChangeData(modificationChange) as InstanceElement).value.permissions).toEqual([
          {
            type: 'here',
            principalId: 'to',
            key: 'stay',
            targetType: 'yay',
          },
          {
            type: 'will',
            principalId: 'be',
            key: 'added',
            targetType: 'yay',
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
                type: 'default',
                id: 'permission',
              },
              operation: {
                key: 'to',
                targetType: 'stay',
              },
            },
          },
          {
            value: {
              id: 'removeDefaultPermissionInternalId',
              principal: {
                type: 'default',
                id: 'permission',
              },
              operation: {
                key: 'to',
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
                  type: 'will',
                  identifier: 'be',
                },
                operation: {
                  key: 'added',
                  target: 'yay',
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
              type: 'will',
              principalId: 'be',
              key: 'added',
              targetType: 'yay',
            },
            {
              type: 'default',
              principalId: 'permission',
              key: 'to',
              targetType: 'stay',
            },
          ],
        })
        const additionChange = toChange({ after: spaceInstAfter })
        const res = await filter.deploy?.([notSpaceChange, additionChange], mockChangeGroup)
        expect(res).toEqual({
          deployResult: { appliedChanges: [additionChange], errors: [] },
          leftoverChanges: [notSpaceChange],
        })
        expect((getChangeData(additionChange) as InstanceElement).value.permissionInternalIdMap).toEqual({
          default_permission_to_stay: 'addedDefaultPermissionInternalId',
          will_be_added_yay: 'superInternalId',
          default_permission_to_remove: 'removeDefaultPermissionInternalId',
        })
        expect((getChangeData(additionChange) as InstanceElement).value.permissions).toEqual([
          {
            type: 'will',
            principalId: 'be',
            key: 'added',
            targetType: 'yay',
          },
          {
            type: 'default',
            principalId: 'permission',
            key: 'to',
            targetType: 'stay',
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
