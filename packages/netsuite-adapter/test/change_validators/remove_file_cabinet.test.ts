/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { entitycustomfieldType } from '../../src/autogen/types/standard_types/entitycustomfield'
import { fileType } from '../../src/types/file_cabinet_types'
import removeFileCabinetValidator from '../../src/change_validators/remove_file_cabinet'
import { mockChangeValidatorParams } from '../utils'

describe('remove file cabinet change validator', () => {
  describe('onRemove', () => {
    it('should not have change error when removing an instance with custom object type', async () => {
      const instance = new InstanceElement('test', entitycustomfieldType().type)
      const changeErrors = await removeFileCabinetValidator(
        [toChange({ before: instance })],
        mockChangeValidatorParams(),
      )
      expect(changeErrors).toHaveLength(0)
    })

    it('should have change error when removing an instance with file cabinet type', async () => {
      const instance = new InstanceElement('test', fileType())
      const changeErrors = await removeFileCabinetValidator(
        [toChange({ before: instance })],
        mockChangeValidatorParams(),
      )
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
    })

    it('should not have change error when removing an instance with non custom object type', async () => {
      const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID('bla') }))
      const changeErrors = await removeFileCabinetValidator(
        [toChange({ before: instance })],
        mockChangeValidatorParams(),
      )
      expect(changeErrors).toHaveLength(0)
    })
  })
})
