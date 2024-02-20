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
import { namespaceNormalizer, toHexColor } from '../../src/internal/namespace'

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

  /**
   * Note: The correct normalized namespace should not include the "packages" dir
   * but here they're included in tests since the logger assumes we run
   * from "dist" while the tests use the typescript modules.
   */
  describe('namespaceNormalizer', () => {
    const LAST_LIBRARY_FILENAME = 'logging/src/internal/namespace'
    const normalizeNamespace = namespaceNormalizer(LAST_LIBRARY_FILENAME)
    describe('when a module is specified', () => {
      describe('when the id property is a string', () => {
        it('should return the correct namespace', () => {
          expect(normalizeNamespace(module)).toEqual('packages/logging/test/internal/namespace.test')
        })
        it('should return the correct namespace with extra fragments', () => {
          expect(normalizeNamespace(module, ['foo', 'bar'])).toEqual(
            'packages/logging/test/internal/namespace.test/foo/bar',
          )
        })
      })

      describe('when the id property is a number', () => {
        describe('when the lastLibraryFilename is found in the stack', () => {
          it('should return the correct namespace', () => {
            expect(normalizeNamespace({ id: 12 })).toEqual('packages/logging/test/internal/namespace.test')
          })
          it('should return the correct namespace with extra fragments', () => {
            expect(normalizeNamespace({ id: 12 }, ['foo', 'bar'])).toEqual(
              'packages/logging/test/internal/namespace.test/foo/bar',
            )
          })
        })

        describe('when the lastLibraryFilename is not found in the stack', () => {
          it('should return the id as string', () => {
            expect(namespaceNormalizer('NOSUCHFILENAME')({ id: 12 })).toEqual('12')
          })
          it('should return the id as string with more fragments', () => {
            expect(namespaceNormalizer('NOSUCHFILENAME')({ id: 12 }, ['foo', 'bar'])).toEqual('12/foo/bar')
          })
        })
      })
    })

    describe('when a string is specified', () => {
      it('should return its name as a string', () => {
        expect(normalizeNamespace('my-namespace')).toEqual('my-namespace')
      })
      it('should return its name as a string with more fragments', () => {
        expect(normalizeNamespace('my-namespace', ['foo', 'bar'])).toEqual('my-namespace/foo/bar')
      })
    })
  })
})
