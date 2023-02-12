/*
*                      Copyright 2023 Salto Labs Ltd.
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

import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { organizationExistenceValidator } from '../../src/change_validators'
import { ZENDESK } from '../../src/constants'
import { SLA_POLICY_TYPE_NAME } from '../../src/filters/sla_policy'
import ZendeskClient from '../../src/client/client'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'

const paginatorMock = jest.fn()
jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    client: {
      ...actual.client,
      createPaginator: () => paginatorMock,
    },
  }
})

describe('OrganizationExistence', () => {
  const slaType = new ObjectType({ elemID: new ElemID(ZENDESK, SLA_POLICY_TYPE_NAME) })
  const triggerType = new ObjectType({ elemID: new ElemID(ZENDESK, 'trigger') })

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const createOrgsList = (ids = true) => ({
    all: [
      {
        field: 'organization_id',
        operator: 'is',
        value: ids ? 1 : 'one',
      },
      {
        field: 'organization_id',
        operator: 'is',
        value: ids ? 2 : 'two',
      },
      {
        field: 'organization_id',
        operator: 'is',
        value: ids ? 3 : 'three',
      },
      {
        field: 'organization_id',
        operator: 'is',
        value: ids ? 4 : 'four',
      },
      {
        field: 'organization_id',
        operator: 'is',
        value: ids ? 4 : 'four', // Twice to make sure it is not duplicated in the error message
      },
    ],
  })

  const createSlaInstance = (ids = true): InstanceElement => new InstanceElement(
    'sla',
    slaType,
    { filter: createOrgsList(ids) }
  )

  const createTriggerInstance = (ids = true): InstanceElement => new InstanceElement(
    'trigger',
    triggerType,
    { conditions: createOrgsList(ids) }
  )

  const client = new ZendeskClient({ credentials: { username: 'a', password: 'b', subdomain: 'ignore' } })
  const getSinglePageMock = jest.fn()
  client.getSinglePage = getSinglePageMock

  it('should return an error if the organization does not exist, with resolved Ids', async () => {
    const fetchConfig = { ...DEFAULT_CONFIG[FETCH_CONFIG], resolveOrganizationIDs: true }
    const validator = organizationExistenceValidator(client, fetchConfig)
    paginatorMock.mockReturnValue([{ organizations: [{ id: 1, name: 'one' }, { id: 2, name: 'two' }] }])

    const slaInstance = createSlaInstance(false)
    const triggerInstance = createTriggerInstance(false)

    const changes = [
      toChange({ after: slaInstance }),
      toChange({ before: triggerInstance, after: triggerInstance }),
      toChange({ before: slaInstance }), // Should do nothing because we don't care about removals
    ]

    const errors = await validator(changes)
    expect(errors).toMatchObject([
      {
        elemID: slaInstance.elemID,
        severity: 'Error',
        message: 'Referenced organizations do not exist',
        detailedMessage: 'The following referenced organizations do not exist: three, four',
      },
      {
        elemID: triggerInstance.elemID,
        severity: 'Error',
        message: 'Referenced organizations do not exist',
        detailedMessage: 'The following referenced organizations do not exist: three, four',
      },
    ])
  })

  it('should return an error if the organization does not exist, and request all orgs in one request, with unresolved Ids', async () => {
    const validator = organizationExistenceValidator(client, DEFAULT_CONFIG[FETCH_CONFIG])
    getSinglePageMock.mockReturnValue({ data: { organizations: [{ id: 1, name: 'one' }, { id: 2, name: 'two' }] } })

    const slaInstance = createSlaInstance()
    const triggerInstance = createTriggerInstance()

    const changes = [
      toChange({ after: slaInstance }),
      toChange({ before: triggerInstance, after: triggerInstance }),
      toChange({ before: slaInstance }), // Should do nothing because we don't care about removals
    ]

    const errors = await validator(changes)
    expect(errors).toMatchObject([
      {
        elemID: slaInstance.elemID,
        severity: 'Error',
        message: 'Referenced organizations do not exist',
        detailedMessage: 'The following referenced organizations do not exist: 3, 4',
      },
      {
        elemID: triggerInstance.elemID,
        severity: 'Error',
        message: 'Referenced organizations do not exist',
        detailedMessage: 'The following referenced organizations do not exist: 3, 4',
      },
    ])
    expect(getSinglePageMock).toHaveBeenCalledTimes(1)
  })
})
