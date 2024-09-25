/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { StaticFile } from '@salto-io/adapter-api'
import { extractPayloadToStaticFile } from '../../../../../src/definitions/fetch/intune/utils/device_configuration'
import { contextMock } from '../../../../mocks'

describe('device configuration utils', () => {
  describe(`${extractPayloadToStaticFile.name}`, () => {
    it('should throw if value is not a plain object', async () => {
      await expect(
        extractPayloadToStaticFile({ value: 'value', typeName: 'test', context: contextMock }),
      ).rejects.toThrow()
    })

    it('should return the value as is if payload is missing', async () => {
      const value = { displayName: 'name' }
      expect(await extractPayloadToStaticFile({ value, typeName: 'test', context: contextMock })).toEqual({ value })
    })

    it('should return the value with the payload as a static file', async () => {
      const value = {
        displayName: 'name',
        payload:
          'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4NCjxub3RlPg0KICA8dG8+VGVzdDwvdG8+DQogIDxmcm9tPlRlc3RlcjwvZnJvbT4NCiAgPGhlYWRpbmc+UGxlYXNlIHdvcmsgbmljZWx5PC9oZWFkaW5nPg0KICA8Ym9keT5UaGFuayB5b3U8L2JvZHk+DQo8L25vdGU+',
        payloadFileName: 'payloadFileName',
      }
      const result = await extractPayloadToStaticFile({ value, typeName: 'test', context: contextMock })
      expect(result).toEqual({
        value: {
          ...value,
          payload: expect.any(StaticFile),
        },
      })
      expect(result.value.payload.filepath).toEqual('microsoft_security/IntuneDeviceConfiguration/name/payloadFileName')
    })
  })
})
