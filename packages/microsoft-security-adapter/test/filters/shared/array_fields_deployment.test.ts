/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  ElemID,
  InstanceElement,
  toChange,
  getChangeData,
  isEqualElements,
  isSaltoElementError,
  SaltoElementError,
  ModificationChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { filterUtils, client as clientUtils, definitions, fetch } from '@salto-io/adapter-components'
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import { PAGINATION } from '../../../src/definitions/requests/pagination'
import { Options } from '../../../src/definitions/types'
import {
  DeployArrayFieldFilterParams,
  deployArrayFieldsFilterCreator,
} from '../../../src/filters/shared/array_fields_deployment'

type ClientInterface = clientUtils.HTTPReadClientInterface & clientUtils.HTTPWriteClientInterface

describe('deploy array fields filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  let client: MockInterface<ClientInterface>

  const TOP_LEVEL_TYPE_NAME = 'parentTestType'
  const FIELD_NAME = 'testFieldName'
  const FIELD_TYPE_NAME = 'testFieldType'

  const mockValueMapper = jest.fn().mockImplementation(val => ({ id: val, name: val }))
  const filterParams: DeployArrayFieldFilterParams = {
    topLevelTypeName: TOP_LEVEL_TYPE_NAME,
    fieldName: FIELD_NAME,
    fieldTypeName: FIELD_TYPE_NAME,
    valueMapper: mockValueMapper,
  }

  const objectType = new ObjectType({ elemID: new ElemID('myAdapter', TOP_LEVEL_TYPE_NAME) })

  let mockDefinitions: definitions.ApiDefinitions<Options>

  beforeEach(async () => {
    jest.clearAllMocks()
    const mockAddRequest = {
      request: {
        endpoint: {
          path: '/something',
          method: 'post',
        },
      } as definitions.deploy.DeployRequestEndpointDefinition,
    }
    const mockModifyRequest = {
      request: {
        endpoint: {
          path: '/something',
          method: 'patch',
        },
      } as definitions.deploy.DeployRequestEndpointDefinition,
    }
    const mockRemoveRequest = {
      request: {
        endpoint: {
          path: '/something',
          method: 'delete',
        },
      } as definitions.deploy.DeployRequestEndpointDefinition,
    }

    client = {
      get: mockFunction<ClientInterface['get']>(),
      put: mockFunction<ClientInterface['put']>(),
      patch: mockFunction<ClientInterface['patch']>(),
      post: mockFunction<ClientInterface['post']>(),
      delete: mockFunction<ClientInterface['delete']>(),
      head: mockFunction<ClientInterface['head']>(),
      options: mockFunction<ClientInterface['options']>(),
      getPageSize: mockFunction<ClientInterface['getPageSize']>(),
    }
    mockDefinitions = {
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
      pagination: PAGINATION,
      deploy: {
        instances: {
          customizations: {
            [TOP_LEVEL_TYPE_NAME]: {
              requestsByAction: {
                customizations: {
                  add: [mockAddRequest],
                  modify: [mockModifyRequest],
                },
              },
            },
            [FIELD_TYPE_NAME]: {
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
    }
    filter = deployArrayFieldsFilterCreator(filterParams)({
      definitions: mockDefinitions,
      elementSource: buildElementsSourceFromElements([]),
      config: {},
      fetchQuery: fetch.query.createElementQuery({
        include: [{ type: 'something' }],
        exclude: [],
      }),
      sharedContext: {},
    }) as FilterType
  })

  it('should return SaltoError if the deploy definitions are missing', async () => {
    const res = await (
      deployArrayFieldsFilterCreator(filterParams)({
        definitions: {
          ...mockDefinitions,
          deploy: undefined,
        },
        elementSource: buildElementsSourceFromElements([]),
        config: {},
        fetchQuery: fetch.query.createElementQuery({
          include: [{ type: 'something' }],
          exclude: [],
        }),
        sharedContext: {},
      }) as FilterType
    ).deploy([], { changes: [], groupID: 'a' })
    expect(res.deployResult.errors).toHaveLength(1)
    expect(res.deployResult.errors[0].message).toEqual('Deploy not supported')
    expect(res.deployResult.errors[0].severity).toEqual('Error')
    expect(res.deployResult.appliedChanges).toHaveLength(0)
  })

  it('Should return SaltoError if the changeGroup is not provided', async () => {
    const res = await filter.deploy([])
    expect(res.deployResult.errors).toHaveLength(1)
    expect(res.deployResult.errors[0].message).toEqual('Deploy not supported')
    expect(res.deployResult.errors[0].severity).toEqual('Error')
    expect(res.deployResult.appliedChanges).toHaveLength(0)
  })

  it('should return SaltoElementError and no appliedChanges if the field is not an array', async () => {
    const instance = new InstanceElement(
      'parentName',
      new ObjectType({ elemID: new ElemID('myAdapter', TOP_LEVEL_TYPE_NAME) }),
      {
        [FIELD_NAME]: 'This is not an array',
      },
    )
    const changes = [toChange({ after: instance })]
    const res = await filter.deploy(changes, { changes, groupID: 'a' })
    expect(res.deployResult.errors).toHaveLength(1)
    expect(isSaltoElementError(res.deployResult.errors[0])).toEqual(true)
    expect((res.deployResult.errors[0] as SaltoElementError).elemID).toEqual(instance.elemID)
    expect(res.deployResult.errors[0].message).toEqual('Invalid format: expected testFieldName to be an array')
    expect(res.deployResult.errors[0].severity).toEqual('Error')
    expect(res.deployResult.appliedChanges).toHaveLength(0)
  })

  it('should return SaltoElementError and no appliedChanges if the change is modification and the before field is not an array', async () => {
    const elemID = new ElemID('myAdapter', TOP_LEVEL_TYPE_NAME)
    const instanceBefore = new InstanceElement('parentName', new ObjectType({ elemID }), {
      [FIELD_NAME]: 'This is not an array',
    })
    const instanceAfter = new InstanceElement('parentName', new ObjectType({ elemID }), {
      [FIELD_NAME]: ['This is an array'],
    })
    const changes = [toChange({ before: instanceBefore, after: instanceAfter })]
    const res = await filter.deploy(changes, { changes, groupID: 'a' })
    expect(res.deployResult.errors).toHaveLength(1)
    expect(isSaltoElementError(res.deployResult.errors[0])).toEqual(true)
    expect((res.deployResult.errors[0] as SaltoElementError).elemID).toEqual(instanceAfter.elemID)
    expect(res.deployResult.errors[0].message).toEqual('Invalid format: expected testFieldName to be an array')
    expect(res.deployResult.errors[0].severity).toEqual('Error')
    expect(res.deployResult.appliedChanges).toHaveLength(0)
  })

  it('should do nothing when the change is removal', async () => {
    const change = toChange({
      before: new InstanceElement(
        'parentName',
        new ObjectType({ elemID: new ElemID('myAdapter', TOP_LEVEL_TYPE_NAME) }),
        {
          [FIELD_NAME]: ['This is an array'],
        },
      ),
    })
    const changes = [change]
    const res = await filter.deploy(changes, { changes, groupID: 'a' })
    expect(res.deployResult.appliedChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.leftoverChanges).toHaveLength(1)
    expect(isEqualElements(getChangeData(res.leftoverChanges[0]), getChangeData(change))).toEqual(true)
  })

  it('should calculate the changes correctly and return the top level change as applied', async () => {
    const beforeValues = {
      [FIELD_NAME]: ['This value did not change', 'This value was removed'],
    }
    const afterValues = {
      [FIELD_NAME]: ['This value did not change', 'This value was added'],
    }
    const change = toChange({
      before: new InstanceElement('parentName', objectType, beforeValues),
      after: new InstanceElement('parentName', objectType, afterValues),
    })
    const changes = [change]
    const res = await filter.deploy(changes, { changes, groupID: 'a' })
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(isEqualElements(getChangeData(res.deployResult.appliedChanges[0]), getChangeData(change))).toEqual(true)

    expect(mockValueMapper).toHaveBeenCalledWith('This value did not change', expect.anything(), expect.anything())
    expect(mockValueMapper).toHaveBeenCalledWith('This value was removed', expect.anything(), expect.anything())
    expect(mockValueMapper).toHaveBeenCalledWith('This value was added', expect.anything(), expect.anything())

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

  it('should return an adjusted change and no errors (partial success) when some of the array changes fail to be added', async () => {
    const beforeInstance = new InstanceElement('parentName', objectType, {
      [FIELD_NAME]: ['This value did not change', 'This value was removed'],
    })
    const afterInstance = new InstanceElement('parentName', objectType, {
      [FIELD_NAME]: ['This value did not change', 'This value was added'],
    })
    const change = toChange({
      before: beforeInstance.clone(),
      after: afterInstance.clone(),
    })
    const changes = [change]

    client.post.mockImplementationOnce(() => Promise.reject(new Error('Failed to add')))
    const res = await filter.deploy(changes, { changes, groupID: 'a' })
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(isEqualElements(getChangeData(res.deployResult.appliedChanges[0]), afterInstance)).toEqual(false)
    expect(
      (res.deployResult.appliedChanges[0] as ModificationChange<InstanceElement>).data.after.value[FIELD_NAME],
    ).toEqual(['This value did not change'])
  })

  it('should return an adjusted change and no errors (partial success) when some of the array changes fail to be deleted', async () => {
    const beforeInstance = new InstanceElement('parentName', objectType, {
      [FIELD_NAME]: ['This value did not change', 'This value was removed'],
    })
    const afterInstance = new InstanceElement('parentName', objectType, {
      [FIELD_NAME]: ['This value did not change', 'This value was added'],
    })
    const change = toChange({
      before: beforeInstance.clone(),
      after: afterInstance.clone(),
    })
    const changes = [change]

    client.delete.mockImplementationOnce(() => Promise.reject(new Error('Failed to delete')))
    const res = await filter.deploy(changes, { changes, groupID: 'a' })
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(isEqualElements(getChangeData(res.deployResult.appliedChanges[0]), afterInstance)).toEqual(false)
    expect(
      (res.deployResult.appliedChanges[0] as ModificationChange<InstanceElement>).data.after.value[FIELD_NAME],
    ).toEqual(['This value did not change', 'This value was added', 'This value was removed'])
  })

  it('should not attempt deploying the array field if the top level change deployment fails', async () => {
    const beforeInstance = new InstanceElement('parentName', objectType, {
      [FIELD_NAME]: ['This value did not change', 'This value was removed'],
    })
    const afterInstance = new InstanceElement('parentName', objectType, {
      [FIELD_NAME]: ['This value did not change', 'This value was added'],
    })
    const change = toChange({
      before: beforeInstance.clone(),
      after: afterInstance.clone(),
    })
    const changes = [change]

    client.patch.mockImplementationOnce(() => Promise.reject(new Error('Failed to modify the top level instance')))
    const res = await filter.deploy(changes, { changes, groupID: 'a' })
    expect(res.deployResult.appliedChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(1)
    expect(res.deployResult.errors[0].message).toEqual('Failed to modify the top level instance')
    expect(res.deployResult.errors[0].severity).toEqual('Error')
    expect(client.post).not.toHaveBeenCalled()
    expect(client.delete).not.toHaveBeenCalled()
  })
})
