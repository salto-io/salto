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
  const noReferenceInstance = new InstanceElement('test2', addressFormType().type, {})
  it('should return changeError in case there\'s a NS reference to a translation collection', async () => {
    const changes = [{ after: addressFormInstance }, { after: noReferenceInstance }].map(toChange)
    const changeErrors = await translationCollectionValidator(changes)
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      elemID: addressFormInstance.elemID,
      severity: 'Error',
      message: 'Cannot deploy element with invalid translation reference',
      detailedMessage: 'Cannot deploy this element because it contains a reference to a translation collection that does not exist in the project.'
  + ' To proceed with the deployment, please replace the reference with a valid string. After the deployment, you can reconnect the elements in the NS UI.',
    })
  })
})
