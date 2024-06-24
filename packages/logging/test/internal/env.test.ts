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
import { config } from '../../src/internal/env'
import { ValidationError } from '../../src/internal/common'

describe('env', () => {
  describe('config', () => {
    describe('minLevel', () => {
      describe('when the env variable is not defined', () => {
        it('should return undefined', () => {
          expect(config({}).minLevel).toBeUndefined()
        })
      })

      describe('when the env variable is an empty string', () => {
        it('should return undefined', () => {
          expect(config({ SALTO_LOG_LEVEL: '' }).minLevel).toBeUndefined()
        })
      })

      describe('when the env variable is an illegal level', () => {
        const attempt = (): unknown => config({ SALTO_LOG_LEVEL: 'nosuchlevel' })

        it('should throw a validation error', () => {
          expect(attempt).toThrow(/Invalid log level "nosuchlevel"/)
          expect(attempt).toThrow(ValidationError)
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
          expect(config({ SALTO_LOG_FILE: '' }).filename).toBeUndefined()
        })
      })

      describe('when the env variable is an empty string', () => {
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

      describe('when the env variable is an empty string', () => {
        it('should return undefined', () => {
          expect(config({ SALTO_LOG_FORMAT: '' }).format).toBeUndefined()
        })
      })

      describe('when the env variable is an illegal format', () => {
        const attempt = (): unknown => config({ SALTO_LOG_FORMAT: 'nosuchformat' })
        it('should throw a validation error', () => {
          expect(attempt).toThrow(/Invalid log format "nosuchformat"/)
          expect(attempt).toThrow(ValidationError)
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

      describe('when the env variable is an empty string', () => {
        it('should return undefined', () => {
          expect(config({ SALTO_LOG_COLOR: '' }).colorize).toBeUndefined()
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

  describe('namespaceFilter', () => {
    describe('when the env variable is not defined', () => {
      it('should return undefined', () => {
        expect(config({}).namespaceFilter).toBeUndefined()
      })
    })

    describe('when the env variable is an empty string', () => {
      it('should return undefined', () => {
        expect(config({ SALTO_LOG_NS: '' }).namespaceFilter).toBeUndefined()
      })
    })

    describe('when the env variable is defined and non-empty', () => {
      it('should return the definition', () => {
        expect(config({ SALTO_LOG_NS: 'BLA' }).namespaceFilter).toBe('BLA')
      })
    })
  })

  describe('globalLogTags', () => {
    describe('when the env variable is not defined', () => {
      it('should return undefined', () => {
        expect(config({}).globalTags).toBeUndefined()
      })
    })

    describe('when the env variable is an empty string', () => {
      it('should return undefined', () => {
        expect(config({ globalLogTags: '' }).globalTags).toBeUndefined()
      })
    })

    describe('when the env variable is defined and non-empty', () => {
      it('should return the definition', () => {
        expect(config({ SALTO_LOG_GLOBAL_TAGS: '{"requestId":20}' }).globalTags).toEqual({ requestId: 20 })
      })
    })

    describe('when the env variable is defined and non-empty and error', () => {
      it('should return the definition', () => {
        expect(() => config({ SALTO_LOG_GLOBAL_TAGS: '{requestId":20}' }).globalTags).toThrow(
          new Error('Unexpected token r in JSON at position 1'),
        )
      })
    })
  })

  describe('maxJsonLogChunkSize', () => {
    describe('when the env variable is not defined', () => {
      it('should return undefined', () => {
        expect(config({}).maxJsonLogChunkSize).toBeUndefined()
      })
    })

    describe('when the env variable is an invalid number', () => {
      it('should throw validation error', () => {
        expect(() => config({ SALTO_LOG_MAX_JSON_LOG_CHUNK_SIZE: 'aa' }).maxJsonLogChunkSize).toThrow(
          new ValidationError('invalid value "aa", expected number'),
        )
      })
    })

    describe('when the env variable is defined and a valid number', () => {
      it('should return the parsed definition for bytes', () => {
        expect(config({ SALTO_LOG_MAX_JSON_LOG_CHUNK_SIZE: '6' }).maxJsonLogChunkSize).toBe(6)
      })

      it('should return the parsed definition for large amount of bytes', () => {
        expect(config({ SALTO_LOG_MAX_JSON_LOG_CHUNK_SIZE: '68921234' }).maxJsonLogChunkSize).toBe(68921234)
      })
    })
  })

  describe('maxTagsPerLogLevel', () => {
    describe('when the env variable is not defined', () => {
      it('should return undefined', () => {
        expect(config({}).maxTagsPerLogMessage).toBeUndefined()
      })
    })

    describe('when the env variable is an invalid number', () => {
      it('should throw validation error', () => {
        expect(() => config({ SALTO_LOG_MAX_TAGS_PER_LOG_MESSAGE: 'aa' }).maxTagsPerLogMessage).toThrow(
          new ValidationError('invalid value "aa", expected number'),
        )
      })
    })

    describe('when the env variable is defined and a valid number', () => {
      it('should return the parsed definition for bytes', () => {
        expect(config({ SALTO_LOG_MAX_TAGS_PER_LOG_MESSAGE: '6' }).maxTagsPerLogMessage).toBe(6)
      })

      it('should return the parsed definition for large amount of bytes', () => {
        expect(config({ SALTO_LOG_MAX_TAGS_PER_LOG_MESSAGE: '68921234' }).maxTagsPerLogMessage).toBe(68921234)
      })
    })
  })
})
