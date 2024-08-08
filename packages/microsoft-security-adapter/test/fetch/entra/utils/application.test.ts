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

import { IDENTIFIER_URIS_FIELD_NAME } from '../../../../src/constants/entra'
import { adjustApplication } from '../../../../src/definitions/fetch/entra/utils'

describe(`${adjustApplication.name}`, () => {
  it('should throw an error when value is not an object', async () => {
    await expect(adjustApplication({ value: 'not an object', typeName: 'typeName', context: {} })).rejects.toThrow()
  })

  it('should throw an error when identifiersUri field is not an array', async () => {
    await expect(
      adjustApplication({
        value: { [IDENTIFIER_URIS_FIELD_NAME]: 'not an array' },
        typeName: 'typeName',
        context: {},
      }),
    ).rejects.toThrow()
  })

  it('should not throw an error when identifierUris field is missing', async () => {
    await expect(adjustApplication({ value: {}, typeName: 'typeName', context: {} })).resolves.not.toThrow()
  })

  it('should filter out identifierUris with of the form api://<appId>', async () => {
    const appId = 'appId'
    const identifierUris = [`api://${appId}`, 'otherUri', `api://not${appId}`]
    const result = await adjustApplication({
      value: { [IDENTIFIER_URIS_FIELD_NAME]: identifierUris, appId },
      typeName: 'typeName',
      context: {},
    })
    expect(result.value[IDENTIFIER_URIS_FIELD_NAME]).toEqual(['otherUri', `api://not${appId}`])
  })
})
