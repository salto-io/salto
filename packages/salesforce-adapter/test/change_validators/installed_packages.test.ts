/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { mockInstances } from '../mock_elements'
import changeValidator from '../../src/change_validators/installed_packages'

const { awu } = collections.asynciterable

describe('installedPackages Change Validator', () => {
  it('should create change errors', async () => {
    const instance = mockInstances().InstalledPackage
    await awu([
      toChange({ before: instance, after: instance }),
      toChange({ before: instance }),
      toChange({ after: instance }),
    ])
      .map(change => changeValidator([change]))
      .forEach(changeErrors => {
        expect(changeErrors).toEqual([
          expect.objectContaining({
            elemID: instance.elemID,
            severity: 'Error',
            detailedMessage: expect.stringContaining(instance.value.fullName),
          }),
        ])
      })
  })
})
