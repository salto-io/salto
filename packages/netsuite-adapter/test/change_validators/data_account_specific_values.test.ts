/*
*                      Copyright 2021 Salto Labs Ltd.
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
import dataAccountSpecificValueValidator from '../../src/change_validators/data_account_specific_values'
import { NETSUITE } from '../../src/constants'


describe('data account specific value validator', () => {
  it('should not have ChangeError when deploying an instance without ACCOUNT_SPECIFIC_VALUE', async () => {
    const instance = new InstanceElement(
      'instance',
      new ObjectType({ elemID: new ElemID(NETSUITE, 'someType'), annotations: { source: 'soap' } }),
    )
    const changeErrors = await dataAccountSpecificValueValidator(
      [toChange({ after: instance })]
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should not have ChangeError when deploying an instance with ACCOUNT_SPECIFIC_VALUE and internalId', async () => {
    const instance = new InstanceElement(
      'instance',
      new ObjectType({ elemID: new ElemID(NETSUITE, 'someType'), annotations: { source: 'soap' } }),
      {
        field: {
          id: '[ACCOUNT_SPECIFIC_VALUE]',
          internalId: '2',
        },
      }
    )
    const changeErrors = await dataAccountSpecificValueValidator(
      [toChange({ after: instance })]
    )
    expect(changeErrors).toHaveLength(0)
  })

  it('should have ChangeError when deploying an instance with ACCOUNT_SPECIFIC_VALUE and without internalId', async () => {
    const instance = new InstanceElement(
      'instance',
      new ObjectType({ elemID: new ElemID(NETSUITE, 'someType'), annotations: { source: 'soap' } }),
      {
        field: {
          id: '[ACCOUNT_SPECIFIC_VALUE]',
        },
      }
    )
    const changeErrors = await dataAccountSpecificValueValidator(
      [toChange({ after: instance })]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(instance.elemID)
  })

  it('should have ChangeError when deploying an instance with internalId that is ACCOUNT_SPECIFIC_VALUE', async () => {
    const instance = new InstanceElement(
      'instance',
      new ObjectType({ elemID: new ElemID(NETSUITE, 'someType'), annotations: { source: 'soap' } }),
      {
        field: {
          internalId: '[ACCOUNT_SPECIFIC_VALUE]',
        },
      }
    )
    const changeErrors = await dataAccountSpecificValueValidator(
      [toChange({ after: instance })]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(instance.elemID)
  })

  it('should not have ChangeError if a field with ACCOUNT_SPECIFIC_VALUE was not changed', async () => {
    const before = new InstanceElement(
      'instance',
      new ObjectType({ elemID: new ElemID(NETSUITE, 'someType'), annotations: { source: 'soap' } }),
      {
        field: {
          internalId: '[ACCOUNT_SPECIFIC_VALUE]',
        },
      }
    )

    const after = before.clone()
    after.value.field2 = 2
    const changeErrors = await dataAccountSpecificValueValidator(
      [toChange({ before, after })]
    )
    expect(changeErrors).toHaveLength(0)
  })
})
