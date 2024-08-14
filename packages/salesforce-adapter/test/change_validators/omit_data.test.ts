/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeError, ElemID, InstanceElement, ObjectType, toChange, ChangeValidator } from '@salto-io/adapter-api'
import createCheckOnlyDeployValidator from '../../src/change_validators/omit_data'
import { CUSTOM_OBJECT } from '../../src/constants'

describe('checkOnly deploy validator', () => {
  const customObj = new ObjectType({
    elemID: new ElemID('salesforce', 'customObj'),
    annotations: { metadataType: CUSTOM_OBJECT, apiName: 'obj__c' },
  })
  const beforeCustomObjInstance = new InstanceElement('customObjInstance', customObj, { field: 'beforeValue' })
  const afterCustomObjInstance = new InstanceElement('customObjInstance', customObj, { field: 'afterValue' })

  const typeObj = new ObjectType({
    elemID: new ElemID('salesforce', 'obj'),
  })
  const beforeInstance = new InstanceElement('instance', typeObj, {
    field: 'beforeValue',
  })
  const afterInstance = new InstanceElement('instance', typeObj, {
    field: 'afterValue',
  })

  let validator: ChangeValidator
  beforeEach(() => {
    validator = createCheckOnlyDeployValidator
  })
  describe('with custom object instance change', () => {
    let changeErrors: ReadonlyArray<ChangeError>
    beforeEach(async () => {
      changeErrors = await validator([
        toChange({
          before: beforeCustomObjInstance,
          after: afterCustomObjInstance,
        }),
      ])
    })
    it('should have Error for CustomObject instance modification', async () => {
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(beforeCustomObjInstance.elemID)
      expect(changeError.severity).toEqual('Error')
    })
  })

  describe('with regular instance change', () => {
    let changeErrors: ReadonlyArray<ChangeError>
    beforeEach(async () => {
      changeErrors = await validator([toChange({ before: beforeInstance, after: afterInstance })])
    })
    it('should have no errors', () => {
      expect(changeErrors).toHaveLength(0)
    })
  })
})
