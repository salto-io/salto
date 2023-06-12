
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

import { filterUtils } from '@salto-io/adapter-components'
import { ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator from '../../src/filters/ticket_form'
import { createFilterCreatorParams } from '../utils'
import { ACCOUNT_FEATURES_TYPE_NAME, TICKET_FORM_TYPE_NAME, ZENDESK } from '../../src/constants'

const mockDeployChange = jest.fn()
jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn((...args) => mockDeployChange(...args)),
    },
  }
})

const createElementSource = (customStatusesEnabled: boolean): ReadOnlyElementsSource => {
  const accountFeaturesType = new ObjectType({
    elemID: new ElemID(ZENDESK, ACCOUNT_FEATURES_TYPE_NAME),
  })
  const accountFeaturesInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    accountFeaturesType,
    {
      custom_statuses_enabled: {
        enabled: customStatusesEnabled,
      },
    },
  )
  return buildElementsSourceFromElements([accountFeaturesInstance])
}

describe('ticket form filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const ticketFormType = new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FORM_TYPE_NAME) })
  const invalidTicketForm = new InstanceElement(
    'invalid',
    ticketFormType,
    {
      agent_conditions: [
        {
          child_fields: [
            { required_on_statuses: { type: 'SOME_STATUSES', statuses: ['solved'], custom_statuses: [1] } },
            { required_on_statuses: { type: 'SOME_STATUSES', statuses: ['solved', 'new'], custom_statuses: [1, 2] } },
            { required_on_statuses: { type: 'ALL_STATUSES' } },
          ],
        },
        {
          child_fields: [
            { required_on_statuses: { type: 'SOME_STATUSES', statuses: ['solved', 'new'], custom_statuses: [1, 2] } },
            { required_on_statuses: { type: 'NO_STATUSES' } },
          ],
        },
        {
          child_fields: [
            { required_on_statuses: { type: 'NO_STATUSES' } },
          ],
        },
      ],
    },
  )
  const fixedTicketForm = new InstanceElement(
    'invalid',
    ticketFormType,
    {
      agent_conditions: [
        {
          child_fields: [
            { required_on_statuses: { type: 'SOME_STATUSES', custom_statuses: [1] } },
            { required_on_statuses: { type: 'SOME_STATUSES', custom_statuses: [1, 2] } },
            { required_on_statuses: { type: 'ALL_STATUSES' } },
          ],
        },
        {
          child_fields: [
            { required_on_statuses: { type: 'SOME_STATUSES', custom_statuses: [1, 2] } },
            { required_on_statuses: { type: 'NO_STATUSES' } },
          ],
        },
        {
          child_fields: [
            { required_on_statuses: { type: 'NO_STATUSES' } },
          ],
        },
      ],
    },
  )

  describe('deploy with custom_statuses enabled', () => {
    beforeEach(async () => {
      jest.clearAllMocks()
      filter = filterCreator(createFilterCreatorParams({ elementsSource: createElementSource(true) })) as FilterType
    })

    it('should deploy removal changes', async () => {
      const clonedElement = invalidTicketForm
      mockDeployChange
        .mockImplementation(async () => ({
          ticket_forms: clonedElement,
        }))
      const res = await filter.deploy([toChange({ before: clonedElement })])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'remove', data: { before: clonedElement } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([toChange({ before: clonedElement })])
    })

    it('should deploy when custom_statuses is undefined', async () => {
      const validTicketForm = new InstanceElement(
        'valid',
        ticketFormType,
        {
          agent_conditions: [
            {
              child_fields: [
                { required_on_statuses: { type: 'SOME_STATUSES', statuses: ['solved'] } },
                { required_on_statuses: { type: 'SOME_STATUSES', statuses: ['solved', 'new'] } },
                { required_on_statuses: { type: 'ALL_STATUSES' } },
              ],
            },
            {
              child_fields: [
                { required_on_statuses: { type: 'SOME_STATUSES', statuses: ['solved', 'new'] } },
                { required_on_statuses: { type: 'NO_STATUSES' } },
              ],
            },
            {
              child_fields: [
                { required_on_statuses: { type: 'NO_STATUSES' } },
              ],
            },
          ],
        },
      )
      mockDeployChange
        .mockImplementation(async () => ({
          ticket_forms: validTicketForm,
        }))
      const res = await filter.deploy([toChange({ after: validTicketForm })])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: validTicketForm } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([toChange({ after: validTicketForm })])
    })
    it('should not deploy when custom_statuses is an empty array', async () => {
      const validTicketForm = new InstanceElement(
        'valid',
        ticketFormType,
        {
          agent_conditions: [
            {
              child_fields: [
                { required_on_statuses: { type: 'SOME_STATUSES', statuses: ['solved'], custom_statuses: [] } },
                { required_on_statuses: { type: 'SOME_STATUSES', statuses: ['solved', 'new'], custom_statuses: [] } },
                { required_on_statuses: { type: 'ALL_STATUSES' } },
              ],
            },
            {
              child_fields: [
                { required_on_statuses: { type: 'SOME_STATUSES', statuses: ['solved', 'new'], custom_statuses: [] } },
                { required_on_statuses: { type: 'NO_STATUSES' } },
              ],
            },
            {
              child_fields: [
                { required_on_statuses: { type: 'NO_STATUSES' } },
              ],
            },
          ],
        },
      )
      mockDeployChange
        .mockImplementation(async () => ({
          ticket_forms: validTicketForm,
        }))
      const res = await filter.deploy([toChange({ after: validTicketForm })])
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: validTicketForm } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([toChange({ after: validTicketForm })])
    })
    it('should deploy modification change when both statuses and custom_statuses appear', async () => {
      const clonedElement = invalidTicketForm
      mockDeployChange
        .mockImplementation(async () => ({
          ticket_forms: clonedElement,
        }))
      const res = await filter.deploy([toChange({ before: clonedElement, after: clonedElement })])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: fixedTicketForm, after: fixedTicketForm } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([toChange({ before: clonedElement, after: clonedElement })])
    })
    it('should deploy addition change when both statuses and custom_statuses appear', async () => {
      const clonedElement = invalidTicketForm
      mockDeployChange
        .mockImplementation(async () => ({
          ticket_forms: clonedElement,
        }))
      const res = await filter.deploy([toChange({ after: clonedElement })])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: fixedTicketForm } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([toChange({ after: clonedElement })])
    })
  })
  describe('deploy with custom_statuses disabled', () => {
    beforeEach(async () => {
      jest.clearAllMocks()
      filter = filterCreator(createFilterCreatorParams({ elementsSource: createElementSource(false) })) as FilterType
    })
    it('should deploy modification change when both statuses and custom_statuses appear', async () => {
      // should keep both status and custom_statuses
      const clonedElement = invalidTicketForm
      mockDeployChange
        .mockImplementation(async () => ({
          ticket_forms: clonedElement,
        }))
      const res = await filter.deploy([toChange({ before: clonedElement, after: clonedElement })])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedElement, after: clonedElement } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([toChange({ before: clonedElement, after: clonedElement })])
    })
    it('should deploy addition change when both statuses and custom_statuses appear', async () => {
      const clonedElement = invalidTicketForm
      mockDeployChange
        .mockImplementation(async () => ({
          ticket_forms: clonedElement,
        }))
      const res = await filter.deploy([toChange({ after: clonedElement })])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: clonedElement } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([toChange({ after: clonedElement })])
    })
  })
})
