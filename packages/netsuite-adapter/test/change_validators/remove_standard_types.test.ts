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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { entitycustomfieldType } from '../../src/autogen/types/standard_types/entitycustomfield'
import { fileType } from '../../src/types/file_cabinet_types'
import removeStandardTypesValidator from '../../src/change_validators/remove_standard_types'
import { CUSTOM_RECORD_TYPE, INTERNAL_ID, METADATA_TYPE, NETSUITE } from '../../src/constants'


describe('remove custom object change validator', () => {
  describe('onRemove', () => {
    it('should have change error when removing an instance with custom object type', async () => {
      const instance = new InstanceElement('test', entitycustomfieldType().type)
      const changeErrors = await removeStandardTypesValidator([toChange({ before: instance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
    })

    it('should have change error when removing a custom record type', async () => {
      const customRecordType = new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord1'),
        annotations: { [METADATA_TYPE]: CUSTOM_RECORD_TYPE, [INTERNAL_ID]: '14' },
      })
      const changeErrors = await removeStandardTypesValidator([
        toChange({ before: customRecordType }),
      ])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(customRecordType.elemID)
    })

    it('should not have change error when removing an instance with file cabinet type', async () => {
      const instance = new InstanceElement('test', fileType())
      const changeErrors = await removeStandardTypesValidator([toChange({ before: instance })])
      expect(changeErrors).toHaveLength(0)
    })

    it('should not have change error when removing an instance with non custom object type', async () => {
      const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID('bla') }))
      const changeErrors = await removeStandardTypesValidator([toChange({ before: instance })])
      expect(changeErrors).toHaveLength(0)
    })
  })
})
