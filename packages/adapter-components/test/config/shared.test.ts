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
import { createUserDeployConfigType, createUserFetchConfigType, getConfigWithDefault, validateDeployConfig } from '../../src/config'

describe('config_shared', () => {
  describe('createUserFetchConfigType', () => {
    it('should return default type when no custom fields were added', () => {
      const type = createUserFetchConfigType('myAdapter')
      expect(Object.keys(type.fields)).toHaveLength(3)
      expect(type.fields.include).toBeDefined()
      expect(type.fields.exclude).toBeDefined()
      expect(type.fields.hideTypes).toBeDefined()
    })
  })
  describe('createUserDeployConfigType', () => {
    it('should return default type when no custom fields were added', () => {
      const type = createUserDeployConfigType('myAdapter')
      expect(Object.keys(type.fields)).toHaveLength(1)
      expect(type.fields.defaultMissingUserFallback).toBeDefined()
    })
  })
  describe('getConfigWithDefault', () => {
    it('should return the config with defaults for adapter api when type-specific config is provided', () => {
      expect(getConfigWithDefault(
        { url: 'abc', queryParams: { a: 'specific' } },
        { paginationField: 'page', queryParams: { b: 'default' } }
      )).toEqual({ url: 'abc', queryParams: { a: 'specific' }, paginationField: 'page' })
      expect(getConfigWithDefault(
        { standaloneFields: [{ fieldName: 'specific' }] },
        { idFields: ['a', 'b'], standaloneFields: [{ fieldName: 'default' }] },
      )).toEqual({ idFields: ['a', 'b'], standaloneFields: [{ fieldName: 'specific' }] })
    })
    it('should return the config with defaults for adapter api  when type-specific config is missing', () => {
      expect(getConfigWithDefault(
        undefined,
        { paginationField: 'page', queryParams: { b: 'default' } }
      )).toEqual({ paginationField: 'page', queryParams: { b: 'default' } })
      expect(getConfigWithDefault(
        undefined,
        { idFields: ['a', 'b'], standaloneFields: [{ fieldName: 'default' }] },
      )).toEqual({ idFields: ['a', 'b'], standaloneFields: [{ fieldName: 'default' }] })
    })
  })
  describe('validateDeployConfig', () => {
    it('should not throw if defaultMissingUserFallback is ##DEPLOYER##', () => {
      expect(() => validateDeployConfig(
        'deploy',
        { defaultMissingUserFallback: '##DEPLOYER##' },
        (): boolean => true,
      )).not.toThrow()
    })

    it('should throw if validateUserFunc returns false', async () => {
      expect(() => validateDeployConfig(
        'deploy',
        { defaultMissingUserFallback: 'invalid@user.name' },
        (): boolean => false,
      )).toThrow(new Error('Invalid user value in deploy.defaultMissingUserFallback: invalid@user.name. Value can be either ##DEPLOYER## or a valid user name'))
    })
  })
})
