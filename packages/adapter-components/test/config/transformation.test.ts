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
import { BuiltinTypes, ListType, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import {
  createTransformationConfigTypes,
  validateTransoformationConfig,
  dereferenceFieldName,
  shouldNestFiles,
  TransformationDefaultConfig,
} from '../../src/config'

describe('shouldNestFiles', () => {
  describe('adapter default is true', () => {
    const defaultConfig: TransformationDefaultConfig = {
      idFields: ['id'],
      nestStandaloneInstances: true,
    }
    it('should return true if field is missing', () => {
      expect(shouldNestFiles(defaultConfig, {})).toBeTruthy()
    })
    it('should return true if field is true', () => {
      expect(
        shouldNestFiles(defaultConfig, {
          nestStandaloneInstances: true,
        }),
      ).toBeTruthy()
    })
    it('should return false if field is false', () => {
      expect(
        shouldNestFiles(defaultConfig, {
          nestStandaloneInstances: false,
        }),
      ).toBeFalsy()
    })
  })
  describe('adapter default is false', () => {
    const defaultConfig: TransformationDefaultConfig = {
      idFields: ['id'],
      nestStandaloneInstances: false,
    }
    it('should return false if field is missing', () => {
      expect(shouldNestFiles(defaultConfig, {})).toBeFalsy()
    })
    it('should return true if field is true', () => {
      expect(
        shouldNestFiles(defaultConfig, {
          nestStandaloneInstances: true,
        }),
      ).toBeTruthy()
    })
    it('should return false if field is false', () => {
      expect(
        shouldNestFiles(defaultConfig, {
          nestStandaloneInstances: false,
        }),
      ).toBeFalsy()
    })
  })
})

describe('config_transformation', () => {
  describe('createTransformationConfigTypes', () => {
    it('should return default config type when no custom fields were added', async () => {
      const { transformation, transformationDefault } = createTransformationConfigTypes({ adapter: 'myAdapter' })
      expect(Object.keys(transformation.fields).sort()).toEqual([
        'dataField',
        'fieldTypeOverrides',
        'fieldsToHide',
        'fieldsToOmit',
        'fileNameFields',
        'idFields',
        'standaloneFields',
      ])
      expect(transformation.fields.idFields.annotations[CORE_ANNOTATIONS.REQUIRED]).toBeFalsy()
      const idFieldsType = (await transformation.fields.idFields.getType()) as ListType
      expect(idFieldsType).toBeInstanceOf(ListType)
      expect(idFieldsType.refInnerType.elemID.isEqual(BuiltinTypes.STRING.elemID)).toBeTruthy()

      expect(Object.keys(transformationDefault.fields).sort()).toEqual([
        'dataField',
        'fieldTypeOverrides',
        'fieldsToHide',
        'fieldsToOmit',
        'fileNameFields',
        'idFields',
        'standaloneFields',
      ])
      const idFieldsDefaultType = (await transformationDefault.fields.idFields.getType()) as ListType
      expect(idFieldsDefaultType).toBeInstanceOf(ListType)
      expect(idFieldsType.refInnerType.elemID.isEqual(BuiltinTypes.STRING.elemID)).toBeTruthy()
    })

    it('should include additional fields when added', () => {
      const { transformation, transformationDefault } = createTransformationConfigTypes({
        adapter: 'myAdapter',
        additionalFields: { a: { refType: BuiltinTypes.STRING } },
      })
      expect(Object.keys(transformation.fields).sort()).toEqual([
        'a',
        'dataField',
        'fieldTypeOverrides',
        'fieldsToHide',
        'fieldsToOmit',
        'fileNameFields',
        'idFields',
        'standaloneFields',
      ])
      expect(transformation.fields.a.refType.elemID).toEqual(BuiltinTypes.STRING.elemID)
      expect(Object.keys(transformationDefault.fields).sort()).toEqual([
        'a',
        'dataField',
        'fieldTypeOverrides',
        'fieldsToHide',
        'fieldsToOmit',
        'fileNameFields',
        'idFields',
        'standaloneFields',
      ])
      expect(transformationDefault.fields.a.refType.elemID).toEqual(BuiltinTypes.STRING.elemID)
    })
  })

  describe('validateTransoformationConfig', () => {
    it('should validate successfully when values are valid', () => {
      expect(() =>
        validateTransoformationConfig(
          'PATH',
          {
            idFields: ['a', 'b', 'c'],
          },
          {
            t1: {
              fieldTypeOverrides: [
                { fieldName: 'abc', fieldType: 'def' },
                { fieldName: 'abd', fieldType: 'cef' },
              ],
              fieldsToOmit: [{ fieldName: 'abc' }, { fieldName: 'abd', fieldType: 'cef' }],
              fieldsToHide: [{ fieldName: 'abc' }, { fieldName: 'abd', fieldType: 'cef' }],
              standaloneFields: [{ fieldName: 'abc' }],
            },
            t2: {
              fieldTypeOverrides: [
                { fieldName: 'abc', fieldType: 'def' },
                { fieldName: 'abd', fieldType: 'cef' },
              ],
            },
          },
        ),
      ).not.toThrow()
    })
    it('should fail if there are conflicts between field entries in the default config (fieldsToOmit)', () => {
      expect(() =>
        validateTransoformationConfig(
          'PATH',
          {
            idFields: ['a', 'b', 'c'],
            fieldsToOmit: [
              { fieldName: 'abc', fieldType: 'something' },
              { fieldName: 'abc', fieldType: 'something' },
              { fieldName: 'abc' },
            ],
          },
          {
            t1: {
              fieldTypeOverrides: [
                { fieldName: 'abc', fieldType: 'def' },
                { fieldName: 'abd', fieldType: 'cef' },
              ],
              fieldsToOmit: [{ fieldName: 'abc' }, { fieldName: 'abd', fieldType: 'cef' }],
              standaloneFields: [{ fieldName: 'abc' }],
            },
            t2: {
              fieldTypeOverrides: [
                { fieldName: 'abc', fieldType: 'def' },
                { fieldName: 'abd', fieldType: 'cef' },
              ],
            },
          },
        ),
      ).toThrow(new Error('Duplicate fieldsToOmit params found in PATH default config: abc'))
    })
    it('should fail if there are conflicts between field entries in the default config (fieldsToHide)', () => {
      expect(() =>
        validateTransoformationConfig(
          'PATH',
          {
            idFields: ['a', 'b', 'c'],
            fieldsToHide: [
              { fieldName: 'abc', fieldType: 'something' },
              { fieldName: 'abc', fieldType: 'something' },
              { fieldName: 'abc' },
            ],
          },
          {
            t1: {
              fieldTypeOverrides: [
                { fieldName: 'abc', fieldType: 'def' },
                { fieldName: 'abd', fieldType: 'cef' },
              ],
              fieldsToHide: [{ fieldName: 'abc' }, { fieldName: 'abd', fieldType: 'cef' }],
              standaloneFields: [{ fieldName: 'abc' }],
            },
            t2: {
              fieldTypeOverrides: [
                { fieldName: 'abc', fieldType: 'def' },
                { fieldName: 'abd', fieldType: 'cef' },
              ],
            },
          },
        ),
      ).toThrow(new Error('Duplicate fieldsToHide params found in PATH default config: abc'))
    })
    it('should fail if there are conflicts between field entries for specific types', () => {
      expect(() =>
        validateTransoformationConfig(
          'PATH',
          {
            idFields: ['a', 'b', 'c'],
            fieldsToOmit: [{ fieldName: 'abc', fieldType: 'something' }],
          },
          {
            t1: {
              fieldTypeOverrides: [
                { fieldName: 'abc', fieldType: 'def' },
                { fieldName: 'abd', fieldType: 'cef' },
                { fieldName: 'abc', fieldType: 'something' },
              ],
              fieldsToOmit: [{ fieldName: 'abc' }, { fieldName: 'abd', fieldType: 'cef' }],
              standaloneFields: [{ fieldName: 'abc' }],
            },
            t2: {
              fieldTypeOverrides: [
                { fieldName: 'abc', fieldType: 'def' },
                { fieldName: 'abd', fieldType: 'cef' },
              ],
              fieldsToOmit: [{ fieldName: 'ghi' }, { fieldName: 'ghi' }],
            },
            t3: {
              fieldTypeOverrides: [
                { fieldName: 'abc', fieldType: 'def' },
                { fieldName: 'abd', fieldType: 'cef' },
              ],
            },
          },
        ),
      ).toThrow(new Error('Duplicate fieldTypeOverrides params found in PATH for the following types: t1'))
    })
    it('should fail if there are conflict between isSingleton field and idFields/fileNameFields', () => {
      expect(() =>
        validateTransoformationConfig(
          'PATH',
          {
            idFields: ['a', 'b', 'c'],
            fieldsToOmit: [{ fieldName: 'abc', fieldType: 'something' }],
          },
          {
            t1: {
              idFields: ['a'],
              isSingleton: true,
            },
            t2: {
              fileNameFields: ['name'],
              isSingleton: true,
            },
            t3: {
              isSingleton: true,
            },
          },
        ),
      ).toThrow(
        new Error(
          'Singleton types should not have dataField or fileNameFields set, misconfiguration found for the following types: t1,t2',
        ),
      )
    })
    it('should fail if idFields name are invalid', () => {
      expect(() =>
        validateTransoformationConfig(
          'PATH',
          {
            idFields: ['a', 'b', 'c'],
            fieldsToOmit: [{ fieldName: 'abc', fieldType: 'something' }],
          },
          {
            t1: {
              idFields: ['&a&'],
            },
            t2: {
              idFields: ['a&', 'b&'],
            },
          },
        ),
      ).toThrow(
        new Error(
          'Invalid idFields found in the following types:\nin type: t1, invalid idFields: [&a&]\nin type: t2, invalid idFields: [a&,b&]',
        ),
      )
      expect(() =>
        validateTransoformationConfig(
          'PATH',
          {
            idFields: ['a', 'b&', 'c'],
            fieldsToOmit: [{ fieldName: 'abc', fieldType: 'something' }],
          },
          {
            t1: {
              idFields: ['a'],
            },
          },
        ),
      ).toThrow(new Error('Invalid idFields found in default config: b&'))
    })
  })

  describe('idFields util functions', () => {
    const idFields = ['id', '&folder_id']
    const dereferencedIdFields = idFields.map(fieldName => dereferenceFieldName(fieldName))
    expect(dereferencedIdFields).toEqual(['id', 'folder_id'])
  })
})
