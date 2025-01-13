/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ACCOUNT_FEATURES_TYPE_NAME, TICKET_FORM_TYPE_NAME, ZENDESK } from '../../src/constants'
import { FixElementsArgs } from '../../src/fix_elements/types'
import { fixTicketFormsHandler } from '../../src/fix_elements/fix_ticket_forms'

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
  const ticketFormType = new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FORM_TYPE_NAME) })
  const invalidTicketForm = new InstanceElement('invalid', ticketFormType, {
    agent_conditions: [
      {
        child_fields: [
          { required_on_statuses: { type: 'SOME_STATUSES', statuses: ['solved'], custom_statuses: [1] } },
          { required_on_statuses: { type: 'SOME_STATUSES', statuses: ['solved', 'new'], custom_statuses: [1, 2] } },
          { required_on_statuses: { type: 'SOME_STATUSES', custom_statuses: [1, 2] } },
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
  describe('deploy with custom_statuses enabled', () => {
    it('should remove statuses when both statuses and custom_statuses appear', async () => {
      const fixer = fixTicketFormsHandler({ elementsSource: createElementSource(true) } as FixElementsArgs)
      const { fixedElements, errors } = await fixer([invalidTicketForm.clone()])

      const expectedFixedArticle = fixedTicketForm.clone()
      expect(fixedElements).toEqual([expectedFixedArticle])
      expect(errors).toHaveLength(1)
      expect(errors[0]).toEqual(
        expect.objectContaining({
          elemID: invalidTicketForm.elemID,
          severity: 'Info',
          message: 'Ticket forms fixed',
          detailedMessage:
            'Ticket forms condition fixed as zendesk api does not allow conditions to include both `custom_statuses` and `statuses` fields.',
        }),
      )
    })
    describe('deploy with custom_statuses disabled', () => {
      it('should do nothing', async () => {
        const fixer = fixTicketFormsHandler({ elementsSource: createElementSource(false) } as FixElementsArgs)
        const { fixedElements, errors } = await fixer([invalidTicketForm.clone()])

        expect(fixedElements).toEqual([])
        expect(errors).toHaveLength(0)
      })
    })
  })
})
