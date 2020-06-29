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
import serviceIdsChangesValidator from '../../src/change_validators/service_ids_changes'
import { customTypes, fileCabinetTypes } from '../../src/types'
import { ENTITY_CUSTOM_FIELD, FILE, PATH, SCRIPT_ID } from '../../src/constants'
import { toChangeGroup } from '../utils'


describe('customization type change validator', () => {
  it('should have change error if custom type SCRIPT_ID has been modified', async () => {
    const entityCustomFieldInstance = new InstanceElement('elementName',
      customTypes[ENTITY_CUSTOM_FIELD], {
        [SCRIPT_ID]: 'custentity_my_script_id',
      })
    const after = entityCustomFieldInstance.clone()
    after.value[SCRIPT_ID] = 'modified'
    const changeErrors = await serviceIdsChangesValidator(
      toChangeGroup({ before: entityCustomFieldInstance, after })
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(entityCustomFieldInstance.elemID)
  })

  it('should have change error if file cabinet type PATH has been modified', async () => {
    const fileInstance = new InstanceElement('fileInstance', fileCabinetTypes[FILE], {
      [PATH]: 'Templates/content.html',
    })
    const after = fileInstance.clone()
    after.value[PATH] = 'Templates/modified.html'
    const changeErrors = await serviceIdsChangesValidator(
      toChangeGroup({ before: fileInstance, after })
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(fileInstance.elemID)
  })

  it('should not have change error if custom type regular field has been modified', async () => {
    const entityCustomFieldInstance = new InstanceElement('elementName',
      customTypes[ENTITY_CUSTOM_FIELD], {
        [SCRIPT_ID]: 'custentity_my_script_id',
        label: 'original',
      })
    const after = entityCustomFieldInstance.clone()
    after.value.label = 'modified'
    const changeErrors = await serviceIdsChangesValidator(
      toChangeGroup({ before: entityCustomFieldInstance, after })
    )
    expect(changeErrors).toHaveLength(0)
  })

  it('should not have change error if file cabinet type regular field has been modified', async () => {
    const fileInstance = new InstanceElement('fileInstance', fileCabinetTypes[FILE], {
      [PATH]: 'Templates/content.html',
      content: 'original',
    })
    const after = fileInstance.clone()
    after.value.content = 'modified'
    const changeErrors = await serviceIdsChangesValidator(
      toChangeGroup({ before: fileInstance, after })
    )
    expect(changeErrors).toHaveLength(0)
  })
})
