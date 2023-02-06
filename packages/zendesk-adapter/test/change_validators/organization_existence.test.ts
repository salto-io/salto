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

const getOrganizationsByNamesMock = jest.fn()
jest.mock('../../src/filters/organizations', () => {
  const actual = jest.requireActual('../../src/filters/organizations')
  return {
    ...actual,
    getOrganizationsByNames: jest.fn(() => getOrganizationsByNamesMock()),
  }
})

describe('OrganizationExistence', () => {
  const slaType = new ObjectType({ elemID: new ElemID(ZENDESK, SLA_POLICY_TYPE_NAME) })
  const triggerType = new ObjectType({ elemID: new ElemID(ZENDESK, 'trigger') })

  const slaInstance = new InstanceElement(
    'sla',
    slaType,
    {
      filter: {
        all: [
          {
            field: 'organization_id',
            operator: 'is',
            value: 'one',
          },
          {
            field: 'organization_id',
            operator: 'is',
            value: 'two',
          },
          {
            field: 'organization_id',
            operator: 'is',
            value: 'three',
          },
          {
            field: 'organization_id',
            operator: 'is',
            value: 'four',
          },
        ],
      },
    }
  )

  const triggerInstance = new InstanceElement(
    'trigger',
    triggerType,
    {
      conditions: {
        all: [
          {
            field: 'organization_id',
            operator: 'is',
            value: 'one',
          },
          {
            field: 'organization_id',
            operator: 'is',
            value: 'two',
          },
          {
            field: 'organization_id',
            operator: 'is',
            value: 'three',
          },
          {
            field: 'organization_id',
            operator: 'is',
            value: 'four',
          },
        ],
      },
    }
  )

  const changes = [
    toChange({ after: slaInstance }),
    toChange({ before: triggerInstance, after: triggerInstance }),
    toChange({ before: slaInstance }), // Should do nothing because we don't care about removals
  ]

  const client = new ZendeskClient({ credentials: { username: 'a', password: 'b', subdomain: 'ignore' } })
  const validator = organizationExistenceValidator(client)
  getOrganizationsByNamesMock.mockResolvedValue([{ name: 'one' }, { name: 'two' }])

  it('should return an error if the organization does not exist, and cache the results of the existence check', async () => {
    const errors = await validator(changes)
    expect(errors).toMatchObject([
      {
        elemID: slaInstance.elemID,
        severity: 'Error',
        message: 'Referenced organizations do not exist',
        detailedMessage: `Unable to deploy ${slaInstance.elemID.name} because it refers to the following organizations that do not exist: three, four`,
      },
      {
        elemID: triggerInstance.elemID,
        severity: 'Error',
        message: 'Referenced organizations do not exist',
        detailedMessage: `Unable to deploy ${triggerInstance.elemID.name} because it refers to the following organizations that do not exist: three, four`,
      },
    ])
    // First call returns 'one' and 'two'
    // Second call returns 'three'
    // Third call returns 'four'
    // triggerInstance called are all cached
    expect(getOrganizationsByNamesMock).toHaveBeenCalledTimes(3)
  })
})
