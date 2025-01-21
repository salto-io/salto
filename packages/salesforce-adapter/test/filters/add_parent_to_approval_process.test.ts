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
import { FilterWith } from './mocks'
import { createInstanceElement } from '../../src/transformers/transformer'
import filterCreator from '../../src/filters/add_parent_to_approval_process'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'

describe('addParentToApprovalProcess', () => {
  describe('onFetch', () => {
    let elements: Element[]
    let elementsSource: Element[]
    let accountApprovalProcess: Element
    let leadApprovalProcess: Element
    let account: Element
    let lead: Element
    let filter: FilterWith<'onFetch'>

    describe('when all parents exist in the workspace', () => {
      beforeEach(async () => {
        account = mockTypes.Account
        elementsSource = [account]
        elements = [
          (accountApprovalProcess = createInstanceElement(
            { fullName: 'Account.AccountApporvalProcess' },
            mockTypes.ApprovalProcess,
          )),
          (leadApprovalProcess = createInstanceElement(
            { fullName: 'Lead.leadApprovalProcess' },
            mockTypes.ApprovalProcess,
          )),
          (lead = createCustomObjectType('Lead', {})),
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
      it('should add parent annotation when the parent was not fetched in the current partial fetch', async () => {
        expect(accountApprovalProcess.annotations[CORE_ANNOTATIONS.PARENT][0]).toEqual(
          new ReferenceExpression(account.elemID, account),
        )
      })
      it('should add parent annotation when the parent was fetched in the current partial fetch', async () => {
        expect(leadApprovalProcess.annotations[CORE_ANNOTATIONS.PARENT][0]).toEqual(
          new ReferenceExpression(lead.elemID, lead),
        )
      })
    })
    describe('when parent does not exist', () => {
      beforeEach(async () => {
        elementsSource = []
        elements = [
          (accountApprovalProcess = createInstanceElement(
            { fullName: 'Account.AccountApporvalProcess' },
            mockTypes.ApprovalProcess,
          )),
          (leadApprovalProcess = createInstanceElement(
            { fullName: 'Lead.leadApprovalProcess' },
            mockTypes.ApprovalProcess,
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
        expect(accountApprovalProcess.annotations[CORE_ANNOTATIONS.PARENT]).toBeUndefined()
        expect(leadApprovalProcess.annotations[CORE_ANNOTATIONS.PARENT]).toBeUndefined()
      })
    })
  })
})
