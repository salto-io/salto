/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { MAC_APPLICATION_TYPE_NAME } from '../../../../src/constants'
import { adjustMacApplication } from '../../../../src/definitions/fetch/transforms'

describe('adjust mac_application', () => {
  it('should throw an error if value is not a record', async () => {
    await expect(
      adjustMacApplication({ value: 'not a record', context: {}, typeName: MAC_APPLICATION_TYPE_NAME }),
    ).rejects.toThrow()
  })
  describe('adjustCategoryObjectToCategoryId', () => {
    it('should convert category object to category id', async () => {
      const value = {
        a: 'a',
        general: { category: { id: 'category-id', anotherField: 'bla' } },
        b: 'b',
      }
      await expect(adjustMacApplication({ value, context: {}, typeName: MAC_APPLICATION_TYPE_NAME })).resolves.toEqual({
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
      await expect(adjustMacApplication({ value, context: {}, typeName: MAC_APPLICATION_TYPE_NAME })).resolves.toEqual({
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
      await expect(adjustMacApplication({ value, context: {}, typeName: MAC_APPLICATION_TYPE_NAME })).resolves.toEqual({
        value: {
          a: 'a',
          id: 'service-id',
          general: { anotherField: 'bla' },
          b: 'b',
        },
      })
    })
  })
  describe('removeSelfServiceIcon', () => {
    it('should delete self service icon object under self_service field', async () => {
      const value = {
        general: {},
        self_service_icon: "don't delete me",
        self_service: { self_service_icon: { someField: 'this whole object will be deleted' } },
      }
      await expect(adjustMacApplication({ value, context: {}, typeName: MAC_APPLICATION_TYPE_NAME })).resolves.toEqual({
        value: {
          general: {},
          self_service_icon: "don't delete me",
          self_service: {},
        },
      })
    })
  })
})
