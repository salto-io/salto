/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { CORE_ANNOTATIONS, Element, ReferenceExpression } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { mockTypes } from '../mock_elements'
import { createCustomObjectType, defaultFilterContext } from '../utils'
import { createInstanceElement } from '../../src/transformers/transformer'
import { OPPORTUNITY_METADATA_TYPE } from '../../src/constants'
import { FilterWith } from './mocks'
import filterCreator from '../../src/filters/add_parent_to_record_triggered_flows'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'

const mockLogError = jest.fn()
jest.mock('@salto-io/logging', () => ({
  ...jest.requireActual<{}>('@salto-io/logging'),
  logger: jest.fn().mockReturnValue({
    warn: jest.fn((...args) => mockLogError(...args)),
    debug: jest.fn((...args) => mockLogError(...args)),
  }),
}))

describe('addParentToRecordTriggeredFlows', () => {
  describe('onFetch', () => {
    let elements: Element[]
    let elementsSource: Element[]
    let updateOpportunityFlow: Element
    let updateLeadFlow: Element
    let opportunity: Element
    let lead: Element
    let filter: FilterWith<'onFetch'>

    describe('when all parents exist in the workspace', () => {
      beforeEach(() => {
        opportunity = createCustomObjectType(OPPORTUNITY_METADATA_TYPE, {})
        elementsSource = [opportunity]
        elements = [
          (updateOpportunityFlow = createInstanceElement(
            { fullName: 'UpdateOpportunity', start: { object: OPPORTUNITY_METADATA_TYPE } },
            mockTypes.Flow,
          )),
          (updateLeadFlow = createInstanceElement(
            { fullName: 'UpdateLead', start: { object: 'Lead' } },
            mockTypes.Flow,
          )),
          (lead = createCustomObjectType('Lead', {})),
        ]
      })
      describe('when addParentToRecordTriggeredFlows feature is enabled', () => {
        beforeEach(async () => {
          filter = filterCreator({
            config: {
              ...defaultFilterContext,
              fetchProfile: buildFetchProfile({
                fetchParams: { target: [] },
              }),
              elementsSource: buildElementsSourceFromElements(elementsSource),
            },
          }) as FilterWith<'onFetch'>
          await filter.onFetch(elements)
        })
        it('should add parent annotation when the parent was not fetched in the current partial fetch', async () => {
          expect(updateOpportunityFlow.annotations[CORE_ANNOTATIONS.PARENT][0]).toEqual(
            new ReferenceExpression(opportunity.elemID, opportunity),
          )
        })
        it('should add parent annotation when the parent was fetched in the current partial fetch', async () => {
          expect(updateLeadFlow.annotations[CORE_ANNOTATIONS.PARENT][0]).toEqual(
            new ReferenceExpression(lead.elemID, lead),
          )
        })
      })
    })
    describe('when parent does not exist', () => {
      beforeEach(async () => {
        jest.clearAllMocks()
        elementsSource = []
        elements = [
          (updateOpportunityFlow = createInstanceElement(
            { fullName: 'UpdateOpportunity', start: { object: OPPORTUNITY_METADATA_TYPE } },
            mockTypes.Flow,
          )),
          (updateLeadFlow = createInstanceElement(
            { fullName: 'UpdateLead', start: { object: 'Lead' } },
            mockTypes.Flow,
          )),
        ]
        filter = filterCreator({
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: { target: [] },
            }),
            elementsSource: buildElementsSourceFromElements(elementsSource),
          },
        }) as FilterWith<'onFetch'>
        await filter.onFetch(elements)
      })
      it('should not create parent annotation', () => {
        expect(updateOpportunityFlow.annotations[CORE_ANNOTATIONS.PARENT]).toBeUndefined()
        expect(updateLeadFlow.annotations[CORE_ANNOTATIONS.PARENT]).toBeUndefined()
      })
    })
  })
})
