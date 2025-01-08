/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { setupEnvVar } from '@salto-io/test-utils'
import { getSaltoFlagBool, getSaltoFlag, SALTO_FLAG_PREFIX } from '../src/flags'

const TEST_ENV_VAR = 'TEST_ENV_VAR'

describe('getSaltoFlag', () => {
  const flagName = SALTO_FLAG_PREFIX + TEST_ENV_VAR

  describe('when flag is not set', () => {
    setupEnvVar(flagName, undefined)
    it('should return undefined', () => {
      expect(getSaltoFlag(TEST_ENV_VAR)).toBeUndefined()
    })
  })
  describe('when flag is set', () => {
    setupEnvVar(flagName, 'true')
    it('should return the flag value as a string', () => {
      expect(getSaltoFlag(TEST_ENV_VAR)).toEqual('true')
    })
  })
})

describe('getSaltoFlagBool', () => {
  const flagName = SALTO_FLAG_PREFIX + TEST_ENV_VAR

  describe('when flag is not set', () => {
    setupEnvVar(flagName, undefined)
    it('should return false', () => {
      expect(getSaltoFlagBool(TEST_ENV_VAR)).toBeFalse()
    })
  })
  describe.each(['true', '1'])('when flag is set to truthy value %s', value => {
    setupEnvVar(flagName, value)
    it('should return true', () => {
      expect(getSaltoFlagBool(TEST_ENV_VAR)).toBeTrue()
    })
  })
  describe.each(['false', '0'])('when flag is set to falsy value %s', value => {
    setupEnvVar(flagName, value)
    it('should return false', () => {
      expect(getSaltoFlagBool(TEST_ENV_VAR)).toBeFalse()
    })
  })
})
