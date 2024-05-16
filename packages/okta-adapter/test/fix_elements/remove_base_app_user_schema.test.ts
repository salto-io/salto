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
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  isInstanceElement,
  ObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { APPLICATION_TYPE_NAME, APP_USER_SCHEMA_TYPE_NAME, OKTA } from '../../src/constants'
import { removeBaseFromAppUserSchemaHandler } from '../../src/fix_elements/remove_base_app_user_schema'

describe('remove_base_app_user_schema', () => {
  const appSchemaType = new ObjectType({ elemID: new ElemID(OKTA, APP_USER_SCHEMA_TYPE_NAME) })
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const app1 = new InstanceElement('app1', appType, {
    id: '1',
    label: 'app1',
    status: 'INACTIVE',
    accessPolicy: 'accessPolicyId',
  })
  const appUserSchema = new InstanceElement(
    'appUserSchema1',
    appSchemaType,
    {
      title: 'user schema test',
      definitions: {
        custom: {
          properties: {
            property1: {
              type: 'string',
            },
          },
        },
        base: {
          properties: {
            baseProperty: {
              type: 'string',
            },
          },
        },
      },
    },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app1.elemID, app1)] },
  )
  it('should remove base from app user schema', async () => {
    const withoutBase = appUserSchema.clone()
    delete withoutBase.value.definitions.base
    const { fixedElements, errors } = await removeBaseFromAppUserSchemaHandler([appUserSchema])
    expect(errors).toHaveLength(1)
    expect(errors).toEqual([
      {
        elemID: appUserSchema.elemID,
        severity: 'Info',
        message: 'Removing the base field from app user schema',
        detailedMessage:
          'Okta does not support deploying changes in the base schema. Therefore, Salto removes the base field from the app user schema',
      },
    ])
    expect(fixedElements).toHaveLength(1)
    expect(isInstanceElement(fixedElements[0])).toBeTruthy()
    const fixedInstance = fixedElements[0] as InstanceElement
    expect(fixedInstance.isEqual(withoutBase)).toBeTruthy()
  })
})
