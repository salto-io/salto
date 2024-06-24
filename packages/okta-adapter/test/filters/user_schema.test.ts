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
  ObjectType,
  ElemID,
  InstanceElement,
  CORE_ANNOTATIONS,
  toChange,
  getChangeData,
  BuiltinTypes,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { OKTA, USER_SCHEMA_TYPE_NAME } from '../../src/constants'
import userSchemaFilter from '../../src/filters/user_schema'
import { getFilterParams } from '../utils'

describe('userSchemaFilter', () => {
  let filter: filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
  const userSchemaType = new ObjectType({
    elemID: new ElemID(OKTA, USER_SCHEMA_TYPE_NAME),
    fields: { description: { refType: BuiltinTypes.STRING } },
  })

  beforeEach(() => {
    jest.clearAllMocks()
    filter = userSchemaFilter(getFilterParams()) as typeof filter
  })

  describe('preDeploy', () => {
    it('should add get UserSchema id from the parent UserType Instance', async () => {
      const userSchemaInstace = new InstanceElement(
        'schema',
        userSchemaType,
        {
          definitions: {
            value: 'value',
          },
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [
            {
              id: 'userType',
              _links: {
                schema: {
                  href: 'https://okta.com/api/v1/meta/schemas/user/555',
                },
              },
            },
          ],
        },
      )
      const changes = [toChange({ after: userSchemaInstace })]
      await filter.preDeploy(changes)
      expect(getChangeData(changes[0]).value.id).toEqual('555')
    })
    it('should do nothing if _link object in the parent UserTypeis not in the expected format', async () => {
      const userSchemaInstace = new InstanceElement(
        'schema',
        userSchemaType,
        {
          definitions: {
            value: 'value',
          },
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [
            {
              id: 'userType',
              _links: {
                self: {
                  value: 'val',
                },
              },
            },
          ],
        },
      )
      const changes = [toChange({ after: userSchemaInstace })]
      await filter.preDeploy(changes)
      expect(getChangeData(changes[0]).value.id).toBeUndefined()
    })
  })
  describe('onDeploy', () => {
    it('should fix UserSchema id after deploy', async () => {
      const userSchemaInstace = new InstanceElement('schema', userSchemaType, {
        id: 'https://okta.com/api/v1/meta/schemas/user/555',
        definitions: {
          value: 'value',
        },
      })
      const changes = [toChange({ after: userSchemaInstace })]
      await filter.onDeploy(changes)
      expect(getChangeData(changes[0]).value.id).toEqual('555')
    })
  })
})
