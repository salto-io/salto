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
import { Element, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import filterCreator, { CUSTOM_LABEL, CUSTOM_LABELS } from '../../src/filters/split_custom_labels'
import mockClient from '../client'
import { defaultFilterContext } from '../utils'
import { FilterWith } from '../../src/filter'
import { RECORDS_PATH, SALESFORCE } from '../../src/constants'


describe('Test split custom labels filter', () => {
  const CUSTOM_LABEL_1 = 'CustomLabel1'
  const CUSTOM_LABEL_2 = 'CustomLabel2'

  let customLabelsInstance: InstanceElement
  let customLabelType: ObjectType
  const filter = (): FilterWith<'onFetch'> => filterCreator({
    client: mockClient().client,
    config: defaultFilterContext,
  }) as FilterWith<'onFetch'>

  const runFilter = async (...elements: Element[]): Promise<Element[]> => {
    await filter().onFetch(elements)
    return elements
  }

  beforeEach(() => {
    customLabelsInstance = new InstanceElement(
      'CustomLabels',
      new ObjectType({
        elemID: new ElemID(SALESFORCE, CUSTOM_LABELS),
      }),
      {
        labels: [
          { fullName: CUSTOM_LABEL_1 },
          { fullName: CUSTOM_LABEL_2 },
        ],
      }
    )
    customLabelType = new ObjectType({
      elemID: new ElemID(SALESFORCE, CUSTOM_LABEL),
    })
  })

  it('should skip if theres no CustomLabels instance', async () => {
    const receivedElements = await runFilter(customLabelType)
    expect(receivedElements).toEqual([customLabelType])
  })

  it('should skip if theres no CustomLabel type', async () => {
    const receivedElements = await runFilter(customLabelsInstance)
    expect(receivedElements).toEqual([customLabelsInstance])
  })

  it('should split CustomLabels instance into CustomLabel instances and remove it', async () => {
    const receivedElements = await runFilter(customLabelsInstance, customLabelType)
    const receivedCustomLabelInstances = receivedElements
      .filter(e => e.elemID.typeName === CUSTOM_LABEL)
    expect(receivedCustomLabelInstances).toIncludeAllPartialMembers([
      {
        value: customLabelsInstance.value.labels[0],
        path: [SALESFORCE, RECORDS_PATH, CUSTOM_LABEL, CUSTOM_LABEL_1],
      },
      {
        value: customLabelsInstance.value.labels[1],
        path: [SALESFORCE, RECORDS_PATH, CUSTOM_LABEL, CUSTOM_LABEL_2],
      },
    ])
    // validates the custom labels instance was removed
    expect(receivedElements).not.toSatisfyAny(e => e.elemID.typeName === CUSTOM_LABELS)
  })
})
