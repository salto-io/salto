/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { InstanceElement, ObjectType, ElemID, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'

import { USER_FIELD_TYPE_NAME, ZENDESK } from '../../src/constants'
import { immutableTypeAndKeyForUserFieldsValidator } from '../../src/change_validators'

const createUserField = (name: string): InstanceElement =>
  new InstanceElement(name, new ObjectType({ elemID: new ElemID(ZENDESK, USER_FIELD_TYPE_NAME) }), {
    key: 'test_key',
    type: 'text',
  })

describe('immutableTypeAndKeyForUserFieldsValidator', () => {
  let userFieldInstance: InstanceElement
  beforeEach(() => {
    userFieldInstance = createUserField('userField')
  })

  it('should return an error when the user field key is changed', async () => {
    const changedUserFieldInstance = userFieldInstance.clone()
    changedUserFieldInstance.value.key = 'new_key'
    const changes = [toChange({ before: userFieldInstance, after: changedUserFieldInstance })]
    const elementsSource = buildElementsSourceFromElements([changedUserFieldInstance])
    const errors = await immutableTypeAndKeyForUserFieldsValidator(changes, elementsSource)

    expect(errors).toHaveLength(1)
  })
  it('should return an error when the user field type is changed', async () => {
    const changedUserFieldInstance = userFieldInstance.clone()
    changedUserFieldInstance.value.type = 'dropdown'
    const changes = [toChange({ before: userFieldInstance, after: changedUserFieldInstance })]
    const elementsSource = buildElementsSourceFromElements([changedUserFieldInstance])
    const errors = await immutableTypeAndKeyForUserFieldsValidator(changes, elementsSource)

    expect(errors).toHaveLength(1)
  })

  it('should not return errors when other fields are changed', async () => {
    const changedUserFieldInstance = userFieldInstance.clone()
    changedUserFieldInstance.value.description = 'i am a new description'
    const changes = [toChange({ before: userFieldInstance, after: changedUserFieldInstance })]
    const elementsSource = buildElementsSourceFromElements([changedUserFieldInstance])
    const errors = await immutableTypeAndKeyForUserFieldsValidator(changes, elementsSource)

    expect(errors).toHaveLength(0)
  })
})
