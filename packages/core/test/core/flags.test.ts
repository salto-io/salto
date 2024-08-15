/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { setupEnvVar } from '@salto-io/test-utils'
import { getCoreFlag, getCoreFlagBool, CORE_FLAGS, CORE_FLAG_PREFIX } from '../../src/core/flags'

describe('getCoreFlag', () => {
  const flagName = CORE_FLAG_PREFIX + CORE_FLAGS.skipResolveTypesInElementSource

  describe('when flag is not set', () => {
    setupEnvVar(flagName, undefined)
    it('should return undefined', () => {
      expect(getCoreFlag(CORE_FLAGS.skipResolveTypesInElementSource)).toBeUndefined()
    })
  })
  describe('when flag is set', () => {
    setupEnvVar(flagName, 'true')
    it('should return the flag value as a string', () => {
      expect(getCoreFlag(CORE_FLAGS.skipResolveTypesInElementSource)).toEqual('true')
    })
  })
})

describe('getCoreFlagBool', () => {
  const flagName = CORE_FLAG_PREFIX + CORE_FLAGS.skipResolveTypesInElementSource

  describe('when flag is not set', () => {
    setupEnvVar(flagName, undefined)
    it('should return false', () => {
      expect(getCoreFlagBool(CORE_FLAGS.skipResolveTypesInElementSource)).toBeFalse()
    })
  })
  describe.each(['true', '1'])('when flag is set to truthy value %s', value => {
    setupEnvVar(flagName, value)
    it('should return true', () => {
      expect(getCoreFlagBool(CORE_FLAGS.skipResolveTypesInElementSource)).toBeTrue()
    })
  })
  describe.each(['false', '0'])('when flag is set to falsy value %s', value => {
    setupEnvVar(flagName, value)
    it('should return false', () => {
      expect(getCoreFlagBool(CORE_FLAGS.skipResolveTypesInElementSource)).toBeFalse()
    })
  })
})
