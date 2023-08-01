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
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import translationCollectionValidator from '../../src/change_validators/translation_collection_references'
import { addressFormType } from '../../src/autogen/types/standard_types/addressForm'

describe('translation collection change validator', () => {
  const addressFormInstance = new InstanceElement('test', addressFormType().type, { field: '[scriptid=custcollection1]' })
  const nestedRefInstance = new InstanceElement('test1', addressFormType().type,
    {
      field: '[type=custcollection, scriptid=custcollection2]',
      field2: '[scriptid=custcollection3.inner]',
    })
  const noReferenceInstance = new InstanceElement('test2', addressFormType().type, {})
  it('should return changeError in case there\'s a NS reference to a translation collection', async () => {
    const changes = [
      { after: addressFormInstance },
      { after: noReferenceInstance },
      { after: nestedRefInstance },
    ].map(toChange)
    const changeErrors = await translationCollectionValidator(changes)
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors[0]).toEqual({
      elemID: addressFormInstance.elemID,
      severity: 'Error',
      message: 'Cannot deploy element with invalid translation reference',
      detailedMessage: 'Cannot deploy this element because it contains references to the following translation collections that do not exist in your environment: \'custcollection1\'.'
  + ' To proceed with the deployment, please replace the reference with a valid string. After the deployment, you can reconnect the elements in the NetSuite UI.',
    })
    expect(changeErrors[1]).toEqual({
      elemID: nestedRefInstance.elemID,
      severity: 'Error',
      message: 'Cannot deploy element with invalid translation reference',
      detailedMessage: 'Cannot deploy this element because it contains references to the following translation collections that do not exist in your environment: \'custcollection2\', \'custcollection3\'.'
  + ' To proceed with the deployment, please replace the reference with a valid string. After the deployment, you can reconnect the elements in the NetSuite UI.',
    })
  })
})
