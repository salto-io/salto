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
import { ChangeError, InstanceElement, toChange } from '@salto-io/adapter-api'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'
import { INSTANCE_FULL_NAME_FIELD } from '../../src/constants'
import changeValidator from '../../src/change_validators/metadata_instances_and_types'

describe('metadataInstancesAndTypes Change Validator', () => {
  let errors: readonly ChangeError[]
  beforeEach(async () => {
    const dataInstance = new InstanceElement(
      '123',
      mockTypes.SBQQ__Template__c,
      {
        Id: '123',
        Name: 'Test Instance',
      },
    )
    const instanceWithNoApiName = new InstanceElement(
      'TestNoApiName',
      mockTypes.ApexPage,
      { field: 123, another: '123' }
    )
    const metadataInstance = createInstanceElement({
      [INSTANCE_FULL_NAME_FIELD]: 'Test Instance',
    }, mockTypes.ApexPage)
    const modifiedMetadataInstance = metadataInstance.clone()
    metadataInstance.value[INSTANCE_FULL_NAME_FIELD] = 'Modified Test Instance'


    const changes = [
      // addition of data instance should yield error
      toChange({ after: dataInstance }),
      // addition of CustomObject should not yield error
      toChange({ after: mockTypes.SBQQ__Template__c }),
      // instance with no api name should yield error 'Element has no API name'
      toChange({ after: instanceWithNoApiName }),
      // instance with modified api name should yield error 'Cannot modify Element API name'
      toChange({ before: metadataInstance, after: modifiedMetadataInstance }),
      // addition of metadata type should yield error 'Element is invalid'
      toChange({ after: mockTypes.ApexPage }),
    ]
    errors = await changeValidator(changes)
  })
  it('should create correct errors', () => {
    expect(errors).toIncludeSameMembers([
      expect.objectContaining({ message: 'Element has no API name' }),
      expect.objectContaining({ message: 'Cannot modify Element API name' }),
      expect.objectContaining({ message: 'Element is invalid' }),
    ])
  })
})
