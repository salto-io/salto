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

import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression, Values, toChange } from '@salto-io/adapter-api'
import { JIRA } from '../../../src/constants'
import { customFieldsWith10KOptionValidator } from '../../../src/change_validators/field_contexts/more_than_10K_options'

const generateOptions = (count: number): Values =>
  Array.from({ length: count }, (_, i) => ({
    [`p${i}`]: {
      value: `p${i}`,
      disabled: false,
      position: i,
    },
  })).reduce((acc, option) => ({ ...acc, ...option }), {})

// Set long timeout as we create instance with more than 10K options
jest.setTimeout(1000 * 60 * 5)
describe('customFieldsWith10KOptionValidator', () => {
  const parentField = new InstanceElement('parentField', new ObjectType({ elemID: new ElemID(JIRA, 'Field') }), { id: 2 })
  const contextInstance = new InstanceElement('context', new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContext') }), {
    id: 3,
    options: [],
  },
  undefined,
  {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentField.elemID, parentField)],
  })
  it('should return info message when context has more than 10K options', async () => {
    const largeOptionsObject = generateOptions(10001)
    const contextInstanceAfter = contextInstance.clone()
    contextInstanceAfter.value.options = largeOptionsObject
    const changes = [toChange({ after: contextInstanceAfter })]
    const changeErrors = await customFieldsWith10KOptionValidator(changes)
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors).toEqual([{
      elemID: contextInstance.elemID,
      severity: 'Info',
      message: 'Slow deployment due to field with more than 10K options',
      detailedMessage: `The deployment of custom field ${parentField.elemID.name} will be slower because it is associated with the context ${contextInstance.elemID.name} which has more than 10K options.`,
    }])
  })
})
