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
import {
  toHexColor, normalizeNamespaceOrModule,
} from '../../src/internal/namespace'

describe('namespace', () => {
  describe('toHexColor', () => {
    'my.namespace MY.namespace MYOTHERNAMESPACE'.split(' ').forEach(namespace => {
      it('should return the same color to each namespace on multiple invocations', () => {
        expect(toHexColor(namespace)).toEqual(toHexColor(namespace))
      })

      it('should return a hex color format', () => {
        expect(toHexColor(namespace)).toMatch(/#[0-9a-fA-F]{6}/)
      })
    })
  })

  describe('normalizeNamespaceOrModule', () => {
    describe('when a module is specified', () => {
      it('should return its name as a string', () => {
        expect(normalizeNamespaceOrModule(module))
          .toEqual('logging/test/internal/namespace.test')
      })
    })

    describe('when a string is specified', () => {
      it('should return its name as a string', () => {
        expect(normalizeNamespaceOrModule('my-namespace')).toEqual('my-namespace')
      })
    })
  })
})
