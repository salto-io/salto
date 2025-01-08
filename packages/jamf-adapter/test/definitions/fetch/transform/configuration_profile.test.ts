/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { adjustConfigurationProfile } from '../../../../src/definitions/fetch/transforms'
import { SALTO_MASKED_VALUE } from '../../../../src/definitions/fetch/transforms/utils'

describe('adjust configuration profile', () => {
  it('should throw an error if value is not a record', async () => {
    await expect(
      adjustConfigurationProfile({ value: 'not a record', context: {}, typeName: 'typeName' }),
    ).rejects.toThrow()
  })
  describe('adjustCategoryObjectToCategoryId', () => {
    it('should convert category object to category id', async () => {
      const value = {
        a: 'a',
        general: { category: { id: 'category-id', anotherField: 'bla' } },
        b: 'b',
      }
      await expect(adjustConfigurationProfile({ value, context: {}, typeName: 'typeName' })).resolves.toEqual({
        value: {
          a: 'a',
          general: { category: 'category-id' },
          b: 'b',
        },
      })
    })
  })
  describe('adjustSiteObjectToSiteId', () => {
    it('should convert site object to site id', async () => {
      const value = {
        a: 'a',
        general: { site: { id: 'site-id', anotherField: 'bla' } },
        b: 'b',
      }
      await expect(adjustConfigurationProfile({ value, context: {}, typeName: 'typeName' })).resolves.toEqual({
        value: {
          a: 'a',
          general: { site: 'site-id' },
          b: 'b',
        },
      })
    })
  })
  describe('adjustServiceIdToTopLevel', () => {
    it('should extract id field from being under "general" field to be top level', async () => {
      const value = {
        a: 'a',
        general: { id: 'service-id', anotherField: 'bla' },
        b: 'b',
      }
      await expect(adjustConfigurationProfile({ value, context: {}, typeName: 'typeName' })).resolves.toEqual({
        value: {
          a: 'a',
          id: 'service-id',
          general: { anotherField: 'bla' },
          b: 'b',
        },
      })
    })
  })
  describe('removeSelfServiceSecurityPassword', () => {
    it('should delete self service icon object under self_service field', async () => {
      const value = {
        general: {},
        self_service: { security: { field: 'do not delete me please', password: 'this is a secret' } },
      }
      await expect(adjustConfigurationProfile({ value, context: {}, typeName: 'typeName' })).resolves.toEqual({
        value: {
          general: {},
          self_service: { security: { field: 'do not delete me please' } },
        },
      })
    })
  })
  describe('maskPayloadsPassword', () => {
    it('should mask passwords within payloads', async () => {
      const value = {
        general: {
          payloads:
            '<?xml version="1.0" encoding="UTF-8"?><plist version="1"><dict><key>Password</key><string>1234</string></dict></plist>',
        },
      }
      await expect(adjustConfigurationProfile({ value, context: {}, typeName: 'typeName' })).resolves.toEqual({
        value: {
          general: {
            payloads: `<?xml version="1.0" encoding="UTF-8"?><plist version="1"><dict><key>Password</key><string>${SALTO_MASKED_VALUE}</string></dict></plist>`,
          },
        },
      })
    })
  })
})
