/*
*                      Copyright 2020 Salto Labs Ltd.
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
import * as mocks from '../mocks'
import { getAndValidateActiveServices } from '../../src/commands/commons/services'

describe('Commands commons tests', () => {
  describe('getAndValidateActiveServices with workspace with services', () => {
    const mockWorkspace = mocks.mockLoadWorkspace('ws', undefined, undefined, undefined, ['service1', 'service2', 'service3'])

    it('Should return the workspaces\' services if no input services provided', () => {
      const result = getAndValidateActiveServices(mockWorkspace, undefined)
      expect(result).toEqual(mockWorkspace.services())
    })

    it('Should return the specified services is it exists in the Workspace', () => {
      const result = getAndValidateActiveServices(mockWorkspace, ['service1', 'service3'])
      expect(result).toEqual(['service1', 'service3'])
    })

    it('Should throw an errir if the service does not exist in the workspace', () => {
      expect(() => getAndValidateActiveServices(mockWorkspace, ['wtfService'])).toThrow()
    })
  })
  describe('getAndValidateActiveServices with workspace with no services', () => {
    const mockWorkspace = mocks.mockLoadWorkspace('ws', undefined, undefined, undefined, [])
    it('Should throw an error if no input services provided', () => {
      expect(() => getAndValidateActiveServices(mockWorkspace, undefined)).toThrow()
    })

    it('Should throw an error if input services were provided', () => {
      expect(() => getAndValidateActiveServices(mockWorkspace, ['wtfService'])).toThrow()
    })
  })
})
