/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, ElemID, ObjectType, toChange } from '@salto-io/adapter-api'
import changeValidator from '../../src/change_validators/animation_rule_record_type'
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
      fullName: new ElemID(SALESFORCE, 'AnimationRule', 'instance', 'SomeAnimationRule').getFullName(),
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
