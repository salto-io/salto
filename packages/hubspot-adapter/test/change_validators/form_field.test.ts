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
import { InstanceElement } from '@salto-io/adapter-api'
import { Types } from '../../src/transformers/transformer'
import { afterFormInstanceValuesMock } from '../common/mock_elements'
import formFieldValidator from '../../src/change_validators/form_field'

describe('form field change validator', () => {
  let formInstance: InstanceElement
  const notInstanceStr = 'not an instance'

  beforeEach(() => {
    formInstance = new InstanceElement(
      'formInstance',
      Types.hubspotObjects.form,
      afterFormInstanceValuesMock,
    )
  })

  describe('onAdd', () => {
    let addInstance: InstanceElement
    beforeEach(() => {
      addInstance = formInstance.clone()
    })

    it('should work when contactProperty are instances', async () => {
      const changeErrors = await formFieldValidator.onAdd(addInstance)
      expect(changeErrors).toHaveLength(0)
    })

    it('should have errors when not instance at field level', async () => {
      addInstance.value.formFieldGroups[0].fields[0].contactProperty = notInstanceStr
      const changeErrors = await formFieldValidator.onAdd(addInstance)
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(addInstance.elemID)
    })

    it('should have errors when not instance in dependent fields', async () => {
      addInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
        .dependentFormField.contactProperty = notInstanceStr
      const changeErrors = await formFieldValidator.onAdd(addInstance)
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(addInstance.elemID)
    })
  })

  describe('onUpdate', () => {
    let after: InstanceElement
    beforeEach(() => {
      after = formInstance.clone()
    })
    it('should work when contactProperty are instances', async () => {
      const changeErrors = await formFieldValidator.onUpdate([{
        action: 'modify',
        data: { after, before: formInstance },
      }])
      expect(changeErrors).toHaveLength(0)
    })
    it('should have errors when not instance at field level', async () => {
      after.value.formFieldGroups[0].fields[0].contactProperty = notInstanceStr
      const changeErrors = await formFieldValidator.onUpdate([{
        action: 'modify',
        data: { after, before: formInstance },
      }])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(after.elemID)
    })

    it('should have errors when not instance in dependent fields', async () => {
      after.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
        .dependentFormField.contactProperty = notInstanceStr
      const changeErrors = await formFieldValidator.onUpdate([{
        action: 'modify',
        data: { after, before: formInstance },
      }])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(after.elemID)
    })
  })
})
