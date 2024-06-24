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
import { LogLevel } from '../../src/internal/level'
import {
  mergeConfigs,
  DEFAULT_CONFIG,
  Config,
  cloneConfig,
  NamespaceFilter,
  stringToNamespaceFilter,
} from '../../src/internal/config'

describe('config', () => {
  describe('mergeConfigs', () => {
    let config: Config
    describe('when given an object with undefined values', () => {
      const o = Object.freeze(
        Object.assign(
          {},
          ...'minLevel filename format namespaceFilter colorize'.split(' ').map(p => ({
            [p]: undefined,
          })),
        ),
      )

      beforeEach(() => {
        config = mergeConfigs(o)
      })

      describe('the output Config object', () => {
        it('should have the same values as the default config', () => {
          expect(config).toEqual(DEFAULT_CONFIG)
        })

        it('should not be the DEFAULT_CONFIG itself', () => {
          expect(config).not.toBe(DEFAULT_CONFIG)
        })
      })
    })

    describe('when given an object with some defined values', () => {
      const o = { minLevel: 'info' as LogLevel }

      beforeEach(() => {
        config = mergeConfigs(o)
      })

      describe('the output Config object', () => {
        it('should have the given properties set to the given values', () => {
          expect(config.minLevel).toBe('info')
        })

        it('should have the rest of the properties set to the defaults', () => {
          ;(Object.keys(DEFAULT_CONFIG) as (keyof Config)[]).forEach(key => {
            if (key !== 'minLevel') {
              expect(config[key]).toEqual(DEFAULT_CONFIG[key])
            }
          })
        })
      })
    })

    describe('when given multiple objects with some defined values', () => {
      const o1 = { minLevel: 'info' as LogLevel }
      const o2 = { minLevel: 'debug' as LogLevel, filename: 'myfile' }

      beforeEach(() => {
        config = mergeConfigs(o1, o2)
      })

      describe('the output Config object', () => {
        it('should have the given properties set to the given values', () => {
          expect(config.minLevel).toBe('debug')
          expect(config.filename).toBe('myfile')
        })

        it('should have the rest of the properties set to the defaults', () => {
          ;(Object.keys(DEFAULT_CONFIG) as (keyof Config)[]).forEach(key => {
            if (!['minLevel', 'filename'].includes(key)) {
              expect(config[key]).toEqual(DEFAULT_CONFIG[key])
            }
          })
        })
      })
    })
  })

  describe('cloneConfig', () => {
    let config: Config
    let clone: Config

    beforeEach(() => {
      config = mergeConfigs()
      clone = cloneConfig(config)
    })

    it('should create a shallow copy', () => {
      expect(clone).toEqual(config)
      expect(clone.namespaceFilter).toBe(config.namespaceFilter)
    })

    it('should not return the original', () => {
      expect(clone).not.toBe(config)
    })
  })

  describe('stringToNamespaceFilter', () => {
    let filter: NamespaceFilter

    describe('when it is "*"', () => {
      beforeEach(() => {
        filter = stringToNamespaceFilter('*')
      })

      it('will always return true', () => {
        expect(['', 'bla', 'bla.bla'].map(filter)).not.toContain(false)
      })
    })

    describe('when it is an empty string', () => {
      beforeEach(() => {
        filter = stringToNamespaceFilter('')
      })

      it('will return true for an empty string', () => {
        expect(filter('')).toBeTruthy()
      })

      it('will return false for every non-empty string', () => {
        expect(['blahaha', 'mu.haha'].map(filter)).not.toContain(true)
      })
    })

    describe('when it is a specific namespace', () => {
      beforeEach(() => {
        filter = stringToNamespaceFilter('bla')
      })

      it('will return true for that namespace', () => {
        expect(filter('bla')).toBeTruthy()
      })

      it('will always return false for other values', () => {
        expect(['', 'abla', 'bla.bla'].map(filter)).not.toContain(true)
      })
    })

    describe('when it contains a star suffix', () => {
      beforeEach(() => {
        filter = stringToNamespaceFilter('bla*')
      })

      it('will return true for that namespace', () => {
        expect(filter('bla')).toBeTruthy()
      })

      it('will return true for a namespace starting with the prefix', () => {
        expect(filter('blahaha')).toBeTruthy()
      })

      it('will return false for other values', () => {
        expect(['', 'abla', 'mu'].map(filter)).not.toContain(true)
      })
    })

    describe('when it contains a star prefix', () => {
      beforeEach(() => {
        filter = stringToNamespaceFilter('*bla')
      })

      it('will return true for that namespace', () => {
        expect(filter('bla')).toBeTruthy()
      })

      it('will return true for a namespace ending with the prefix', () => {
        expect(filter('hahabla')).toBeTruthy()
      })

      it('will return false for other values', () => {
        expect(['', 'blahaha', 'mu'].map(filter)).not.toContain(true)
      })
    })
  })
})
