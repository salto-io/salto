/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import {
  toChange,
  ObjectType,
  ElemID,
  InstanceElement,
  ReferenceExpression,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { userTypeAndSchemaValidator } from '../../src/change_validators/user_type_and_schema'
import { OKTA, USERTYPE_TYPE_NAME, USER_SCHEMA_TYPE_NAME } from '../../src/constants'

describe('userTypeAndSchemaValidator', () => {
  const userTypeType = new ObjectType({ elemID: new ElemID(OKTA, USERTYPE_TYPE_NAME) })
  const userSchemaType = new ObjectType({ elemID: new ElemID(OKTA, USER_SCHEMA_TYPE_NAME) })
  const userTypeA = new InstanceElement('typeA', userTypeType, { name: 'A', default: false })
  const userTypeB = new InstanceElement('typeB', userTypeType, { name: 'B', default: false })
  const userSchemaA = new InstanceElement('schemaA', userSchemaType, { name: 'A', definitions: {} }, undefined, {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(userTypeA.elemID, userTypeA)],
  })
  const userSchemaB = new InstanceElement('schemaB', userSchemaType, { name: 'B', definitions: {} }, undefined, {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(userTypeB.elemID, userTypeB)],
  })

  it('should return an error when userSchema is deleted without its parent UserType', async () => {
    const changeErrors = await userTypeAndSchemaValidator([
      toChange({ before: userSchemaA }),
      toChange({ before: userSchemaB }),
    ])
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors).toEqual([
      {
        elemID: userSchemaA.elemID,
        severity: 'Error',
        message: 'Cannot remove user schema without its parent user type',
        detailedMessage: 'In order to remove schemaA, the instance typeA of type UserType must be removed as well.',
      },
      {
        elemID: userSchemaB.elemID,
        severity: 'Error',
        message: 'Cannot remove user schema without its parent user type',
        detailedMessage: 'In order to remove schemaB, the instance typeB of type UserType must be removed as well.',
      },
    ])
  })
  it('should not return an error when UserSchema is deleted with its parent UserType', async () => {
    const changeErrors = await userTypeAndSchemaValidator([
      toChange({ before: userSchemaA }),
      toChange({ before: userTypeA }),
    ])
    expect(changeErrors).toHaveLength(0)
  })
})
