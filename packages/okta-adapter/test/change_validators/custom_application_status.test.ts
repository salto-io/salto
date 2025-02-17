/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { customApplicationStatusValidator } from '../../src/change_validators/custom_application_status'
import { OKTA, APPLICATION_TYPE_NAME, INACTIVE_STATUS } from '../../src/constants'

describe('customApplicationStatusValidator', () => {
  const applicationType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const appInstance = new InstanceElement('app', applicationType, {
    label: 'bookmark app',
    status: INACTIVE_STATUS,
    signOnMode: 'BOOKMARK',
    name: 'name',
  })
  const customAppInstance = new InstanceElement('custom', applicationType, {
    customName: 'oktaSubdomain_saml_link',
    signOnMode: 'SAML_2_0',
    status: INACTIVE_STATUS,
  })

  it('should return warning when modifying custom app in status INACTIVE', async () => {
    const errors = await customApplicationStatusValidator([
      toChange({ before: customAppInstance, after: customAppInstance }),
    ])
    expect(errors).toHaveLength(1)
    expect(errors).toEqual([
      {
        elemID: customAppInstance.elemID,
        severity: 'Warning',
        message: 'Application will be activated in order to apply those changes',
        detailedMessage: `Modifications of custom applications in status ${INACTIVE_STATUS} are not supported via the Okta API. Therefore, Salto will activate the application in order to apply changes, and deactivate it afterwards. Alternatively, you can make this change in Okta and fetch.`,
      },
    ])
  })
  it('should not return warning when modifying regular app in status INACTIVE', async () => {
    const errors = await customApplicationStatusValidator([toChange({ before: appInstance, after: appInstance })])
    expect(errors).toHaveLength(0)
  })
})
