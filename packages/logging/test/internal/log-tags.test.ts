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

import { formatPrimitiveLogTagValue, formatLogTags } from '../../src/internal/log-tags'

describe('logTags', () => {
  // The rest of the coverage is covered in pino_logger.test.ts
  describe('formatPrimitiveLogTagValue', () => {
    it('should return string from number', () => {
      expect(formatPrimitiveLogTagValue(5)).toEqual('5')
    })
    it('should return string from boolean', () => {
      expect(formatPrimitiveLogTagValue(true)).toEqual('true')
    })
    it('should return string from string', () => {
      expect(formatPrimitiveLogTagValue('foo')).toEqual('"foo"')
    })
    it('should return empty from undefined', () => {
      expect(formatPrimitiveLogTagValue(undefined)).toEqual('')
    })
    it('should return stringified from string', () => {
      expect(formatPrimitiveLogTagValue('"foo')).toEqual(JSON.stringify('"foo'))
    })
  })
  describe('formatLogTags', () => {
    it('should return empty string for function value', () => {
      expect(formatLogTags({ some: () => { throw Error('') } }, [])).toEqual('')
    })
  })
})
