/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  Field,
  InstanceElement,
  ListType,
  MapType,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { deployment, filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../../utils'
import { getDefaultConfig } from '../../../src/config/config'
import { JIRA } from '../../../src/constants'
import fieldsDeploymentFilter from '../../../src/filters/fields/field_deployment_filter'
import JiraClient from '../../../src/client/client'
import * as contexts from '../../../src/filters/fields/contexts'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn(),
    },
  }
})

describe('fields_deployment', () => {
  let filter: filterUtils.FilterWith<'deploy'>
  let fieldType: ObjectType
  let contextType: ObjectType

  const deployChangeMock = deployment.deployChange as jest.MockedFunction<typeof deployment.deployChange>
  let client: JiraClient
  let paginator: clientUtils.Paginator
  const deployContextChangeMock = jest.spyOn(contexts, 'deployContextChange')
  let mockConnection: MockInterface<clientUtils.APIConnection>

  beforeEach(() => {
    deployChangeMock.mockClear()
    deployContextChangeMock.mockClear()

    const mockCli = mockClient()
    client = mockCli.client
    paginator = mockCli.paginator
    mockConnection = mockCli.connection

    filter = fieldsDeploymentFilter(
      getFilterParams({
        client,
        paginator,
      }),
    ) as typeof filter

    contextType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME),
    })

    fieldType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_TYPE_NAME),
      fields: {
        contexts: { refType: new ListType(contextType) },
      },
    })
  })
  it('should call deployChange', async () => {
    const instance = new InstanceElement('instance', fieldType, {})

    const change = toChange({ after: instance })
    await filter.deploy([change])
    expect(deployChangeMock).toHaveBeenCalledWith({
      change,
      client,
      endpointDetails: getDefaultConfig({ isDataCenter: false }).apiDefinitions.types.Field.deployRequests,
      fieldsToIgnore: ['contexts'],
    })
  })

  it('if an addition should remove default context', async () => {
    const instance = new InstanceElement('instance', fieldType, {
      id: 'field_1',
    })

    mockConnection.get.mockImplementation(async url => ({
      status: 200,
      data: {
        values: url === '/rest/api/3/field/field_1/context' ? [{ id: '4' }] : [],
      },
    }))

    const change = toChange({ after: instance })

    await filter.deploy([change])

    expect(deployContextChangeMock).toHaveBeenCalledWith({
      change: toChange({
        before: new InstanceElement(
          '4',
          contextType,
          {
            id: '4',
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(instance.elemID, instance)],
          },
        ),
      }),
      client,
      config: getDefaultConfig({ isDataCenter: false }),
    })
  })

  it('should throw if contexts is not a map', async () => {
    fieldType.fields.contexts = new Field(fieldType, 'contexts', BuiltinTypes.STRING)

    const instance = new InstanceElement('instance', fieldType, {
      id: 'field_1',
    })

    mockConnection.get.mockImplementation(async url => ({
      status: 200,
      data: {
        values: url === '/rest/api/3/field/field_1/contexts' ? [{ id: '4' }] : [],
      },
    }))

    const change = toChange({ after: instance })

    const res = await filter.deploy([change])
    expect(res.deployResult.errors).toHaveLength(1)
  })

  it('should throw if contexts inner type is not an object type', async () => {
    fieldType.fields.contexts = new Field(fieldType, 'contexts', new MapType(BuiltinTypes.STRING))

    const instance = new InstanceElement('instance', fieldType, {
      id: 'field_1',
    })

    mockConnection.get.mockImplementation(async url => ({
      status: 200,
      data: {
        values: url === '/rest/api/3/field/field_1/contexts' ? [{ id: '4' }] : [],
      },
    }))

    const change = toChange({ after: instance })

    const res = await filter.deploy([change])
    expect(res.deployResult.errors).toHaveLength(1)
  })
  describe('removal', () => {
    it('should not return an error if the response was recieved from a redirect of a field deletion', async () => {
      deployChangeMock.mockImplementation(async () => {
        throw new clientUtils.HTTPError('error', { data: {}, status: 401, requestPath: '/rest/api/3/task/1000' })
      })
      const instance = new InstanceElement('instance', fieldType, {
        id: 'field_1',
      })
      const change = toChange({ before: instance })
      const res = await filter.deploy([change])
      expect(res.deployResult.errors).toHaveLength(0)
    })
    it('should return an error if the response is an error with status 401 but not a redirect', async () => {
      deployChangeMock.mockImplementation(async () => {
        throw new clientUtils.HTTPError('error', { data: {}, status: 401, requestPath: '/rest/api/3/field/1000' })
      })
      const instance = new InstanceElement('instance', fieldType, {
        id: 'field_1',
      })
      const change = toChange({ before: instance })
      const res = await filter.deploy([change])
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0]).toEqual({
        elemID: instance.elemID,
        message: 'Error: error',
        detailedMessage: 'Error: error',
        severity: 'Error',
      })
    })
    it('should return an error if the response does not contain a requestPath', async () => {
      deployChangeMock.mockImplementation(async () => {
        throw new clientUtils.HTTPError('error', { data: {}, status: 401 })
      })
      const instance = new InstanceElement('instance', fieldType, {
        id: 'field_1',
      })
      const change = toChange({ before: instance })
      const res = await filter.deploy([change])
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0]).toEqual({
        elemID: instance.elemID,
        message: 'Error: error',
        detailedMessage: 'Error: error',
        severity: 'Error',
      })
    })
  })
})
