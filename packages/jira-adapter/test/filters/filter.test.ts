/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  CORE_ANNOTATIONS,
  InstanceElement,
  toChange,
  BuiltinTypes,
  ObjectType,
  ElemID,
  Change,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { MockInterface } from '@salto-io/test-utils'
import { deployment, client as clientUtils } from '@salto-io/adapter-components'
import { createEmptyType, getFilterParams, mockClient } from '../utils'
import filtersFilter from '../../src/filters/filter'
import { Filter } from '../../src/filter'
import { FILTER_TYPE_NAME, JIRA } from '../../src/constants'
import JiraClient from '../../src/client/client'
import { getDefaultConfig, JiraConfig } from '../../src/config/config'

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

describe('filtersFilter', () => {
  let filter: Filter
  let type: ObjectType
  let connection: MockInterface<clientUtils.APIConnection>
  let client: JiraClient
  let config: JiraConfig

  beforeEach(async () => {
    const { connection: conn, client: cli, paginator } = mockClient()
    connection = conn
    client = cli
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    filter = filtersFilter(getFilterParams({ client, paginator, config }))
    type = new ObjectType({
      elemID: new ElemID(JIRA, FILTER_TYPE_NAME),
      fields: {
        owner: { refType: BuiltinTypes.STRING },
      },
    })
  })
  it('should turn owner field CREATABLE & UPDATEABLE annotations to true on fetch', async () => {
    await filter.onFetch?.([type])
    expect(type.fields.owner.annotations).toEqual({
      [CORE_ANNOTATIONS.UPDATABLE]: true,
      [CORE_ANNOTATIONS.CREATABLE]: true,
    })
  })
  it('should replace user field on pre deploy', async () => {
    const instance = new InstanceElement('instance', createEmptyType('Filter'), {
      sharePermissions: [
        {
          type: 'user',
          user: {
            id: 'someone',
          },
        },
        {
          type: 'user',
          user: {
            id: 'someone2',
          },
        },
      ],

      editPermissions: [
        {
          type: 'user',
          user: {
            id: 'noOne',
          },
        },
        {
          type: 'user',
          user: {
            id: 'noOne2',
          },
        },
      ],
    })
    await filter.preDeploy?.([toChange({ after: instance })])
    expect(instance.value.editPermissions).toEqual([
      {
        type: 'user',
        user: {
          accountId: {
            id: 'noOne',
          },
        },
      },
      {
        type: 'user',
        user: {
          accountId: {
            id: 'noOne2',
          },
        },
      },
    ])
    expect(instance.value.sharePermissions).toEqual([
      {
        type: 'user',
        user: {
          accountId: {
            id: 'someone',
          },
        },
      },
      {
        type: 'user',
        user: {
          accountId: {
            id: 'someone2',
          },
        },
      },
    ])
  })
  describe('deploy', () => {
    let change: Change<InstanceElement>
    const deployChangeMock = deployment.deployChange as jest.MockedFunction<typeof deployment.deployChange>
    const instance = new InstanceElement('instance', createEmptyType('Filter'), {
      id: '1',
      owner: '123',
    })

    beforeEach(() => {
      deployChangeMock.mockReset()
    })

    describe('addition', () => {
      beforeEach(() => {
        change = toChange({ after: instance })
      })
      it('should add the owner to the new instance', async () => {
        await filter.deploy?.([change])

        expect(deployChangeMock).toHaveBeenCalledWith({
          change,
          client,
          endpointDetails: getDefaultConfig({ isDataCenter: false }).apiDefinitions.types[FILTER_TYPE_NAME]
            .deployRequests,
          fieldsToIgnore: ['owner'],
        })

        expect(connection.put).toHaveBeenCalledWith(
          `/rest/api/3/filter/${instance.value.id}/owner`,
          {
            accountId: instance.value.owner,
          },
          undefined,
        )
      })
    })

    describe('modification', () => {
      let instanceBefore: InstanceElement
      beforeEach(() => {
        instanceBefore = instance.clone()
        change = toChange({ before: instanceBefore, after: instance })
      })
      it('should deploy owner when changed', async () => {
        instance.value.owner = '234'
        instance.value.description = 'test'

        await filter.deploy?.([change])

        expect(deployChangeMock).toHaveBeenCalledWith({
          change,
          client,
          endpointDetails: getDefaultConfig({ isDataCenter: false }).apiDefinitions.types[FILTER_TYPE_NAME]
            .deployRequests,
          fieldsToIgnore: ['owner'],
        })

        expect(connection.put).toHaveBeenCalledWith(
          `/rest/api/3/filter/${instance.value.id}/owner`,
          {
            accountId: instance.value.owner,
          },
          undefined,
        )
      })
    })
  })
  it('should return user field after deploy', async () => {
    const instance = new InstanceElement('instance', createEmptyType('Filter'), {
      sharePermissions: [
        {
          type: 'user',
          user: {
            accountId: {
              id: 'someone',
            },
          },
        },
        {
          type: 'user',
          user: {
            accountId: {
              id: 'someone2',
            },
          },
        },
      ],
      editPermissions: [
        {
          type: 'user',
          user: {
            accountId: {
              id: 'noOne',
            },
          },
        },
        {
          type: 'user',
          user: {
            accountId: {
              id: 'noOne2',
            },
          },
        },
      ],
    })
    await filter.onDeploy?.([toChange({ after: instance })])
    expect(instance.value.editPermissions).toEqual([
      {
        type: 'user',
        user: {
          id: 'noOne',
        },
      },
      {
        type: 'user',
        user: {
          id: 'noOne2',
        },
      },
    ])
    expect(instance.value.sharePermissions).toEqual([
      {
        type: 'user',
        user: {
          id: 'someone',
        },
      },
      {
        type: 'user',
        user: {
          id: 'someone2',
        },
      },
    ])
  })
  it('should do nothing if not a filter type', async () => {
    const instance = new InstanceElement('instance', createEmptyType('Other'), {
      editPermissions: [
        {
          type: 'user',
          user: {
            id: 'noOne',
          },
        },
        {
          type: 'user',
          user: {
            id: 'noOne2',
          },
        },
      ],
    })
    await filter.preDeploy?.([toChange({ after: instance })])
    expect(instance.value).toEqual({
      editPermissions: [
        {
          type: 'user',
          user: {
            id: 'noOne',
          },
        },
        {
          type: 'user',
          user: {
            id: 'noOne2',
          },
        },
      ],
    })
    const instance2 = new InstanceElement('instance2', createEmptyType('Other'), {
      editPermissions: [
        {
          type: 'user',
          user: {
            accountId: {
              id: 'noOne',
            },
          },
        },
        {
          type: 'user',
          user: {
            accountId: {
              id: 'noOne2',
            },
          },
        },
      ],
    })
    await filter.onDeploy?.([toChange({ after: instance2 })])
    expect(instance2.value).toEqual({
      editPermissions: [
        {
          type: 'user',
          user: {
            accountId: {
              id: 'noOne',
            },
          },
        },
        {
          type: 'user',
          user: {
            accountId: {
              id: 'noOne2',
            },
          },
        },
      ],
    })
  })
})
