/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { MICROSOFT_SECURITY, entraConstants } from '../../../src/constants'
import { applicationSetupValidator } from '../../../src/change_validators/entra/application_setup_validator'

const { APPLICATION_TYPE_NAME, SERVICE_PRINCIPAL_TYPE_NAME } = entraConstants.TOP_LEVEL_TYPES

describe(applicationSetupValidator.name, () => {
  describe('when the changes include an application instance', () => {
    const applicationType = new ObjectType({ elemID: new ElemID(MICROSOFT_SECURITY, APPLICATION_TYPE_NAME) })
    const applicationInstance = new InstanceElement('testApplication', applicationType, {
      displayName: 'testApplication',
    })

    describe('when the change is an addition', () => {
      it('should return a change error for the application instance', async () => {
        const changes = [
          toChange({
            after: applicationInstance.clone(),
          }),
        ]
        const res = await applicationSetupValidator(changes)
        expect(res).toEqual([
          {
            severity: 'Info',
            message: 'Credentials setup may be required for the new app registration',
            detailedMessage: 'The newly created app registration may require additional credentials setup.',
            elemID: applicationInstance.elemID,
            deployActions: {
              postAction: {
                title: 'Complete the app registration setup',
                description:
                  'The new app registration (testApplication) currently lacks credentials. If needed, please configure credentials in the Entra admin center.',
                showOnFailure: false,
                subActions: [],
              },
            },
          },
        ])
      })
    })

    describe('when the change is a modification', () => {
      it('should not return a change error for the application instance', async () => {
        const changes = [
          toChange({
            before: applicationInstance.clone(),
            after: applicationInstance.clone(),
          }),
        ]
        const res = await applicationSetupValidator(changes)
        expect(res).toEqual([])
      })
    })

    describe('when the change is a removal', () => {
      it('should not return a change error for the application instance', async () => {
        const changes = [
          toChange({
            before: applicationInstance.clone(),
          }),
        ]
        const res = await applicationSetupValidator(changes)
        expect(res).toEqual([])
      })
    })
  })

  describe('when the changes include a service principal instance', () => {
    const servicePrincipalType = new ObjectType({
      elemID: new ElemID(MICROSOFT_SECURITY, SERVICE_PRINCIPAL_TYPE_NAME),
    })
    const servicePrincipalInstance = new InstanceElement('testServicePrincipal', servicePrincipalType, {
      displayName: 'testServicePrincipal',
    })

    describe('when the change is an addition', () => {
      it('should return a change error for the service principal instance', async () => {
        const changes = [
          toChange({
            after: servicePrincipalInstance.clone(),
          }),
        ]
        const res = await applicationSetupValidator(changes)
        expect(res).toEqual([
          {
            elemID: servicePrincipalInstance.elemID,
            severity: 'Info',
            message: 'Credentials setup may be required for the new application',
            detailedMessage: 'The newly created application may require additional credentials setup.',
            deployActions: {
              postAction: {
                title: 'Complete the application setup',
                description:
                  'The new application (testServicePrincipal) currently lacks credentials. If needed, please configure credentials in the Entra admin center.',
                showOnFailure: false,
                subActions: [],
              },
            },
          },
        ])
      })
    })

    describe('when the change is a modification', () => {
      it('should not return a change error for the service principal instance', async () => {
        const changes = [
          toChange({
            before: servicePrincipalInstance.clone(),
            after: servicePrincipalInstance.clone(),
          }),
        ]
        const res = await applicationSetupValidator(changes)
        expect(res).toEqual([])
      })
    })

    describe('when the change is a removal', () => {
      it('should not return a change error for the service principal instance', async () => {
        const changes = [
          toChange({
            before: servicePrincipalInstance.clone(),
          }),
        ]
        const res = await applicationSetupValidator(changes)
        expect(res).toHaveLength(0)
      })
    })
  })

  describe('when the changes do not include an application or service principal instance', () => {
    const randomType = new ObjectType({ elemID: new ElemID(MICROSOFT_SECURITY, 'randomType') })
    const randomInstance = new InstanceElement('randomInstance', randomType, {
      displayName: 'randomInstance',
    })

    it('should not return a change error', async () => {
      const changes = [
        toChange({
          after: randomInstance.clone(),
        }),
      ]
      const res = await applicationSetupValidator(changes)
      expect(res).toEqual([])
    })
  })
})
