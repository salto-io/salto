/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { adjustPolicy } from '../../../../src/definitions/fetch/transforms'
import { MASK_VALUE } from '../../../../src/definitions/fetch/transforms/utils'

describe('adjust policy', () => {
  it('should throw an error if value is not a record', async () => {
    await expect(adjustPolicy({ value: 'not a record', context: {}, typeName: 'policy' })).rejects.toThrow()
  })
  describe('adjustCategoryObjectToCategoryId', () => {
    it('should convert category object to category id', async () => {
      const value = {
        a: 'a',
        general: { category: { id: 'category-id', anotherField: 'bla' } },
        b: 'b',
      }
      await expect(adjustPolicy({ value, context: {}, typeName: 'policy' })).resolves.toEqual({
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
      await expect(adjustPolicy({ value, context: {}, typeName: 'policy' })).resolves.toEqual({
        value: {
          a: 'a',
          general: { site: 'site-id' },
          b: 'b',
        },
      })
    })
  })
  describe('removeIdsForScriptsObjectArray', () => {
    it('should convert scripts object array to scripts ids', async () => {
      const value = {
        a: 'a',
        general: {},
        scripts: [
          { id: 'script-id', anotherField: 'yay' },
          { id: 'script-id2', anotherField: 'hopa' },
        ],
        b: 'b',
      }
      await expect(adjustPolicy({ value, context: {}, typeName: 'policy' })).resolves.toEqual({
        value: {
          a: 'a',
          general: {},
          scripts: [{ anotherField: 'yay' }, { anotherField: 'hopa' }],
          b: 'b',
        },
      })
    })
  })
  describe('maskPasswordsForScriptsObjectArray', () => {
    it('should mask passwords within scripts object array', async () => {
      const value = {
        a: 'a',
        general: {},
        scripts: [
          { parameter4: 'yay' },
          { parameter5: 'client_secret=823463286532896589' },
        ],
        b: 'b',
      }
      await expect(adjustPolicy({ value, context: {}, typeName: 'policy' })).resolves.toEqual({
        value: {
          a: 'a',
          general: {},
          scripts: [{ parameter4: 'yay' }, { parameter5: `client_secret=${MASK_VALUE}` }],
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
      await expect(adjustPolicy({ value, context: {}, typeName: 'policy' })).resolves.toEqual({
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
      await expect(adjustPolicy({ value, context: {}, typeName: 'policy' })).resolves.toEqual({
        value: {
          general: {},
          self_service_icon: "don't delete me",
          self_service: {},
        },
      })
    })
  })
})
