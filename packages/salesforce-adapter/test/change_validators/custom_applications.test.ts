/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Change, ElemID, InstanceElement, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import customApplicationsValidator from '../../src/change_validators/custom_applications'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'
import { PROFILE_METADATA_TYPE, RECORD_TYPE_METADATA_TYPE, SALESFORCE } from '../../src/constants'

describe('custom applications change validator', () => {
  let customApp: InstanceElement
  let customAppChange: Change
  const recordTypeElemID1 = new ElemID(SALESFORCE, RECORD_TYPE_METADATA_TYPE, 'instance', 'RecordType1')
  const recordTypeElemID2 = new ElemID(SALESFORCE, RECORD_TYPE_METADATA_TYPE, 'instance', 'RecordType2')
  const recordTypeReference1 = new ReferenceExpression(recordTypeElemID1)
  const recordTypeReference2 = new ReferenceExpression(recordTypeElemID2)
  const profileElemID1 = new ElemID(SALESFORCE, PROFILE_METADATA_TYPE, 'instance', 'Profile1')
  const profileElemID2 = new ElemID(SALESFORCE, PROFILE_METADATA_TYPE, 'instance', 'Profile2')
  const profileReference1 = new ReferenceExpression(profileElemID1)
  const profileReference2 = new ReferenceExpression(profileElemID2)

  describe('when there are no overrides duplications', () => {
    beforeEach(() => {
      customApp = createInstanceElement(
        {
          fullName: 'TestApp',
          actionOverrides: [
            { formFactor: 'Large', pageOrSobjectType: 'Account' },
            { formFactor: 'Small', pageOrSobjectType: 'Account' },
          ],
          profileActionOverrides: [
            { formFactor: 'Large', pageOrSobjectType: 'Contact', profile: 'Admin' },
            { formFactor: 'Small', pageOrSobjectType: 'Contact', profile: 'Standard' },
            { formFactor: 'Large', pageOrSobjectType: 'Contact', profile: profileReference1 },
            { formFactor: 'Large', pageOrSobjectType: 'Contact', profile: profileReference2 },
            {
              formFactor: 'Small',
              pageOrSobjectType: 'Contact',
              profile: profileReference2,
              recordType: recordTypeReference1,
            },
            {
              formFactor: 'Small',
              pageOrSobjectType: 'Contact',
              profile: profileReference2,
              recordType: recordTypeReference2,
            },
          ],
        },
        mockTypes.CustomApplication,
      )
      customAppChange = toChange({ after: customApp })
    })

    it('should not return any errors', async () => {
      const errors = await customApplicationsValidator([customAppChange])
      expect(errors).toBeEmpty()
    })
  })

  describe('when there are action overrides duplications', () => {
    beforeEach(() => {
      customApp = createInstanceElement(
        {
          fullName: 'TestApp',
          actionOverrides: [
            { formFactor: 'Large', pageOrSobjectType: 'Account' },
            { formFactor: 'Large', pageOrSobjectType: 'Account' },
          ],
        },
        mockTypes.CustomApplication,
      )
      customAppChange = toChange({ after: customApp })
    })

    it('should return a change error', async () => {
      const errors = await customApplicationsValidator([customAppChange])
      const expectedErrors = [
        {
          elemID: customApp.elemID.createNestedID('actionOverrides', '0'),
          severity: 'Warning',
          message: 'Duplicate action override',
          detailedMessage: 'This action override has multiple definitions',
        },
        {
          elemID: customApp.elemID.createNestedID('actionOverrides', '1'),
          severity: 'Warning',
          message: 'Duplicate action override',
          detailedMessage: 'This action override has multiple definitions',
        },
      ]
      expect(errors).toIncludeSameMembers(expectedErrors)
    })
  })

  describe('when there are profile action overrides duplications', () => {
    describe('when recordType is defined', () => {
      describe('when profile is a ReferenceExpression', () => {
        beforeEach(() => {
          customApp = createInstanceElement(
            {
              fullName: 'TestApp',
              actionOverrides: [
                { formFactor: 'Large', pageOrSobjectType: 'Account' },
                { formFactor: 'Small', pageOrSobjectType: 'Account' },
              ],
              profileActionOverrides: [
                {
                  formFactor: 'Small',
                  pageOrSobjectType: 'Contact',
                  profile: profileReference1,
                  recordType: recordTypeReference1,
                },
                {
                  formFactor: 'Small',
                  pageOrSobjectType: 'Contact',
                  profile: profileReference1,
                  recordType: recordTypeReference1,
                },
              ],
            },
            mockTypes.CustomApplication,
          )
          customAppChange = toChange({ after: customApp })
        })
        it('should return the right change errors', async () => {
          const errors = await customApplicationsValidator([customAppChange])
          const expectedErrors = [
            {
              elemID: customApp.elemID.createNestedID('profileActionOverrides', '0'),
              severity: 'Warning',
              message: 'Duplicate action override',
              detailedMessage: 'This action override has multiple definitions',
            },
            {
              elemID: customApp.elemID.createNestedID('profileActionOverrides', '1'),
              severity: 'Warning',
              message: 'Duplicate action override',
              detailedMessage: 'This action override has multiple definitions',
            },
          ]
          expect(errors).toIncludeSameMembers(expectedErrors)
        })
      })
    })
    describe('when profile is a string', () => {
      beforeEach(() => {
        customApp = createInstanceElement(
          {
            fullName: 'TestApp',
            actionOverrides: [
              { formFactor: 'Large', pageOrSobjectType: 'Account' },
              { formFactor: 'Small', pageOrSobjectType: 'Account' },
            ],
            profileActionOverrides: [
              {
                formFactor: 'Small',
                pageOrSobjectType: 'Contact',
                profile: 'Admin',
                recordType: recordTypeReference1,
              },
              {
                formFactor: 'Small',
                pageOrSobjectType: 'Contact',
                profile: 'Admin',
                recordType: recordTypeReference1,
              },
            ],
          },
          mockTypes.CustomApplication,
        )
        customAppChange = toChange({ after: customApp })
      })
      it('should return the right change errors', async () => {
        const errors = await customApplicationsValidator([customAppChange])
        const expectedErrors = [
          {
            elemID: customApp.elemID.createNestedID('profileActionOverrides', '0'),
            severity: 'Warning',
            message: 'Duplicate action override',
            detailedMessage: 'This action override has multiple definitions',
          },
          {
            elemID: customApp.elemID.createNestedID('profileActionOverrides', '1'),
            severity: 'Warning',
            message: 'Duplicate action override',
            detailedMessage: 'This action override has multiple definitions',
          },
        ]
        expect(errors).toIncludeSameMembers(expectedErrors)
      })
    })
    describe('when recordType is undefined', () => {
      beforeEach(() => {
        customApp = createInstanceElement(
          {
            fullName: 'TestApp',
            actionOverrides: [
              { formFactor: 'Large', pageOrSobjectType: 'Account' },
              { formFactor: 'Small', pageOrSobjectType: 'Account' },
            ],
            profileActionOverrides: [
              {
                formFactor: 'Small',
                pageOrSobjectType: 'Contact',
                profile: profileReference1,
              },
              {
                formFactor: 'Small',
                pageOrSobjectType: 'Contact',
                profile: profileReference1,
              },
            ],
          },
          mockTypes.CustomApplication,
        )
        customAppChange = toChange({ after: customApp })
      })
      it('should return the right change errors', async () => {
        const errors = await customApplicationsValidator([customAppChange])
        const expectedErrors = [
          {
            elemID: customApp.elemID.createNestedID('profileActionOverrides', '0'),
            severity: 'Warning',
            message: 'Duplicate action override',
            detailedMessage: 'This action override has multiple definitions',
          },
          {
            elemID: customApp.elemID.createNestedID('profileActionOverrides', '1'),
            severity: 'Warning',
            message: 'Duplicate action override',
            detailedMessage: 'This action override has multiple definitions',
          },
        ]
        expect(errors).toIncludeSameMembers(expectedErrors)
      })
    })
  })
  describe('when there are mixed duplications', () => {
    beforeEach(() => {
      customApp = createInstanceElement(
        {
          fullName: 'TestApp',
          actionOverrides: [
            { formFactor: 'Large', pageOrSobjectType: 'Account' },
            { formFactor: 'Large', pageOrSobjectType: 'Account' },
          ],
          profileActionOverrides: [
            { formFactor: 'Small', pageOrSobjectType: 'Contact', profile: 'Admin' },
            { formFactor: 'Small', pageOrSobjectType: 'Contact', profile: 'Admin' },
          ],
        },
        mockTypes.CustomApplication,
      )
      customAppChange = toChange({ after: customApp })
    })
    it('should return the right change errors', async () => {
      const errors = await customApplicationsValidator([customAppChange])
      const expectedErrors = [
        {
          elemID: customApp.elemID.createNestedID('actionOverrides', '0'),
          severity: 'Warning',
          message: 'Duplicate action override',
          detailedMessage: 'This action override has multiple definitions',
        },
        {
          elemID: customApp.elemID.createNestedID('actionOverrides', '1'),
          severity: 'Warning',
          message: 'Duplicate action override',
          detailedMessage: 'This action override has multiple definitions',
        },
        {
          elemID: customApp.elemID.createNestedID('profileActionOverrides', '0'),
          severity: 'Warning',
          message: 'Duplicate action override',
          detailedMessage: 'This action override has multiple definitions',
        },
        {
          elemID: customApp.elemID.createNestedID('profileActionOverrides', '1'),
          severity: 'Warning',
          message: 'Duplicate action override',
          detailedMessage: 'This action override has multiple definitions',
        },
      ]
      expect(errors).toIncludeSameMembers(expectedErrors)
    })
  })
})
