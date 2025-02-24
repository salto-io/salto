/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ObjectType,
  ElemID,
  InstanceElement,
  toChange,
} from '@salto-io/adapter-api'
import { OKTA, APPLICATION_TYPE_NAME, APP_PROVISIONING_FIELD_NAMES } from '../../src/constants'
import { appProvisioningAdditionValidator } from '../../src/change_validators/app_provisioning_addition'

describe('appProvisioningAdditionValidator', () => {
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })

  describe('When testing addition changes', () => {
    APP_PROVISIONING_FIELD_NAMES.forEach(fieldName => {
      it(`should return error when ${fieldName} is added`, async () => {
        const app = new InstanceElement('app1', appType, {
          id: '1',
          label: 'app1',
          status: 'INACTIVE',
          accessPolicy: 'accessPolicyId',
          [fieldName]: {},
        })
        const changes = [toChange({ after: app })]
        const changeErrors = await appProvisioningAdditionValidator(changes)
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors).toEqual([
          {
            elemID: app.elemID,
            severity: 'Error',
            message: 'Application provisioning cannot be added',
            detailedMessage: 'To deploy this application, remove the provisioning configuration first. Then, enable provisioning within the service and perform a fetch.',
          },
        ])
      })
    })

    it('should not return error when no provisioning fields are present', async () => {
      const app = new InstanceElement('app1', appType, {
        id: '1',
        label: 'app1',
        status: 'INACTIVE',
        accessPolicy: 'accessPolicyId',
      })
      const changes = [toChange({ after: app })]
      const changeErrors = await appProvisioningAdditionValidator(changes)
      expect(changeErrors).toHaveLength(0)
    })
  })

  describe('When testing modification changes', () => {
    APP_PROVISIONING_FIELD_NAMES.forEach(fieldName => {
      it(`should return error when ${fieldName} is added in modification`, async () => {
        const before = new InstanceElement('app1', appType, {
          id: '1',
          label: 'app1',
          status: 'INACTIVE',
          accessPolicy: 'accessPolicyId',
        })
        const after = new InstanceElement('app1', appType, {
          id: '1',
          label: 'app1',
          status: 'INACTIVE',
          accessPolicy: 'accessPolicyId',
          [fieldName]: {},
        })
        const changes = [toChange({ before, after })]
        const changeErrors = await appProvisioningAdditionValidator(changes)
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors).toEqual([
          {
            elemID: after.elemID,
            severity: 'Error',
            message: 'Application provisioning cannot be added',
            detailedMessage: 'To deploy this application, remove the provisioning configuration first. Then, enable provisioning within the service and perform a fetch.',
          },
        ])
      })

      it(`should not return error when ${fieldName} is modified`, async () => {
        const before = new InstanceElement('app1', appType, {
          id: '1',
          label: 'app1',
          status: 'INACTIVE',
          accessPolicy: 'accessPolicyId',
          [fieldName]: { someConfig: 'old' },
        })
        const after = new InstanceElement('app1', appType, {
          id: '1',
          label: 'app1',
          status: 'INACTIVE',
          accessPolicy: 'accessPolicyId',
          [fieldName]: { someConfig: 'new' },
        })
        const changes = [toChange({ before, after })]
        const changeErrors = await appProvisioningAdditionValidator(changes)
        expect(changeErrors).toHaveLength(0)
      })

      it(`should not return error when ${fieldName} is removed`, async () => {
        const before = new InstanceElement('app1', appType, {
          id: '1',
          label: 'app1',
          status: 'INACTIVE',
          accessPolicy: 'accessPolicyId',
          [fieldName]: {},
        })
        const after = new InstanceElement('app1', appType, {
          id: '1',
          label: 'app1',
          status: 'INACTIVE',
          accessPolicy: 'accessPolicyId',
        })
        const changes = [toChange({ before, after })]
        const changeErrors = await appProvisioningAdditionValidator(changes)
        expect(changeErrors).toHaveLength(0)
      })
      it(`should not return error when ${fieldName} isn't changed`, async () => {
        const before = new InstanceElement('app1', appType, {
          id: '1',
          label: 'app1',
          status: 'INACTIVE',
          accessPolicy: 'accessPolicyId',
          [fieldName]: {},
        })
        const after = new InstanceElement('app1', appType, {
          id: '1',
          label: 'app1',
          status: 'ACTIVE',
          [fieldName]: {},
        })
        const changes = [toChange({ before, after })]
        const changeErrors = await appProvisioningAdditionValidator(changes)
        expect(changeErrors).toHaveLength(0)
      })
    })
  })
})