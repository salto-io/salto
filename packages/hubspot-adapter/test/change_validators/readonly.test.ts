/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { InstanceElement, StaticFile, ReferenceExpression, ElemID, ChangeError } from '@salto-io/adapter-api'
import readonlyValidator from '../../src/change_validators/readonly'
import { Types } from '../../src/transformers/transformer'
import { OBJECTS_NAMES } from '../../src/constants'
import { contactPropertyMock } from '../common/mock_elements'
import { toChange } from '../common/mock_changes'

describe('readonly change validator', () => {
  describe('onUpdate', () => {
    const contactPropertyInstance = new InstanceElement(
      'contactPropertyInstance',
      Types.hubspotObjects[OBJECTS_NAMES.CONTACT_PROPERTY],
      contactPropertyMock,
    )

    let after: InstanceElement
    let changeErrors: Readonly<ChangeError[]>
    beforeEach(() => {
      after = contactPropertyInstance.clone()
    })

    describe('change value of name in ContactProperty', () => {
      it('should have an error when different string', async () => {
        after.value.name = 'abc'
        changeErrors = await readonlyValidator([
          toChange({ before: contactPropertyInstance, after }),
        ])
      })

      it('should have an error on static file with diff value', async () => {
        after.value.name = new StaticFile({ filepath: 'path', content: Buffer.from('abc') })
        changeErrors = await readonlyValidator([
          toChange({ before: contactPropertyInstance, after }),
        ])
      })

      it('should have an error on reference with diff value', async () => {
        after.value.name = new ReferenceExpression(new ElemID('hubspot', 'str'), 'abc')
        changeErrors = await readonlyValidator([
          toChange({ before: contactPropertyInstance, after }),
        ])
      })

      afterEach(() => {
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(after.elemID)
      })
    })

    describe('keep resolved value of name in ContactProperty', () => {
      it('should not have an error when replacing name with static file with same value', async () => {
        after.value.name = new StaticFile({ filepath: 'path', content: Buffer.from(contactPropertyMock.name) })
        changeErrors = await readonlyValidator([
          toChange({ before: contactPropertyInstance, after }),
        ])
      })

      it('should not have an error when replacing name with reference to the same value', async () => {
        after.value.name = new ReferenceExpression(new ElemID('hubspot', 'str'), contactPropertyMock.name)
        changeErrors = await readonlyValidator([
          toChange({ before: contactPropertyInstance, after }),
        ])
      })

      it('should not have an error when modyfing other non-readonly value', async () => {
        after.value.label = 'new label'
        changeErrors = await readonlyValidator([
          toChange({ before: contactPropertyInstance, after }),
        ])
      })

      afterEach(() => {
        expect(changeErrors).toHaveLength(0)
      })
    })
  })
})
