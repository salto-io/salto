/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { fieldCriterionCreator, nameCriterion } from '../../../src/fetch/query'

describe('fetch_criteria', () => {
  describe('fieldCriterionCreator', () => {
    it('should match element field value when equal', () => {
      const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
        name: 'name',
        nested: {
          value: 'xyz',
        },
      })

      expect(fieldCriterionCreator('name')({ instance, value: '.ame' })).toBeTruthy()
      expect(fieldCriterionCreator('name')({ instance, value: 'ame' })).toBeFalsy()
    })
    it('should match element nested field value when equal', () => {
      const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
        name: 'name',
        nested: {
          value: 'xyz',
        },
      })

      expect(fieldCriterionCreator('nested.value')({ instance, value: '.y.' })).toBeTruthy()
      expect(fieldCriterionCreator('nested.value')({ instance, value: '.z' })).toBeFalsy()
    })

    it('should not match element when field value does not exist', () => {
      const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
        name: 'name',
        nested: {
          value: 'xyz',
        },
      })

      expect(fieldCriterionCreator('val')({ instance, value: '.ame' })).toBeFalsy()
      expect(fieldCriterionCreator('nested.and.missing')({ instance, value: '.ame' })).toBeFalsy()
    })

    it('should not match element when field value is not a string', () => {
      expect(
        fieldCriterionCreator('val')({
          instance: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
            val: ['bla'],
          }),
          value: '.ame',
        }),
      ).toBeFalsy()
      expect(
        fieldCriterionCreator('key')({
          instance: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
            key: 123,
          }),
          value: '.ame',
        }),
      ).toBeFalsy()
      expect(
        fieldCriterionCreator('name')({
          instance: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
            name: {
              value: 'name',
            },
          }),
          value: '.ame',
        }),
      ).toBeFalsy()
    })
  })
  describe('name', () => {
    it('should match element name when equal', () => {
      const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
        name: 'name',
      })

      expect(nameCriterion({ instance, value: '.ame' })).toBeTruthy()
      expect(nameCriterion({ instance, value: 'ame' })).toBeFalsy()
    })

    it('should not match element when name does not exist', () => {
      const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {})

      expect(nameCriterion({ instance, value: '.ame' })).toBeFalsy()
    })

    it('should not match element when name is not a string', () => {
      expect(
        nameCriterion({
          instance: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
            name: ['bla'],
          }),
          value: '.ame',
        }),
      ).toBeFalsy()
      expect(
        nameCriterion({
          instance: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
            name: 123,
          }),
          value: '.ame',
        }),
      ).toBeFalsy()
      expect(
        nameCriterion({
          instance: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
            name: {
              value: 'name',
            },
          }),
          value: '.ame',
        }),
      ).toBeFalsy()
    })
  })
})
