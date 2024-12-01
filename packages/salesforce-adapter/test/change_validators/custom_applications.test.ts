/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Change, toChange } from '@salto-io/adapter-api'
import customApplicationsValidator from '../../src/change_validators/custom_applications'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'

describe('custom applications change validator', () => {
  let customAppChange: Change

  describe('when there are no overrides duplications', () => {
    beforeEach(() => {
      const customApp = createInstanceElement(
        {
          fullName: 'TestApp',
          actionOverrides: [
            { formFactor: 'Large', pageOrSobjectType: 'Account' },
            { formFactor: 'Small', pageOrSobjectType: 'Account' },
          ],
          profileActionOverrides: [
            { formFactor: 'Large', pageOrSobjectType: 'Contact', profile: 'Admin' },
            { formFactor: 'Small', pageOrSobjectType: 'Contact', profile: 'Standard' },
          ],
        },
        mockTypes.CustomApplication,
      )
      customAppChange = toChange({ after: customApp })
    })

    it('should not return any errors', async () => {
      const errors = await customApplicationsValidator([customAppChange])
      expect(errors).toHaveLength(0)
    })
  })

  describe('when there are action overrides duplications', () => {
    beforeEach(() => {
      const customApp = createInstanceElement(
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

    it('should return an error with duplicate details', async () => {
      const errors = await customApplicationsValidator([customAppChange])
      expect(errors).toHaveLength(1)
      const [error] = errors
      expect(error.severity).toEqual('Error')
      expect(error.message).toEqual('Custom Application Duplicate Overrides Detected')
      expect(error.detailedMessage).toContain('Form Factor: Large, Page/SObject: Account')
    })
  })

  describe('when there are profile action overrides duplications', () => {
    beforeEach(() => {
      const customApp = createInstanceElement(
        {
          fullName: 'TestApp',
          profileActionOverrides: [
            { formFactor: 'Large', pageOrSobjectType: 'Account', profile: 'Admin' },
            { formFactor: 'Large', pageOrSobjectType: 'Account', profile: 'Admin' },
          ],
        },
        mockTypes.CustomApplication,
      )
      customAppChange = toChange({ after: customApp })
    })

    it('should return an error with duplicate details', async () => {
      const errors = await customApplicationsValidator([customAppChange])
      expect(errors).toHaveLength(1)
      const [error] = errors
      expect(error.severity).toEqual('Error')
      expect(error.message).toEqual('Custom Application Duplicate Overrides Detected')
      expect(error.detailedMessage).toContain('Form Factor: Large, Page/SObject: Account, Profile: Admin')
    })
  })

  describe('when there are mixed duplications', () => {
    beforeEach(() => {
      const customApp = createInstanceElement(
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

    it('should return an error with all duplicate details', async () => {
      const errors = await customApplicationsValidator([customAppChange])
      expect(errors).toHaveLength(1)
      const [error] = errors
      expect(error.severity).toEqual('Error')
      expect(error.detailedMessage).toContain('Form Factor: Large, Page/SObject: Account')
      expect(error.detailedMessage).toContain('Form Factor: Small, Page/SObject: Contact, Profile: Admin')
    })
    describe('when there are multiple duplicates of the same override', () => {
      beforeEach(() => {
        const customApp = createInstanceElement(
          {
            fullName: 'TestApp',
            actionOverrides: [
              { formFactor: 'Large', pageOrSobjectType: 'Account' },
              { formFactor: 'Large', pageOrSobjectType: 'Account' },
              { formFactor: 'Large', pageOrSobjectType: 'Account' },
            ],
            profileActionOverrides: [],
          },
          mockTypes.CustomApplication,
        )
        customAppChange = toChange({ after: customApp })
      })

      it('should return one error line for multiple duplicates of the same override', async () => {
        const errors = await customApplicationsValidator([customAppChange])
        expect(errors).toHaveLength(1)
        const [error] = errors
        expect(error.severity).toEqual('Error')
        expect(error.message).toEqual('Custom Application Duplicate Overrides Detected')
        const duplicateLines = error.detailedMessage.split('\n').filter(line => line.startsWith('-'))
        expect(duplicateLines).toHaveLength(1)
        expect(duplicateLines[0]).toContain('Form Factor: Large, Page/SObject: Account')
      })
    })

    describe('when there are duplicates across multiple custom applications', () => {
      let changes: Change[]

      beforeEach(() => {
        const customApp1 = createInstanceElement(
          {
            fullName: 'TestApp1',
            actionOverrides: [
              { formFactor: 'Large', pageOrSobjectType: 'Account' },
              { formFactor: 'Large', pageOrSobjectType: 'Account' },
            ],
            profileActionOverrides: [],
          },
          mockTypes.CustomApplication,
        )

        const customApp2 = createInstanceElement(
          {
            fullName: 'TestApp2',
            actionOverrides: [],
            profileActionOverrides: [
              { formFactor: 'Small', pageOrSobjectType: 'Contact', profile: 'Admin' },
              { formFactor: 'Small', pageOrSobjectType: 'Contact', profile: 'Admin' },
            ],
          },
          mockTypes.CustomApplication,
        )

        changes = [toChange({ after: customApp1 }), toChange({ after: customApp2 })]
      })

      it('should return separate errors for each application', async () => {
        const errors = await customApplicationsValidator(changes)
        expect(errors).toHaveLength(2)

        // Verify first app error
        expect(errors[0].severity).toEqual('Error')
        expect(errors[0].message).toEqual('Custom Application Duplicate Overrides Detected')
        expect(errors[0].detailedMessage).toContain('Form Factor: Large, Page/SObject: Account')
        expect(errors[0].detailedMessage.split('\n').filter(line => line.startsWith('-'))).toHaveLength(1)

        // Verify second app error
        expect(errors[1].severity).toEqual('Error')
        expect(errors[1].message).toEqual('Custom Application Duplicate Overrides Detected')
        expect(errors[1].detailedMessage).toContain('Form Factor: Small, Page/SObject: Contact, Profile: Admin')
        expect(errors[1].detailedMessage.split('\n').filter(line => line.startsWith('-'))).toHaveLength(1)
      })
    })
  })
})
