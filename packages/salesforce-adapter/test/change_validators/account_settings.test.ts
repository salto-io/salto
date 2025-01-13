/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { BuiltinTypes, ElemID, ObjectType, ReadOnlyElementsSource, toChange } from '@salto-io/adapter-api'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'
import changeValidatorCreator from '../../src/change_validators/account_settings'
import { SALESFORCE, TYPES_PATH } from '../../src/constants'

describe('Account settings validator', () => {
  const instanceBefore = createInstanceElement({ fullName: 'whatever' }, mockTypes.AccountSettings)
  const changeValidator = changeValidatorCreator

  const ORGANIZATION_OBJECT_TYPE = new ObjectType({
    elemID: new ElemID(SALESFORCE, 'Organization'),
    fields: {
      defaultAccountAccess: {
        refType: BuiltinTypes.STRING,
      },
    },
    isSettings: true,
    path: [SALESFORCE, TYPES_PATH],
  })

  const mockElementsSource = (defaultAccountAccess: string): ReadOnlyElementsSource => {
    const element = createInstanceElement(
      {
        fullName: 'OrganizationSettings',
        defaultAccountAccess,
      },
      ORGANIZATION_OBJECT_TYPE,
    )
    return buildElementsSourceFromElements([element])
  }

  describe("When the global setting is 'Private'", () => {
    const elementsSource = mockElementsSource('Read')
    it('Should pass validation if enableAccountOwnerReport exists', async () => {
      const instanceAfter = instanceBefore.clone()
      instanceAfter.value.enableAccountOwnerReport = true
      const change = toChange({ before: instanceBefore, after: instanceAfter })
      const errors = await changeValidator([change], elementsSource)
      expect(errors).toBeEmpty()
    })
    it('Should pass validation if enableAccountOwnerReport does not exist', async () => {
      const instanceAfter = instanceBefore.clone()
      const change = toChange({ before: instanceBefore, after: instanceAfter })
      const errors = await changeValidator([change], elementsSource)
      expect(errors).toBeEmpty()
    })
  })

  describe("When the global setting is not 'Private'", () => {
    const elementsSource = mockElementsSource('Edit')

    it('Should fail validation if enableAccountOwnerReport exists', async () => {
      const instanceAfter = instanceBefore.clone()
      instanceAfter.value.enableAccountOwnerReport = true
      const change = toChange({ before: instanceBefore, after: instanceAfter })
      const errors = await changeValidator([change], elementsSource)
      expect(errors).toHaveLength(1)
      expect(errors).toIncludeAllPartialMembers([{ elemID: instanceBefore.elemID }])
    })
    it('Should pass validation if enableAccountOwnerReport does not exist', async () => {
      const instanceAfter = instanceBefore.clone()
      const change = toChange({ before: instanceBefore, after: instanceAfter })
      const errors = await changeValidator([change], elementsSource)
      expect(errors).toBeEmpty()
    })
  })
})
