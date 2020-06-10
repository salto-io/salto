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
import { ElemID, InstanceElement, ObjectType, ChangeDataType, Change, ChangeGroup, getChangeElement } from '@salto-io/adapter-api'
import removeCustomizationValidator from '../../src/change_validators/remove_customization'
import { customTypes, fileCabinetTypes } from '../../src/types'
import { ENTITY_CUSTOM_FIELD } from '../../src/constants'


// TODO: export to common test utils package
export type ChangeParams = { before?: ChangeDataType; after?: ChangeDataType }
export const toChange = ({ before, after }: ChangeParams): Change => {
  if (before !== undefined && after !== undefined) {
    return { action: 'modify', data: { before, after } }
  }
  if (before !== undefined) {
    return { action: 'remove', data: { before } }
  }
  if (after !== undefined) {
    return { action: 'add', data: { after } }
  }
  throw new Error('must provide before or after')
}

export const toChangeGroup = (...params: ChangeParams[]): ChangeGroup => {
  const changes = params.map(toChange)
  return {
    groupID: getChangeElement(changes[0]).elemID.getFullName(),
    changes,
  }
}

describe('remove custom object change validator', () => {
  describe('onRemove', () => {
    it('should have change error when removing an instance with custom object type', async () => {
      const instance = new InstanceElement('test', customTypes[ENTITY_CUSTOM_FIELD])
      const changeErrors = await removeCustomizationValidator(toChangeGroup({ before: instance }))
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
    })

    it('should have change error when removing an instance with file cabinet type', async () => {
      const instance = new InstanceElement('test', fileCabinetTypes.file)
      const changeErrors = await removeCustomizationValidator(toChangeGroup({ before: instance }))
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
    })

    it('should not have change error when removing an instance with non custom object type', async () => {
      const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID('bla') }))
      const changeErrors = await removeCustomizationValidator(toChangeGroup({ before: instance }))
      expect(changeErrors).toHaveLength(0)
    })
  })
})
