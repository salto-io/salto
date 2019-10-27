import { mergeConfigs, DEFAULT_CONFIG, LogLevel, Config } from '../../../src/logging/internal/common'

describe('common', () => {
  describe('mergeConfigs', () => {
    let config: Config
    describe('when given an object with undefined values', () => {
      const o = Object.freeze(Object.assign(
        {},
        ...'minLevel filename format enabledForNamespace colorize'.split(' ').map(p => ({
          [p]: undefined,
        }
        ))
      ))

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
          (Object.keys(DEFAULT_CONFIG) as (keyof Config)[]).forEach(key => {
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
          (Object.keys(DEFAULT_CONFIG) as (keyof Config)[]).forEach(key => {
            if (!['minLevel', 'filename'].includes(key)) {
              expect(config[key]).toEqual(DEFAULT_CONFIG[key])
            }
          })
        })
      })
    })
  })
})
