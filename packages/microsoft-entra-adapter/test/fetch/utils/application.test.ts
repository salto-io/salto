/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { IDENTIFIER_URIS_FIELD_NAME } from '../../../src/constants'
import { adjustApplication } from '../../../src/definitions/fetch/utils'
import { contextMock } from '../../mocks'

describe(`${adjustApplication.name}`, () => {
  it('should throw an error when value is not an object', async () => {
    await expect(
      adjustApplication({ value: 'not an object', typeName: 'typeName', context: contextMock }),
    ).rejects.toThrow()
  })

  it('should throw an error when identifiersUri field is not an array', async () => {
    await expect(
      adjustApplication({
        value: { [IDENTIFIER_URIS_FIELD_NAME]: 'not an array' },
        typeName: 'typeName',
        context: contextMock,
      }),
    ).rejects.toThrow()
  })

  it('should not throw an error when identifierUris field is missing', async () => {
    await expect(adjustApplication({ value: {}, typeName: 'typeName', context: contextMock })).resolves.not.toThrow()
  })

  it('should filter out identifierUris with of the form api://<appId>', async () => {
    const appId = 'appId'
    const identifierUris = [`api://${appId}`, 'otherUri', `api://not${appId}`]
    const result = await adjustApplication({
      value: { [IDENTIFIER_URIS_FIELD_NAME]: identifierUris, appId },
      typeName: 'typeName',
      context: contextMock,
    })
    expect(result.value[IDENTIFIER_URIS_FIELD_NAME]).toEqual(['otherUri', `api://not${appId}`])
  })
})
