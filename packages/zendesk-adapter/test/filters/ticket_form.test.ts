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

import { filterUtils, references as referencesUtils } from '@salto-io/adapter-components'
import {
  ElemID,
  InstanceElement,
  ObjectType,
  ReadOnlyElementsSource,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
import filterCreator from '../../src/filters/ticket_form'
import { createFilterCreatorParams } from '../utils'
import { ACCOUNT_FEATURES_TYPE_NAME, TICKET_FIELD_TYPE_NAME, TICKET_FORM_TYPE_NAME, ZENDESK } from '../../src/constants'

const { createMissingInstance } = referencesUtils
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

const mockLogError = jest.fn()
jest.mock('@salto-io/logging', () => ({
  ...jest.requireActual<{}>('@salto-io/logging'),
  logger: jest.fn().mockReturnValue({
    debug: jest.fn(),
    trace: jest.fn(),
    info: jest.fn(),
    error: jest.fn((...args) => mockLogError(...args)),
  }),
}))

const createElementSource = (customStatusesEnabled: boolean): ReadOnlyElementsSource => {
  const accountFeaturesType = new ObjectType({
    elemID: new ElemID(ZENDESK, ACCOUNT_FEATURES_TYPE_NAME),
  })
  const accountFeaturesInstance = new InstanceElement(ElemID.CONFIG_NAME, accountFeaturesType, {
    custom_statuses_enabled: {
      enabled: customStatusesEnabled,
    },
  })
  return buildElementsSourceFromElements([accountFeaturesInstance])
}

describe('ticket form filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy' | 'onDeploy' | 'onFetch'>
  let filter: FilterType
  const ticketFormType = new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FORM_TYPE_NAME) })
  const invalidTicketForm = new InstanceElement('invalid', ticketFormType, {
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
        child_fields: [{ required_on_statuses: { type: 'NO_STATUSES' } }],
      },
    ],
  })
  const fixedTicketForm = new InstanceElement('invalid', ticketFormType, {
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
        child_fields: [{ required_on_statuses: { type: 'NO_STATUSES' } }],
      },
    ],
  })
  describe('fetch', () => {
    const genericCustomTicketStatusField = new InstanceElement(
      'custom_status',
      new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FIELD_TYPE_NAME) }),
      {
        type: 'custom_status',
        id: 123,
      },
    )
    const otherField = new InstanceElement(
      'other field',
      new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FIELD_TYPE_NAME) }),
      {
        type: 'text',
      },
    )

    const customTicketFieldRef = new ReferenceExpression(
      genericCustomTicketStatusField.elemID,
      genericCustomTicketStatusField,
    )
    const otherTicketFieldRef = new ReferenceExpression(otherField.elemID, otherField)

    const elementSourceForm = new InstanceElement('elementSourceForm', ticketFormType, {
      ticket_field_ids: [customTicketFieldRef, 123456, otherTicketFieldRef],
    })
    beforeEach(async () => {
      jest.clearAllMocks()
    })

    it('should not remove the generic custom ticket on fetch when flag is off', async () => {
      const elements = [elementSourceForm, otherField, genericCustomTicketStatusField]
      filter = filterCreator(
        createFilterCreatorParams({ elementsSource: buildElementsSourceFromElements(elements) }),
      ) as FilterType

      await filter.onFetch(elements)
      expect(elementSourceForm.value.ticket_field_ids).toEqual([customTicketFieldRef, 123456, otherTicketFieldRef])
    })
    it('should remove the generic custom ticket on fetch when flag is on', async () => {
      const elements = [elementSourceForm, otherField, genericCustomTicketStatusField]
      const config = { ...DEFAULT_CONFIG }
      config[FETCH_CONFIG].omitTicketStatusTicketField = true
      filter = filterCreator(
        createFilterCreatorParams({ config, elementsSource: buildElementsSourceFromElements(elements) }),
      ) as FilterType

      await filter.onFetch(elements)
      expect(elementSourceForm.value.ticket_field_ids).toEqual([123456, otherTicketFieldRef])
      expect(elements).toEqual([elementSourceForm, otherField])
    })
    it('should remove the generic custom ticket on fetch when flag is on and there is no ref', async () => {
      const elementSourceFormWithID = new InstanceElement('elementSourceFormWithID', ticketFormType, {
        ticket_field_ids: [123, 123456, otherTicketFieldRef],
      })
      const elements = [elementSourceFormWithID, otherField, genericCustomTicketStatusField]

      const config = { ...DEFAULT_CONFIG }
      config[FETCH_CONFIG].omitTicketStatusTicketField = true
      filter = filterCreator(
        createFilterCreatorParams({ config, elementsSource: buildElementsSourceFromElements(elements) }),
      ) as FilterType

      await filter.onFetch(elements)
      expect(elementSourceFormWithID.value.ticket_field_ids).toEqual([123456, otherTicketFieldRef])
      expect(elements).toEqual([elementSourceFormWithID, otherField])
    })
  })

  describe('deploy of removal of field and its condition', () => {
    beforeEach(async () => {
      jest.clearAllMocks()
      filter = filterCreator(createFilterCreatorParams({ elementsSource: createElementSource(true) })) as FilterType
    })
    it('should deploy modification change with removal of conditions and field', async () => {
      const missing = createMissingInstance(ZENDESK, TICKET_FIELD_TYPE_NAME, 'test')
      const beforeTicketForm = new InstanceElement('test', ticketFormType, {
        ticket_field_ids: [1, 11, 123, 1234, new ReferenceExpression(missing.elemID, missing)],
        agent_conditions: [
          {
            parent_field_id: 123,
            child_fields: [
              {
                id: 1234,
              },
            ],
          },
        ],
        end_user_conditions: [
          {
            parent_field_id: 123,
            child_fields: [
              {
                id: 1234,
              },
            ],
          },
        ],
      })
      const afterTicketForm = beforeTicketForm.clone()
      afterTicketForm.value.ticket_field_ids = [1, 11]
      afterTicketForm.value.agent_conditions = []
      afterTicketForm.value.end_user_conditions = []

      const intermediateTicketForm = beforeTicketForm.clone()
      intermediateTicketForm.value.ticket_field_ids = [1, 11, 123, 1234]
      intermediateTicketForm.value.agent_conditions = []
      intermediateTicketForm.value.end_user_conditions = []

      mockDeployChange.mockImplementation(async () => ({
        ticket_forms: afterTicketForm,
      }))
      const res = await filter.deploy([toChange({ before: beforeTicketForm, after: afterTicketForm })])
      expect(mockDeployChange).toHaveBeenCalledTimes(2)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: beforeTicketForm, after: intermediateTicketForm } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        undefined,
      })
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: beforeTicketForm, after: afterTicketForm } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([toChange({ before: beforeTicketForm, after: afterTicketForm })])
    })
  })

  describe('deploy with custom_statuses enabled', () => {
    beforeEach(async () => {
      jest.clearAllMocks()
      filter = filterCreator(createFilterCreatorParams({ elementsSource: createElementSource(true) })) as FilterType
    })

    it('should deploy removal changes', async () => {
      const clonedElement = invalidTicketForm
      mockDeployChange.mockImplementation(async () => ({
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
      expect(res.deployResult.appliedChanges).toEqual([toChange({ before: clonedElement })])
    })

    it('should deploy when custom_statuses is undefined', async () => {
      const validTicketForm = new InstanceElement('valid', ticketFormType, {
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
            child_fields: [{ required_on_statuses: { type: 'NO_STATUSES' } }],
          },
        ],
      })
      mockDeployChange.mockImplementation(async () => ({
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
      expect(res.deployResult.appliedChanges).toEqual([toChange({ after: validTicketForm })])
    })
    it('should not deploy when custom_statuses is an empty array', async () => {
      const validTicketForm = new InstanceElement('valid', ticketFormType, {
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
            child_fields: [{ required_on_statuses: { type: 'NO_STATUSES' } }],
          },
        ],
      })
      mockDeployChange.mockImplementation(async () => ({
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
      expect(res.deployResult.appliedChanges).toEqual([toChange({ after: validTicketForm })])
    })
    it('should deploy modification change when both statuses and custom_statuses appear', async () => {
      const clonedElement = invalidTicketForm
      mockDeployChange.mockImplementation(async () => ({
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
      expect(res.deployResult.appliedChanges).toEqual([toChange({ before: clonedElement, after: clonedElement })])
    })
    it('should deploy addition change when both statuses and custom_statuses appear', async () => {
      const clonedElement = invalidTicketForm
      mockDeployChange.mockImplementation(async () => ({
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
      expect(res.deployResult.appliedChanges).toEqual([toChange({ after: clonedElement })])
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
      mockDeployChange.mockImplementation(async () => ({
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
      expect(res.deployResult.appliedChanges).toEqual([toChange({ before: clonedElement, after: clonedElement })])
    })
    it('should deploy addition change when both statuses and custom_statuses appear', async () => {
      const clonedElement = invalidTicketForm
      mockDeployChange.mockImplementation(async () => ({
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
      expect(res.deployResult.appliedChanges).toEqual([toChange({ after: clonedElement })])
    })
  })
  describe('onDeploy', () => {
    const ticketStatusField = new InstanceElement(
      'ticket status',
      new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FIELD_TYPE_NAME) }),
      {
        type: 'custom_status',
      },
    )
    const otherField = new InstanceElement(
      'other field',
      new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FIELD_TYPE_NAME) }),
      {
        type: 'text',
      },
    )
    const elementSourceForm = new InstanceElement('elementSourceForm', ticketFormType, {
      ticket_field_ids: [
        new ReferenceExpression(ticketStatusField.elemID, ticketStatusField),
        123456,
        new ReferenceExpression(otherField.elemID, otherField),
      ],
    })
    const formToDeploy = new InstanceElement('elementSourceForm', ticketFormType, {
      ticket_field_ids: [123456, 654321],
    })
    beforeEach(async () => {
      jest.clearAllMocks()
      filter = filterCreator(
        createFilterCreatorParams({
          elementsSource: buildElementsSourceFromElements([elementSourceForm, otherField, ticketStatusField]),
        }),
      ) as FilterType
    })

    it('should restore ticket field ids from elementSource', async () => {
      const clonedForm = formToDeploy.clone()
      await filter.onDeploy([toChange({ after: clonedForm })])
      expect(clonedForm.value.ticket_field_ids).toEqual(elementSourceForm.value.ticket_field_ids)
      expect(mockLogError).not.toHaveBeenCalled()
    })
    it('should do nothing if ticket status field does not exist in element source', async () => {
      filter = filterCreator(
        createFilterCreatorParams({
          elementsSource: buildElementsSourceFromElements([elementSourceForm, otherField]),
        }),
      ) as FilterType
      const clonedForm = formToDeploy.clone()
      await filter.onDeploy([toChange({ after: clonedForm })])
      expect(clonedForm.value.ticket_field_ids).toEqual(formToDeploy.value.ticket_field_ids)
      expect(mockLogError).toHaveBeenCalledWith(
        'could not find field of type custom_status not running on deploy of ticket_form',
      )
    })
    it('should do nothing if ticket status field has an id', async () => {
      const clonedForm = formToDeploy.clone()
      const clonedCustomStatusField = ticketStatusField.clone()
      clonedCustomStatusField.value.id = 1
      filter = filterCreator(
        createFilterCreatorParams({
          elementsSource: buildElementsSourceFromElements([elementSourceForm, otherField, clonedCustomStatusField]),
        }),
      ) as FilterType
      expect(clonedForm.value.ticket_field_ids).toEqual(formToDeploy.value.ticket_field_ids)
      expect(mockLogError).not.toHaveBeenCalled()
    })
    it('should do nothing if deployed form is not in the element source', async () => {
      filter = filterCreator(
        createFilterCreatorParams({
          elementsSource: buildElementsSourceFromElements([otherField, ticketStatusField]),
        }),
      ) as FilterType
      const clonedForm = formToDeploy.clone()
      await filter.onDeploy([toChange({ after: clonedForm })])
      expect(clonedForm.value.ticket_field_ids).toEqual(formToDeploy.value.ticket_field_ids)
      expect(mockLogError).toHaveBeenCalledWith(`could not find ticketFieldIds for form ${clonedForm.elemID.name}`)
    })
    it('should do nothing if ticket_field_ids is undefined', async () => {
      const clonedElementSourceForm = elementSourceForm.clone()
      clonedElementSourceForm.value.ticket_field_ids = undefined
      filter = filterCreator(
        createFilterCreatorParams({
          elementsSource: buildElementsSourceFromElements([clonedElementSourceForm, otherField, ticketStatusField]),
        }),
      ) as FilterType
      const clonedForm = formToDeploy.clone()
      await filter.onDeploy([toChange({ after: clonedForm })])
      expect(clonedForm.value.ticket_field_ids).toEqual(formToDeploy.value.ticket_field_ids)
      expect(mockLogError).toHaveBeenCalledWith(`could not find ticketFieldIds for form ${clonedForm.elemID.name}`)
    })
  })
})
