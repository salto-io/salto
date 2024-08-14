/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { createDefinitionForAppRoleAssignment } from '../../../src/definitions/fetch/utils'

describe(`${createDefinitionForAppRoleAssignment.name}`, () => {
  it('should return the correct definition', () => {
    const definition = createDefinitionForAppRoleAssignment('basePath')
    expect(definition.requests).toHaveLength(1)
    expect(definition.requests?.[0].endpoint.path).toEqual('/basePath/{id}/appRoleAssignments')
  })
})
