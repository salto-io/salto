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
import { ObjectType, ElemID, InstanceElement, toChange, getChangeData, isEqualElements } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import { FilterWith } from '../../src/filter_utils'
import { HTTPReadClientInterface, HTTPWriteClientInterface } from '../../src/client'
import { createElementQuery } from '../../src/fetch/query'
import { noPagination } from '../../src/fetch/request/pagination'
import { DeployArrayFieldFilterParams, deployArrayFieldsFilterCreator } from '../../src/filters'
import { DeployRequestEndpointDefinition } from '../../src/definitions/system/deploy'

describe('default deploy filter', () => {
  type FilterType = FilterWith<'deploy'>
  let filter: FilterType
  let client: MockInterface<HTTPReadClientInterface & HTTPWriteClientInterface>

  const PARENT_TYPE_NAME = 'parentTestType'
  const FIELD_NAME_1 = 'testFieldName1'
  const FIELD_TYPE_NAME_1 = 'testFieldType1'
  const FIELD_NAME_2 = 'testFieldName2'
  const FIELD_TYPE_NAME_2 = 'testFieldType2'

  const mockValueMapper1 = jest.fn().mockImplementation(val => ({ id: val, name: val }))
  const mockValueMapper2 = jest.fn().mockImplementation(val => ({ id: val, name: val }))
  const filterParams: DeployArrayFieldFilterParams = {
    adapterName: 'test-adapter',
    parentTypeName: PARENT_TYPE_NAME,
    arrayFields: [
      {
        fieldName: FIELD_NAME_1,
        fieldTypeName: 'testFieldType1',
        valueMapper: mockValueMapper1,
      },
      {
        fieldName: FIELD_NAME_2,
        fieldTypeName: 'testFieldType2',
        valueMapper: mockValueMapper2,
      },
    ],
  }

  const objectType = new ObjectType({ elemID: new ElemID('myAdapter', PARENT_TYPE_NAME) })

  beforeEach(async () => {
    jest.clearAllMocks()
    const mockAddRequest = {
      request: {
        endpoint: {
          path: '/something',
          method: 'post',
        },
      } as DeployRequestEndpointDefinition,
    }
    const mockModifyRequest = {
      request: {
        endpoint: {
          path: '/something',
          method: 'patch',
        },
      } as DeployRequestEndpointDefinition,
    }
    const mockRemoveRequest = {
      request: {
        endpoint: {
          path: '/something',
          method: 'delete',
        },
      } as DeployRequestEndpointDefinition,
    }

    client = {
      get: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['get']>(),
      put: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['put']>(),
      patch: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['patch']>(),
      post: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['post']>(),
      delete: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['delete']>(),
      head: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['head']>(),
      options: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['options']>(),
      getPageSize: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['getPageSize']>(),
    }
    filter = deployArrayFieldsFilterCreator({
      convertError: (_elemID, err) => err,
      ...filterParams,
    })({
      definitions: {
        clients: {
          default: 'main',
          options: {
            main: {
              httpClient: client,
              endpoints: {
                default: {
                  get: {
                    readonly: true,
                  },
                },
                customizations: {},
              },
            },
          },
        },
        pagination: {
          none: {
            funcCreator: noPagination,
          },
        },
        deploy: {
          instances: {
            customizations: {
              [PARENT_TYPE_NAME]: {
                requestsByAction: {
                  customizations: {
                    add: [mockAddRequest],
                    modify: [mockModifyRequest],
                  },
                },
              },
              [FIELD_TYPE_NAME_1]: {
                requestsByAction: {
                  customizations: {
                    add: [mockAddRequest],
                    remove: [mockRemoveRequest],
                  },
                },
              },
              [FIELD_TYPE_NAME_2]: {
                requestsByAction: {
                  customizations: {
                    add: [mockAddRequest],
                    remove: [mockRemoveRequest],
                  },
                },
              },
            },
          },
        },
      },
      elementSource: buildElementsSourceFromElements([]),
      config: {},
      fetchQuery: createElementQuery({
        include: [{ type: 'something' }],
        exclude: [],
      }),
      sharedContext: {},
    }) as FilterType
  })

  describe('deploy array fields filter', () => {
    it('should throw if deploy definitions are not found', async () => {
      await expect(() =>
        deployArrayFieldsFilterCreator({
          convertError: (_elemID, err) => err,
          ...filterParams,
        })({
          definitions: {
            clients: {
              default: 'main',
              options: {
                main: {
                  httpClient: client,
                  endpoints: {
                    default: {
                      get: {
                        readonly: true,
                      },
                    },
                    customizations: {},
                  },
                },
              },
            },
            pagination: {
              none: {
                funcCreator: noPagination,
              },
            },
          },
          elementSource: buildElementsSourceFromElements([]),
          config: {},
          fetchQuery: createElementQuery({
            include: [{ type: 'something' }],
            exclude: [],
          }),
          sharedContext: {},
        }).deploy?.([]),
      ).rejects.toThrow('could not find deploy definitions')
    })

    it('should throw if change group is not provided', async () => {
      await expect(() => filter.deploy([])).rejects.toThrow('change group not provided')
    })

    it('should return changeError and remove the malformed field from the applied changes when the field value is not an array', async () => {
      const changes = [
        toChange({
          after: new InstanceElement(
            'parentName',
            new ObjectType({ elemID: new ElemID('myAdapter', PARENT_TYPE_NAME) }),
            {
              [FIELD_NAME_1]: 'This is not an array',
              [FIELD_NAME_2]: ['This is actually an array'],
            },
          ),
        }),
      ]
      const res = await filter.deploy(changes, { changes, groupID: 'a' })
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect((getChangeData(res.deployResult.appliedChanges[0]) as InstanceElement).value[FIELD_NAME_1]).toBeUndefined()
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0].message).toEqual(
        "Failed to calculate diff for parentTestType:testFieldName1 myAdapter.parentTestType.instance.parentName, expected testFieldName1 to be an array, got [] and 'This is not an array'",
      )
    })

    it('should do nothing when the change is removal', async () => {
      const change = toChange({
        before: new InstanceElement(
          'parentName',
          new ObjectType({ elemID: new ElemID('myAdapter', PARENT_TYPE_NAME) }),
          {
            [FIELD_NAME_1]: ['This is an array'],
            [FIELD_NAME_2]: ['This is also an array'],
          },
        ),
      })
      const changes = [change]
      const res = await filter.deploy(changes, { changes, groupID: 'a' })
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect(isEqualElements(getChangeData(res.leftoverChanges[0]), getChangeData(change))).toBeTruthy()
    })

    it('should calculate the changes correctly and mark them as applied', async () => {
      const afterValues = {
        [FIELD_NAME_1]: ['This value did not change'],
        [FIELD_NAME_2]: ['This value was added'],
      }
      const change = toChange({
        before: new InstanceElement('parentName', objectType, {
          [FIELD_NAME_1]: ['This value did not change', 'This value was removed'],
        }),
        after: new InstanceElement('parentName', objectType, afterValues),
      })
      const changes = [change]
      const res = await filter.deploy(changes, { changes, groupID: 'a' })
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(isEqualElements(getChangeData(res.deployResult.appliedChanges[0]), getChangeData(change))).toBeTruthy()

      expect(mockValueMapper1).toHaveBeenCalledWith('This value did not change', expect.anything(), expect.anything())
      expect(mockValueMapper1).toHaveBeenCalledWith('This value was removed', expect.anything(), expect.anything())
      expect(mockValueMapper2).toHaveBeenCalledWith('This value was added', expect.anything(), expect.anything())

      // First call - modify the top level instance
      expect(client.patch).toHaveBeenCalledTimes(1)
      expect(client.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          data: afterValues,
        }),
      )

      // Then - modify each of the changed values in the array
      expect(client.post).toHaveBeenCalledTimes(1)
      expect(client.post).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { id: 'This value was added', name: 'This value was added' },
        }),
      )

      expect(client.delete).toHaveBeenCalledTimes(1)
      expect(client.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { id: 'This value was removed', name: 'This value was removed' },
        }),
      )
    })
  })
})
