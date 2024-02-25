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
import {
  BuiltinTypes,
  ElemID,
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import changeValidator from '../../src/change_validators/animation_rule_recordtype'
import { METADATA_TYPE, SALESFORCE } from '../../src/constants'
import { createInstanceElement } from '../../src/transformers/transformer'

describe('Invalid AnimationRule RecordType change validator', () => {
  const animationRuleType = new ObjectType({
    elemID: new ElemID(SALESFORCE, 'AnimationRule'),
    fields: {
      recordTypeContext: {
        refType: BuiltinTypes.STRING,
      },
      recordTypeId: {
        refType: BuiltinTypes.SERVICE_ID,
      },
    },
    annotations: {
      [METADATA_TYPE]: 'AnimationRule',
    },
  })
  const animationRuleInstance = createInstanceElement(
    {
      fullName: new ElemID(
        SALESFORCE,
        'AnimationRule',
        'instance',
        'SomeAnimationRule',
      ).getFullName(),
    },
    animationRuleType,
  )
  it('should fail validation if the RecordTypeContext is invalid', async () => {
    const instance = animationRuleInstance.clone()
    instance.value.recordTypeContext = 'Custom'

    const errors = await changeValidator([toChange({ after: instance })])
    expect(errors).not.toBeEmpty()
    expect(errors[0].message).toEqual('Invalid AnimationRule RecordType')
  })
  it('should pass validation if the RecordTypeContext expects a RecordTypeId and it exists', async () => {
    const instance = animationRuleInstance.clone()
    instance.value.recordTypeContext = 'Custom'
    instance.value.recordTypeId = 'SomeId'

    const errors = await changeValidator([toChange({ after: instance })])
    expect(errors).toBeEmpty()
  })
  it("should pass validation if the RecordTypeContext doesn't require a RecordTypeId", async () => {
    const instance = animationRuleInstance.clone()
    instance.value.recordTypeContext = 'All'

    const errors = await changeValidator([toChange({ after: instance })])
    expect(errors).toBeEmpty()
  })
})
