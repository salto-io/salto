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
import { ObjectType, ElemID, ReadOnlyElementsSource, InstanceElement, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { automationsValidator } from '../../src/change_validators/automations'
import { AUTOMATION_TYPE, JIRA } from '../../src/constants'

describe('automationsValidator', () => {
  let automationType: ObjectType
  let elementsSource: ReadOnlyElementsSource
  let elements: InstanceElement[]
  let instance: InstanceElement

  beforeEach(() => {
    automationType = new ObjectType({ elemID: new ElemID(JIRA, AUTOMATION_TYPE) })
    instance = new InstanceElement(
      'instance',
      automationType,
      {
        name: 'someName',
      },
    )

    elements = [instance]
    elementsSource = buildElementsSourceFromElements(elements)
  })

  it('should return an error when name is already in use', async () => {
    const instance2 = new InstanceElement(
      'instance2',
      automationType,
      {
        name: 'someName',
      },
    )

    elements.push(instance2)
    elementsSource = buildElementsSourceFromElements(elements)

    expect(await automationsValidator([toChange({ after: instance2 })], elementsSource))
      .toEqual([
        {
          elemID: instance2.elemID,
          severity: 'Error',
          message: 'Automation name is already in use',
          detailedMessage: 'The automation name “someName” is already used by other automations in the target environment. To deploy this automation using Salto, rename it and try again.',
        },
      ])
  })

  it('should return not an error when the name is not taken', async () => {
    const instance2 = new InstanceElement(
      'instance2',
      automationType,
      {
        name: 'someName2',
      },
    )
    elements.push(instance2)
    elementsSource = buildElementsSourceFromElements(elements)

    expect(await automationsValidator([toChange({ after: instance2 })], elementsSource))
      .toEqual([])
  })
})
