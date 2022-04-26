/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { MASK_VALUE } from '../../src/filters/masking'
import { maskingValidator } from '../../src/change_validators/masking'
import { AUTOMATION_TYPE, JIRA } from '../../src/constants'

describe('maskingValidator', () => {
  let type: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, AUTOMATION_TYPE) })
    instance = new InstanceElement(
      'instance',
      type,
      {
        headers: [
          {
            name: 'masked',
            value: MASK_VALUE,
          },
          {
            name: 'notMasked',
            value: 'value',
          },
        ],
      }
    )
  })

  it('should return an info have a masked value', async () => {
    expect(await maskingValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Info',
        message: 'Masked data will be deployed to the service',
        detailedMessage: '',
        deployActions: {
          preAction: {
            title: 'Masked data will be overridden in the service',
            description: `${instance.elemID.getFullName()} contains masked values which will override the real values in the service when deploying`,
            subActions: [],
          },
          postAction: {
            title: 'Update masked data in the service',
            description: `Please updated the masked values that were deployed to the service in ${instance.elemID.getFullName()} in the service`,
            subActions: [
              `In the Jira UI, open System > Global automation, and open the automation of ${instance.elemID.getFullName()}`,
              'Go over the headers with masked values (headers with <SECRET_TOKEN> values) and set the real values',
              'Click "Save"',
              'Click "Publish changes"',
            ],
          },
        },
      },
    ])
  })

  it('should not return an info have a masked value', async () => {
    instance.value.headers = {
      name: 'notMasked',
      value: 'value',
    }
    expect(await maskingValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([])
  })
})
