/*
*                      Copyright 2021 Salto Labs Ltd.
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

import { ConfigValidationError } from '../../src/config_validation'
import { validateMetadataParams } from '../../src/fetch_profile/metadata_query'

describe('validateMetadataParams', () => {
  describe('invalid regex in include list', () => {
    let error: Error | undefined
    beforeEach(() => {
      error = undefined
    })

    it('invalid metadataType', () => {
      try {
        validateMetadataParams({
          include: [
            { metadataType: '(' },
          ],
        })
      } catch (e) {
        error = e
      }
      expect(error instanceof ConfigValidationError).toBeTruthy()
      expect((error as ConfigValidationError).fieldPath).toEqual(['metadata', 'include', 'metadataType'])
    })

    it('invalid namespace', () => {
      try {
        validateMetadataParams({
          include: [
            { namespace: '(' },
          ],
        })
      } catch (e) {
        error = e
      }
      expect(error instanceof ConfigValidationError).toBeTruthy()
      expect((error as ConfigValidationError).fieldPath).toEqual(['metadata', 'include', 'namespace'])
    })

    it('invalid name', () => {
      try {
        validateMetadataParams({
          include: [
            { name: '(' },
          ],
        })
      } catch (e) {
        error = e
      }
      expect(error instanceof ConfigValidationError).toBeTruthy()
      expect((error as ConfigValidationError).fieldPath).toEqual(['metadata', 'include', 'name'])
    })
  })

  describe('invalid regex in exclude list', () => {
    let error: Error | undefined
    beforeEach(() => {
      error = undefined
    })

    it('invalid metadataType', () => {
      try {
        validateMetadataParams({
          exclude: [
            { metadataType: '(' },
          ],
        })
      } catch (e) {
        error = e
      }
      expect(error instanceof ConfigValidationError).toBeTruthy()
      expect((error as ConfigValidationError).fieldPath).toEqual(['metadata', 'exclude', 'metadataType'])
    })

    it('invalid namespace', () => {
      try {
        validateMetadataParams({
          exclude: [
            { namespace: '(' },
          ],
        })
      } catch (e) {
        error = e
      }
      expect(error instanceof ConfigValidationError).toBeTruthy()
      expect((error as ConfigValidationError).fieldPath).toEqual(['metadata', 'exclude', 'namespace'])
    })

    it('invalid name', () => {
      try {
        validateMetadataParams({
          exclude: [
            { name: '(' },
          ],
        })
      } catch (e) {
        error = e
      }
      expect(error instanceof ConfigValidationError).toBeTruthy()
      expect((error as ConfigValidationError).fieldPath).toEqual(['metadata', 'exclude', 'name'])
    })
  })

  it('valid parameters should not throw', () => {
    validateMetadataParams({
      exclude: [
        { name: '.*', metadataType: 'aaaa', namespace: undefined },
      ],
    })
  })
})
