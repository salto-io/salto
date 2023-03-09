/*
*                      Copyright 2023 Salto Labs Ltd.
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

import { transformToUserField, transformToId } from '../../../src/filters/formula_utils/utils'

describe('Formula utils', () => {
  test('User fields should be transformed to their original API name', () => {
    expect(transformToUserField('Owner.FirstName')).toEqual('User.FirstName')
    expect(transformToUserField('Manager.FirstName')).toEqual('User.FirstName')
    expect(transformToUserField('CreatedBy.FirstName')).toEqual('User.FirstName')
    expect(transformToUserField('LastModifiedBY.area__c')).toEqual('User.area__c')
  })

  test('The "transformToId" function should add "Id" at the end of the field name', () => {
    expect(transformToId('Owner.Manager')).toEqual('Owner.ManagerId')
  })
})
