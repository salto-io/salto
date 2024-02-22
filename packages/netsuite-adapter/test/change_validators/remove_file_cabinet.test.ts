/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import removeFileCabinetValidator from '../../src/change_validators/remove_file_cabinet'

describe('remove file cabinet change validator', () => {
  describe('onRemove', () => {
    it('should not have change error when removing an instance with custom object type', async () => {
      const instance = new InstanceElement('test', entitycustomfieldType().type)
      const changeErrors = await removeFileCabinetValidator([toChange({ before: instance })])
      expect(changeErrors).toHaveLength(0)
    })

    it('should have change error when removing an instance with file cabinet type', async () => {
      const instance = new InstanceElement('test', fileType())
      const changeErrors = await removeFileCabinetValidator([toChange({ before: instance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
    })

    it('should not have change error when removing an instance with non custom object type', async () => {
      const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID('bla') }))
      const changeErrors = await removeFileCabinetValidator([toChange({ before: instance })])
      expect(changeErrors).toHaveLength(0)
    })
  })
})
