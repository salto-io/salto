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
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { unresolvedFieldConfigurationItemsValidator } from '../../src/change_validators/unresolved_field_configuration_items'
import { FIELD_CONFIGURATION_TYPE_NAME, JIRA } from '../../src/constants'
import { FIELD_TYPE_NAME } from '../../src/filters/fields/constants'

describe('unresolvedFieldConfigurationItemsValidator', () => {
  let type: ObjectType
  let instance: InstanceElement
  let fieldType: ObjectType
  let fieldInstanceA: InstanceElement
  let fieldInstanceB: InstanceElement
  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, FIELD_CONFIGURATION_TYPE_NAME) })
    instance = new InstanceElement(
      'instance',
      type,
      {
        fields: {
          a: {
            isRequired: true,
          },
          b: {
            isRequired: true,
          },
        },
      }
    )

    fieldType = new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) })
    fieldInstanceA = new InstanceElement(
      'a',
      fieldType,
    )
    fieldInstanceB = new InstanceElement(
      'b',
      fieldType,
    )
  })
  it('should return a warning when field does not exist in element source', async () => {
    const elementsSource = buildElementsSourceFromElements([
      fieldInstanceA,
    ])
    expect(await unresolvedFieldConfigurationItemsValidator([
      toChange({
        after: instance,
      }),
    ], elementsSource)).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Field configuration has configuration about fields that do not exist in the account',
        detailedMessage: 'The following fields configuration items will not be deployed since their fields do not exist in the account: b',
      },
    ])
  })

  it('should not return a warning when there are no fields', async () => {
    delete instance.value.fields
    const elementsSource = buildElementsSourceFromElements([
      fieldInstanceA,
    ])
    expect(await unresolvedFieldConfigurationItemsValidator([
      toChange({
        after: instance,
      }),
    ], elementsSource)).toEqual([])
  })

  it('should not return a warning when all fields exist in element source', async () => {
    const elementsSource = buildElementsSourceFromElements([
      fieldInstanceA,
      fieldInstanceB,
    ])
    expect(await unresolvedFieldConfigurationItemsValidator([
      toChange({
        after: instance,
      }),
    ], elementsSource)).toEqual([])
  })

  it('should not return a warning when there is no element source', async () => {
    expect(await unresolvedFieldConfigurationItemsValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([])
  })
})
