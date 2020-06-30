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
import {
  ElemID, InstanceElement, ObjectType,
} from '@salto-io/adapter-api'
import customizationTypeValidator from '../../src/change_validators/customization_type'
import { customTypes, fileCabinetTypes } from '../../src/types'
import { ENTITY_CUSTOM_FIELD, FILE, NETSUITE } from '../../src/constants'
import { toChange } from '../utils'


describe('customization type change validator', () => {
  it('should have change error when adding an instance with non customization type', async () => {
    const instWithUnsupportedType = new InstanceElement('unsupported',
      new ObjectType({ elemID: new ElemID(NETSUITE, 'UnsupportedType') }))
    const changeErrors = await customizationTypeValidator(
      [toChange({ after: instWithUnsupportedType })]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(instWithUnsupportedType.elemID)
  })

  it('should have change error when updating an instance with non customization type', async () => {
    const instWithUnsupportedType = new InstanceElement('unsupported',
      new ObjectType({ elemID: new ElemID(NETSUITE, 'UnsupportedType') }))
    const changeErrors = await customizationTypeValidator(
      [toChange({ before: instWithUnsupportedType, after: instWithUnsupportedType })]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(instWithUnsupportedType.elemID)
  })

  it('should not have change error when adding an instance with customType', async () => {
    const instance = new InstanceElement('test', customTypes[ENTITY_CUSTOM_FIELD])
    const changeErrors = await customizationTypeValidator([toChange({ after: instance })])
    expect(changeErrors).toHaveLength(0)
  })

  it('should not have change error when updating an instance with customType', async () => {
    const instance = new InstanceElement('test', customTypes[ENTITY_CUSTOM_FIELD])
    const changeErrors = await customizationTypeValidator(
      [toChange({ before: instance, after: instance })]
    )
    expect(changeErrors).toHaveLength(0)
  })

  it('should not have change error when adding an instance with fileCabinetType', async () => {
    const instance = new InstanceElement('test', fileCabinetTypes[FILE])
    const changeErrors = await customizationTypeValidator([toChange({ after: instance })])
    expect(changeErrors).toHaveLength(0)
  })

  it('should not have change error when updating an instance with fileCabinetType', async () => {
    const instance = new InstanceElement('test', fileCabinetTypes[FILE])
    const changeErrors = await customizationTypeValidator(
      [toChange({ before: instance, after: instance })]
    )
    expect(changeErrors).toHaveLength(0)
  })
})
