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
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { screenValidator } from '../../src/change_validators/screen'
import { JIRA } from '../../src/constants'

describe('screenValidator', () => {
  let type: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, 'Screen') })
    instance = new InstanceElement('instance', type)
  })
  it('should return an error if the same tab has the same field more then once', async () => {
    instance.value.tabs = {
      tab: {
        name: 'tab',
        fields: [
          '1',
          '2',
          '1',
          '2',
          '3',
        ],
      },
    }

    expect(await screenValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Can’t deploy screen which uses fields more than once',
        detailedMessage: 'This screen uses the following fields more than once: 1, 2. Make sure each field is used only once, and try again.',
      },
    ])
  })

  it('should return an error if the two tabs has the same field', async () => {
    instance.value.tabs = {
      tab: {
        name: 'tab',
        fields: [
          '1',
          '2',
        ],
      },

      tab2: {
        name: 'tab2',
        fields: [
          '1',
          '3',
        ],
      },
    }

    expect(await screenValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Can’t deploy screen which uses fields more than once',
        detailedMessage: 'This screen uses the following field more than once: 1. Make sure each field is used only once, and try again.',
      },
    ])
  })

  it('should not return an error if there is no common field in the screen tabs', async () => {
    instance.value.tabs = {
      tab: {
        name: 'tab',
        fields: [
          '4',
          '2',
        ],
      },

      tab2: {
        name: 'tab2',
        fields: [
          '1',
          '3',
        ],
      },

      tab3: {
        name: 'tab3',
      },
    }

    expect(await screenValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([])
  })

  it('should not return an error if there are no tabs', async () => {
    expect(await screenValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([])
  })
})
