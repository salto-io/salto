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

import { toChange } from '@salto-io/adapter-api'
import * as filterUtilsModule from '../../src/filters/utils'
import { CUSTOM_OBJECT_ID_FIELD } from '../../src/constants'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'
import changeValidatorCreator from '../../src/change_validators/account_settings'
import mockAdapter from '../adapter'

jest.mock('../../src/filters/utils', () => ({
  ...jest.requireActual('../../src/filters/utils'),
  queryClient: jest.fn(),
}))

const mockedFilterUtils = jest.mocked(filterUtilsModule)

const setMockQueryResult = (defaultAccountAccess: string): void => {
  mockedFilterUtils.queryClient.mockResolvedValue([{
    [CUSTOM_OBJECT_ID_FIELD]: 'SomeId',
    DefaultAccountAccess: defaultAccountAccess,
  }])
}

describe('Account settings validator', () => {
  const instanceBefore = createInstanceElement({ fullName: 'whatever' }, mockTypes.AccountSettings)
  const { client } = mockAdapter({})
  const changeValidator = changeValidatorCreator(client)

  describe('When the global setting is \'Private\'', () => {
    beforeEach(() => {
      setMockQueryResult('Read')
    })

    it('Should pass validation if enableAccountOwnerReport exists', async () => {
      const instanceAfter = instanceBefore.clone()
      instanceAfter.value.enableAccountOwnerReport = true
      const change = toChange({ before: instanceBefore, after: instanceAfter })
      const errors = await changeValidator([change])
      expect(errors).toBeEmpty()
    })
    it('Should pass validation if enableAccountOwnerReport does not exist', async () => {
      const instanceAfter = instanceBefore.clone()
      const change = toChange({ before: instanceBefore, after: instanceAfter })
      const errors = await changeValidator([change])
      expect(errors).toBeEmpty()
    })
  })

  describe('When the global setting is not \'Private\'', () => {
    beforeEach(() => {
      setMockQueryResult('Edit')
    })

    it('Should fail validation if enableAccountOwnerReport exists', async () => {
      const instanceAfter = instanceBefore.clone()
      instanceAfter.value.enableAccountOwnerReport = true
      const change = toChange({ before: instanceBefore, after: instanceAfter })
      const errors = await changeValidator([change])
      expect(errors).toHaveLength(1)
      expect(errors).toIncludeAllPartialMembers([{ elemID: instanceBefore.elemID }])
    })
    it('Should pass validation if enableAccountOwnerReport does not exist', async () => {
      const instanceAfter = instanceBefore.clone()
      const change = toChange({ before: instanceBefore, after: instanceAfter })
      const errors = await changeValidator([change])
      expect(errors).toBeEmpty()
    })
  })
})
