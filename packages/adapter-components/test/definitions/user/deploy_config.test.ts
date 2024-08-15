/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ElemID, ObjectType } from '@salto-io/adapter-api'
import { createUserDeployConfigType, validateDefaultMissingUserFallbackConfig } from '../../../src/definitions/user'

describe('config_shared', () => {
  describe('createUserDeployConfigType', () => {
    it('should return default type when no custom fields were added', () => {
      const type = createUserDeployConfigType('myAdapter', new ObjectType({ elemID: new ElemID('test') }))
      expect(Object.keys(type.fields)).toHaveLength(1)
      expect(type.fields.changeValidators).toBeDefined()
    })
  })
  describe('validateDefaultMissingUserFallbackConfig', () => {
    it('should not throw if defaultMissingUserFallback is ##DEPLOYER##', () => {
      expect(() =>
        validateDefaultMissingUserFallbackConfig(
          'deploy',
          { defaultMissingUserFallback: '##DEPLOYER##' },
          (): boolean => true,
        ),
      ).not.toThrow()
    })

    it('should throw if validateUserFunc returns false', async () => {
      expect(() =>
        validateDefaultMissingUserFallbackConfig(
          'deploy',
          { defaultMissingUserFallback: 'invalid@user.name' },
          (): boolean => false,
        ),
      ).toThrow(
        new Error(
          'Invalid user value in deploy.defaultMissingUserFallback: invalid@user.name. Value can be either ##DEPLOYER## or a valid user name',
        ),
      )
    })
  })
})
