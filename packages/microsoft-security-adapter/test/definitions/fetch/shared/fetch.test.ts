/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { createFetchDefinitions } from '../../../../src/definitions'

describe('shared fetch definitions', () => {
  describe(`${createFetchDefinitions.name}`, () => {
    describe('when servicesToManage includes Entra', () => {
      it('should only return Entra customizations', () => {
        const fetchDefinitions = createFetchDefinitions(['Entra'])
        expect(fetchDefinitions.instances.customizations).toHaveProperty('EntraApplication')
        expect(fetchDefinitions.instances.customizations).not.toHaveProperty('IntuneApplication')
      })
    })

    describe('when servicesToManage includes Intune', () => {
      it('should return Intune customizations with the basic Entra customizations', () => {
        const fetchDefinitions = createFetchDefinitions(['Intune'])
        expect(fetchDefinitions.instances.customizations).toHaveProperty('IntuneApplication')
        expect(fetchDefinitions.instances.customizations).not.toHaveProperty('EntraApplication')
        expect(fetchDefinitions.instances.customizations).toHaveProperty('EntraGroup')
      })
    })

    describe('when servicesToManage includes both Entra and Intune', () => {
      it('should return both Entra and Intune customizations', () => {
        const fetchDefinitions = createFetchDefinitions(['Entra', 'Intune'])
        expect(fetchDefinitions.instances.customizations).toHaveProperty('EntraApplication')
        expect(fetchDefinitions.instances.customizations).toHaveProperty('IntuneApplication')
      })
    })
  })
})
