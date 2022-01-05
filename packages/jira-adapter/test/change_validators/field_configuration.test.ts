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
import { toChange, ObjectType, ElemID, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { unsupportedFieldConfigurationsValidator } from '../../src/change_validators/field_configuration'
import { JIRA } from '../../src/constants'

describe('unsupportedFieldConfigurationsValidator', () => {
  let type: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, 'FieldConfiguration') })
    instance = new InstanceElement('instance', type)
  })
  it('should return an error if id is not a reference', async () => {
    instance.value.fields = [{
      id: 'id',
    }]

    expect(await unsupportedFieldConfigurationsValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Warning',
        message: `Salto can't deploy fields configuration of ${instance.elemID.getFullName()} because they are either locked or team-managed`,
        detailedMessage: 'Salto can\'t deploy the configuration of fields: id. If continuing, they will be omitted from the deployment',
      },
    ])
  })

  it('should return an error if id is a reference to a locked field', async () => {
    instance.value.fields = [{
      id: new ReferenceExpression(new ElemID(JIRA, 'Field', 'instance', 'inst'), {
        value: {
          id: 'inst',
          isLocked: true,
        },
      }),
    }]

    expect(await unsupportedFieldConfigurationsValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Warning',
        message: `Salto can't deploy fields configuration of ${instance.elemID.getFullName()} because they are either locked or team-managed`,
        detailedMessage: 'Salto can\'t deploy the configuration of fields: inst. If continuing, they will be omitted from the deployment',
      },
    ])
  })

  it('should not return an error if field configuration is valid', async () => {
    instance.value.fields = [{
      id: new ReferenceExpression(new ElemID(JIRA, 'Field', 'instance', 'inst'), {
        value: {
          id: 'inst',
        },
      }),
    }]

    expect(await unsupportedFieldConfigurationsValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([])
  })

  it('should not return an error if an invalid field config was not changed', async () => {
    instance.value.fields = [{
      id: new ReferenceExpression(new ElemID(JIRA, 'Field', 'instance', 'inst'), {
        value: {
          id: 'inst',
          isLocked: true,
        },
      }),
    }]

    expect(await unsupportedFieldConfigurationsValidator([
      toChange({
        before: instance,
        after: instance,
      }),
    ])).toEqual([])
  })
})
