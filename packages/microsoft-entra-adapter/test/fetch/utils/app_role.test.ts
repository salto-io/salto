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

import _ from 'lodash'
import { APP_ROLES_FIELD_NAME, PARENT_ID_FIELD_NAME } from '../../../src/constants'
import { addParentIdToAppRoles } from '../../../src/definitions/fetch/utils'

describe(`${addParentIdToAppRoles.name}`, () => {
  it('should throw an error when appRoles is not an array', async () => {
    expect(() => addParentIdToAppRoles({ [APP_ROLES_FIELD_NAME]: 'not an array' })).toThrow()
  })

  it('should not throw an error when appRoles field is missing', async () => {
    expect(() => addParentIdToAppRoles({ otherField: 1 })).not.toThrow()
  })

  it('should throw an error when appRoles contains non-object elements', async () => {
    expect(() =>
      addParentIdToAppRoles({
        [APP_ROLES_FIELD_NAME]: ['not an object'],
      }),
    ).toThrow()
  })

  it('should add the parent id to each of the app roles', async () => {
    const appRoles = [
      { id: 'id1', otherField: 'other1' },
      { id: 'id2', otherField: 'other2' },
    ]
    const value = { id: 'parentId', [APP_ROLES_FIELD_NAME]: appRoles }
    const resultAppRoles = addParentIdToAppRoles(value)
    expect(_.get(resultAppRoles[0], PARENT_ID_FIELD_NAME)).toEqual('parentId')
    expect(_.get(resultAppRoles[1], PARENT_ID_FIELD_NAME)).toEqual('parentId')
  })
})
