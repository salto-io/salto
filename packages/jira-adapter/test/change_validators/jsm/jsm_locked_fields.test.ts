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
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import each from 'jest-each'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'
import { JIRA } from '../../../src/constants'
import { jsmLockedFieldsValidator } from '../../../src/change_validators/jsm/jsm_locked_fields'

describe('JsmLockedFieldsValidator', () => {
  let type: ObjectType
  let instance: InstanceElement
  const jsmFieldType = 'com.atlassian.servicedesk:sd-sla-field'

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) })
    instance = new InstanceElement('Affected_services__service_entity_field_cftype__c@suubbbuu', type, {
      type: jsmFieldType,
      isLocked: true,
    })
  })
  each([
    ['Affected_services__service_entity_field_cftype__c@suubbbuu', 'IT Service Management'],
    ['Approvals__sd_approvals__c@uubuu', 'IT Service Management'],
    ['Time_to_done__sd_sla_field__c@ssuubbuu', 'IT Service Management Essentials'],
    ['Organizations__sd_customer_organizations__c@uubbuu', 'HR Service Management'],
    ['bla__bla__c@uubbuu', 'the relevant type'],
  ]).it('should return an the relevant template for the field %s', async (fieldName, templateName) => {
    instance = new InstanceElement(fieldName, type, {
      type: jsmFieldType,
      isLocked: true,
    })
    expect(
      await jsmLockedFieldsValidator([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Cannot deploy a locked field',
        detailedMessage: `The field is Atlassian generated. To create it you must create a first project from a template of ${templateName}`,
      },
    ])
  })
  it('should not return an error if field is not locked', async () => {
    instance.value.isLocked = false
    expect(
      await jsmLockedFieldsValidator([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([])
  })
  it('should not return an error if field is locked but does not related to JSM project', async () => {
    instance.value.type = 'com.atlassian.jira.somethingElse'
    expect(
      await jsmLockedFieldsValidator([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([])
  })
  it('should return proper error messages for several fields', async () => {
    const instance2 = new InstanceElement('Approvals__sd_approvals__c@uubuu', type, {
      type: jsmFieldType,
      isLocked: false,
    })
    const instance3 = new InstanceElement('instance', type, {
      type: jsmFieldType,
      isLocked: true,
    })
    expect(
      await jsmLockedFieldsValidator([
        toChange({
          after: instance,
        }),
        toChange({
          before: instance2,
        }),
        toChange({
          before: instance2,
          after: instance3,
        }),
      ]),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Cannot deploy a locked field',
        detailedMessage:
          'The field is Atlassian generated. To create it you must create a first project from a template of IT Service Management',
      },
      {
        elemID: instance3.elemID,
        severity: 'Error',
        message: 'Cannot deploy a locked field',
        detailedMessage:
          'The field is Atlassian generated. To create it you must create a first project from a template of the relevant type',
      },
    ])
  })
  it('should not return an error if not a field type', async () => {
    instance = new InstanceElement(
      'Approvals__sd_approvals__c@uubuu',
      new ObjectType({ elemID: new ElemID(JIRA, 'notFieldType') }),
      {
        type: jsmFieldType,
        isLocked: true,
      },
    )
    expect(
      await jsmLockedFieldsValidator([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([])
  })
})
