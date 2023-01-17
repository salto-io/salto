/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ElemID, ReadOnlyElementsSource, toChange } from '@salto-io/adapter-api'
import { SALESFORCE } from '../../src/constants'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'
import changeValidatorCreator from '../../src/change_validators/account_settings'
import { ORGANIZATION_OBJECT_TYPE } from '../../src/transformers/salesforce_types'

const mockElementsSource = (defaultAccountAccess: string): ReadOnlyElementsSource => {
  const element = createInstanceElement(
    {
      fullName: new ElemID(SALESFORCE, 'Organization', 'instance').getFullName(),
      defaultAccountAccess,
    },
    ORGANIZATION_OBJECT_TYPE
  )
  return buildElementsSourceFromElements([element])
}

describe('Account settings validator', () => {
  const instanceBefore = createInstanceElement({ fullName: 'whatever' }, mockTypes.AccountSettings)
  const changeValidator = changeValidatorCreator()

  describe('When the global setting is \'Private\'', () => {
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

  describe('When the global setting is not \'Private\'', () => {
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
