import { config } from '../../src/internal/env'
import {
  EnabledForNamespaceChecker, ConfigValidationError,
} from '../../src/internal/common'

describe('env', () => {
  describe('config', () => {
    describe('minLevel', () => {
      describe('when the env variable is not defined', () => {
        it('should return undefined', () => {
          expect(config({}).minLevel).toBeUndefined()
        })
      })

      describe('when the env variable is an illegal level', () => {
        const attempt = (): unknown => config({ SALTO_LOG_LEVEL: 'nosuchlevel' })

        it('should throw a validation error', () => {
          expect(attempt).toThrow(/Invalid log level "nosuchlevel"/)
          expect(attempt).toThrow(ConfigValidationError)
        })
      })

      describe('when the env variable is a legal level', () => {
        it('should return the level', () => {
          expect(config({ SALTO_LOG_LEVEL: 'error' }).minLevel).toEqual('error')
        })
      })
    })

    describe('filename', () => {
      describe('when the env variable is not defined', () => {
        it('should return undefined', () => {
          expect(config({}).filename).toBeUndefined()
        })
      })

      describe('when the env variable is defined', () => {
        it('should return the level', () => {
          expect(config({ SALTO_LOG_FILE: 'myfile' }).filename).toEqual('myfile')
        })
      })
    })

    describe('format', () => {
      describe('when the env variable is not defined', () => {
        it('should return undefined', () => {
          expect(config({}).format).toBeUndefined()
        })
      })

      describe('when the env variable is an illegal format', () => {
        const attempt = (): unknown => config({ SALTO_LOG_FORMAT: 'nosuchformat' })
        it('should throw a validation error', () => {
          expect(attempt).toThrow(/Invalid log format "nosuchformat"/)
          expect(attempt).toThrow(ConfigValidationError)
        })
      })

      describe('when the env variable is a legal format', () => {
        it('should return the level', () => {
          expect(config({ SALTO_LOG_FORMAT: 'json' }).format).toEqual('json')
        })
      })
    })

    describe('colorize', () => {
      describe('when the env variable is not defined', () => {
        it('should return undefined', () => {
          expect(config({}).colorize).toBeUndefined()
        })
      })

      describe('when the env variable translates to "true"', () => {
        '1 true yes'.split(' ').forEach(val => {
          it('should return true', () => {
            expect(config({ SALTO_LOG_COLOR: val }).colorize).toBe(true)
          })
        })
      })

      describe('when the env variable does not translate to true', () => {
        'no banana 0 false'.split(' ').forEach(val => {
          it('should return false', () => {
            expect(config({ SALTO_LOG_COLOR: val }).colorize).toBe(false)
          })
        })
      })
    })
  })

  describe('enabledForNamespace', () => {
    describe('when the env variable is not defined', () => {
      it('should return undefined', () => {
        expect(config({}).enabledForNamespace).toBeUndefined()
      })
    })

    describe('when the env variable is "*"', () => {
      const enabledForNamespace = config({
        SALTO_LOG_NS: '*',
      }).enabledForNamespace as EnabledForNamespaceChecker

      it('should return true always', () => {
        expect(enabledForNamespace('bla')).toBeTruthy()
        expect(enabledForNamespace('bla.bla')).toBeTruthy()
      })
    })

    describe('when the env variable is a string with no "*"', () => {
      const enabledForNamespace = config({
        SALTO_LOG_NS: 'some-namespace',
      }).enabledForNamespace as EnabledForNamespaceChecker

      it('should return true for this specific namespace', () => {
        expect(enabledForNamespace('some-namespace')).toBeTruthy()
      })

      it('should return false for every other namespace', () => {
        expect(enabledForNamespace('SOME-NAMESPACE')).toBeFalsy()
        expect(enabledForNamespace('bla')).toBeFalsy()
        expect(enabledForNamespace('bla.bla')).toBeFalsy()
      })
    })

    describe('when the env variable is a string containing a prefix "*"', () => {
      const enabledForNamespace = config({
        SALTO_LOG_NS: '*.some-namespace',
      }).enabledForNamespace as EnabledForNamespaceChecker

      it('should return true for a namespace ending with the specified value', () => {
        expect(enabledForNamespace('other-namespace.some-namespace')).toBeTruthy()
        expect(enabledForNamespace('other-namespace.other-namespace.some-namespace')).toBeTruthy()
      })

      it('should work well with namespaces.concat', () => {
        expect(enabledForNamespace('other-namespace.some-namespace')).toBeTruthy()
      })

      it('should return false for a namespace starting with the specified value', () => {
        expect(enabledForNamespace('some-namespace.other-namespace')).toBeFalsy()
      })

      it('should return false for this specific namespace alone', () => {
        expect(enabledForNamespace('some-namespace')).toBeFalsy()
      })

      it('should return false for every other namespace', () => {
        expect(enabledForNamespace('SOME-NAMESPACE')).toBeFalsy()
        expect(enabledForNamespace('bla')).toBeFalsy()
        expect(enabledForNamespace('bla.bla')).toBeFalsy()
      })
    })

    describe('when the env variable is a string containing a trailing "*"', () => {
      const enabledForNamespace = config({
        SALTO_LOG_NS: 'some-namespace.*',
      }).enabledForNamespace as EnabledForNamespaceChecker

      it('should return true for a namespace starting with the specified value', () => {
        expect(enabledForNamespace('some-namespace.other-namespace')).toBeTruthy()
        expect(enabledForNamespace('some-namespace.other-namespace.other-namespace')).toBeTruthy()
      })

      it('should work well with namespaces.concat', () => {
        expect(enabledForNamespace('some-namespace.other-namespace')).toBeTruthy()
      })

      it('should return false for a namespace ending with the specified value', () => {
        expect(enabledForNamespace('other-namespace.some-namespace')).toBeFalsy()
      })

      it('should return false for this specific namespace alone', () => {
        expect(enabledForNamespace('some-namespace')).toBeFalsy()
      })

      it('should return false for every other namespace', () => {
        expect(enabledForNamespace('SOME-NAMESPACE')).toBeFalsy()
        expect(enabledForNamespace('bla')).toBeFalsy()
        expect(enabledForNamespace('bla.bla')).toBeFalsy()
      })
    })
  })
})
