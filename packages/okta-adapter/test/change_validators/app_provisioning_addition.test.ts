/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType, ElemID, InstanceElement, toChange } from '@salto-io/adapter-api'
import { OKTA, APPLICATION_TYPE_NAME, APP_PROVISIONING_FIELD_NAMES } from '../../src/constants'
import { appProvisioningAdditionValidator } from '../../src/change_validators/app_provisioning_addition'

describe('appProvisioningAdditionValidator', () => {
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })

  describe('When testing addition changes', () => {
    describe.each(APP_PROVISIONING_FIELD_NAMES)('when %s is added', fieldName => {
      it('should return error', async () => {
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
            message: 'Application provisioning settings cannot be added via Salto.',
            detailedMessage:
              'Salto cannot add provisioning settings because credentials are required to establish the initial connection. To deploy this application, remove the following provisioning fields: applicationUserProvisioning, applicationInboundProvisioning, applicationProvisioningUsers, applicationProvisioningGeneral if present. After deployment, configure provisioning settings directly in the Okta Admin Console. Learn more at help.salto.io/en/articles/10199943-deploying-okta-applications-using-salto#h_a3697a03a3.',
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
    describe.each(APP_PROVISIONING_FIELD_NAMES)('when %s is added in modification', fieldName => {
      it('should return error', async () => {
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
            message: 'Application provisioning settings cannot be added via Salto.',
            detailedMessage:
              'Salto cannot add provisioning settings because credentials are required to establish the initial connection. To deploy this application, remove the following provisioning fields: applicationUserProvisioning, applicationInboundProvisioning, applicationProvisioningUsers, applicationProvisioningGeneral if present. After deployment, configure provisioning settings directly in the Okta Admin Console. Learn more at help.salto.io/en/articles/10199943-deploying-okta-applications-using-salto#h_a3697a03a3.',
          },
        ])
      })

      it('should not return error when modified', async () => {
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

      it('should not return error when removed', async () => {
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

      it('should not return error when unchanged', async () => {
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
