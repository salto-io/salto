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
import { BuiltinTypes, ListType, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { createTransformationConfigTypes, validateTransoformationConfig } from '../../src/config'

describe('config_transformation', () => {
  describe('createTransformationConfigTypes', () => {
    it('should return default config type when no custom fields were added', async () => {
      const { transformation, transformationDefault } = createTransformationConfigTypes('myAdapter')
      expect(Object.keys(transformation.fields).sort()).toEqual(['dataField', 'fieldTypeOverrides', 'fieldsToHide', 'fieldsToOmit', 'fileNameFields', 'idFields', 'standaloneFields'])
      expect(transformation.fields.idFields.annotations[CORE_ANNOTATIONS.REQUIRED]).toBeFalsy()
      const idFieldsType = await transformation.fields.idFields.getType() as ListType
      expect(idFieldsType).toBeInstanceOf(ListType)
      expect(idFieldsType.refInnerType.elemID.isEqual(BuiltinTypes.STRING.elemID)).toBeTruthy()

      expect(Object.keys(transformationDefault.fields).sort()).toEqual(['dataField', 'fieldTypeOverrides', 'fieldsToHide', 'fieldsToOmit', 'fileNameFields', 'idFields', 'standaloneFields'])
      expect(transformationDefault.fields.idFields.annotations[CORE_ANNOTATIONS.REQUIRED]).toEqual(
        true
      )
      const idFieldsDefaultType = await transformationDefault.fields.idFields.getType() as ListType
      expect(idFieldsDefaultType).toBeInstanceOf(ListType)
      expect(idFieldsType.refInnerType.elemID.isEqual(BuiltinTypes.STRING.elemID)).toBeTruthy()
    })

    it('should include additional fields when added', () => {
      const { transformation, transformationDefault } = createTransformationConfigTypes(
        'myAdapter',
        { a: { refType: BuiltinTypes.STRING } },
      )
      expect(Object.keys(transformation.fields).sort()).toEqual(['a', 'dataField', 'fieldTypeOverrides', 'fieldsToHide', 'fieldsToOmit', 'fileNameFields', 'idFields', 'standaloneFields'])
      expect(transformation.fields.a.refType.elemID).toEqual(BuiltinTypes.STRING.elemID)
      expect(Object.keys(transformationDefault.fields).sort()).toEqual(['a', 'dataField', 'fieldTypeOverrides', 'fieldsToHide', 'fieldsToOmit', 'fileNameFields', 'idFields', 'standaloneFields'])
      expect(transformationDefault.fields.a.refType.elemID).toEqual(BuiltinTypes.STRING.elemID)
    })
  })

  describe('validateTransoformationConfig', () => {
    it('should validate successfully when values are valid', () => {
      expect(() => validateTransoformationConfig(
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
            fieldsToOmit: [
              { fieldName: 'abc' },
              { fieldName: 'abd', fieldType: 'cef' },
            ],
            fieldsToHide: [
              { fieldName: 'abc' },
              { fieldName: 'abd', fieldType: 'cef' },
            ],
            standaloneFields: [
              { fieldName: 'abc' },
            ],
          },
          t2: {
            fieldTypeOverrides: [
              { fieldName: 'abc', fieldType: 'def' },
              { fieldName: 'abd', fieldType: 'cef' },
            ],
          },
        },
      )).not.toThrow()
    })
    it('should fail if there are conflicts between field entries in the default config (fieldsToOmit)', () => {
      expect(() => validateTransoformationConfig(
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
            fieldsToOmit: [
              { fieldName: 'abc' },
              { fieldName: 'abd', fieldType: 'cef' },
            ],
            standaloneFields: [
              { fieldName: 'abc' },
            ],
          },
          t2: {
            fieldTypeOverrides: [
              { fieldName: 'abc', fieldType: 'def' },
              { fieldName: 'abd', fieldType: 'cef' },
            ],
          },
        },
      )).toThrow(new Error('Duplicate fieldsToOmit params found in PATH default config: abc'))
    })
    it('should fail if there are conflicts between field entries in the default config (fieldsToHide)', () => {
      expect(() => validateTransoformationConfig(
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
            fieldsToHide: [
              { fieldName: 'abc' },
              { fieldName: 'abd', fieldType: 'cef' },
            ],
            standaloneFields: [
              { fieldName: 'abc' },
            ],
          },
          t2: {
            fieldTypeOverrides: [
              { fieldName: 'abc', fieldType: 'def' },
              { fieldName: 'abd', fieldType: 'cef' },
            ],
          },
        },
      )).toThrow(new Error('Duplicate fieldsToHide params found in PATH default config: abc'))
    })
    it('should fail if there are conflicts between field entries for specific types', () => {
      expect(() => validateTransoformationConfig(
        'PATH',
        {
          idFields: ['a', 'b', 'c'],
          fieldsToOmit: [
            { fieldName: 'abc', fieldType: 'something' },
          ],
        },
        {
          t1: {
            fieldTypeOverrides: [
              { fieldName: 'abc', fieldType: 'def' },
              { fieldName: 'abd', fieldType: 'cef' },
              { fieldName: 'abc', fieldType: 'something' },
            ],
            fieldsToOmit: [
              { fieldName: 'abc' },
              { fieldName: 'abd', fieldType: 'cef' },
            ],
            standaloneFields: [
              { fieldName: 'abc' },
            ],
          },
          t2: {
            fieldTypeOverrides: [
              { fieldName: 'abc', fieldType: 'def' },
              { fieldName: 'abd', fieldType: 'cef' },
            ],
            fieldsToOmit: [
              { fieldName: 'ghi' },
              { fieldName: 'ghi' },
            ],
          },
          t3: {
            fieldTypeOverrides: [
              { fieldName: 'abc', fieldType: 'def' },
              { fieldName: 'abd', fieldType: 'cef' },
            ],
          },
        },
      )).toThrow(new Error('Duplicate fieldTypeOverrides params found in PATH for the following types: t1'))
    })
  })
})
