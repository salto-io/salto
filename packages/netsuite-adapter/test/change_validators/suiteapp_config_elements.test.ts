/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { BuiltinTypes, ElemID, InstanceElement, ListType, ObjectType, toChange } from '@salto-io/adapter-api'
import { NETSUITE, SELECT_OPTION } from '../../src/constants'
import { SUITEAPP_CONFIG_TYPE_NAMES } from '../../src/types'
import suiteAppConfigElementsValidator from '../../src/change_validators/suiteapp_config_elements'

describe('config elements change validator', () => {
  const selectOptionType = new ObjectType({
    elemID: new ElemID(NETSUITE, SELECT_OPTION),
  })
  const type = new ObjectType({
    elemID: new ElemID(NETSUITE, SUITEAPP_CONFIG_TYPE_NAMES[0]),
    fields: {
      checkboxField: {
        refType: BuiltinTypes.BOOLEAN,
      },
      selectField: {
        refType: selectOptionType,
      },
      multiselectField: {
        refType: new ListType(selectOptionType),
      },
    },
  })
  const before = new InstanceElement('instance', type, {
    checkboxField: false,
    selectField: { value: '1', text: 'One' },
    multiselectField: [{ value: '1', text: 'One' }],
  })
  let after: InstanceElement
  beforeEach(() => {
    after = before.clone()
  })

  it("should return warnings on text change in 'select' fields", async () => {
    after.value = {
      checkboxField: true,
      selectField: { value: '2', text: 'Two' },
      multiselectField: [{ value: '2', text: 'Two' }],
    }
    const result = await suiteAppConfigElementsValidator([toChange({ before, after })])
    expect(result.length).toBe(2)
    expect(result[0]).toEqual({
      elemID: after.elemID.createNestedID('selectField'),
      severity: 'Warning',
      message: 'Modification of this attribute in certain type fields is ignored by NetSuite',
      detailedMessage:
        'This modification is ignored by NetSuite. If you deploy it, the change will be deleted in Salto in the next fetch.\n' +
        'Consider doing this change directly in the NetSuite UI.',
    })
    expect(result[1]).toEqual({
      elemID: after.elemID.createNestedID('multiselectField'),
      severity: 'Warning',
      message: 'Modification of this attribute in certain type fields is ignored by NetSuite',
      detailedMessage:
        'This modification is ignored by NetSuite. If you deploy it, the change will be deleted in Salto in the next fetch.\n' +
        'Consider doing this change directly in the NetSuite UI.',
    })
  })
})
