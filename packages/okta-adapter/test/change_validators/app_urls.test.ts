/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { appUrlsValidator } from '../../src/change_validators/app_urls'
import { OKTA, APPLICATION_TYPE_NAME } from '../../src/constants'

describe('appUrlsValidator', () => {
  let type: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
    instance = new InstanceElement('bookmarkApp', type, {
      label: 'bookmark app',
      status: 'ACTIVE',
      signOnMode: 'BOOKMARK',
      settings: {
        app: {
          domain: 'my-domain',
        },
      },
    })
  })
  it('should return warning when adding or modifying application', async () => {
    expect(
      await appUrlsValidator([toChange({ after: instance }), toChange({ before: instance, after: instance })]),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Update environment-specific values when deploying application elements between Okta tenants',
        detailedMessage:
          'Update environment-specific values, such as URLs and subdomains, when deploying application elements between Okta tenants. Adjust these values by editing the relevant element in Salto.',
      },
      {
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Update environment-specific values when deploying application elements between Okta tenants',
        detailedMessage:
          'Update environment-specific values, such as URLs and subdomains, when deploying application elements between Okta tenants. Adjust these values by editing the relevant element in Salto.',
      },
    ])
  })
  it('should not return warning when removing application', async () => {
    expect(await appUrlsValidator([toChange({ before: instance })])).toEqual([])
  })
})
