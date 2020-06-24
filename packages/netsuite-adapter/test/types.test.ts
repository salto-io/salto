/*
*                      Copyright 2020 Salto Labs Ltd.
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
import {
  BuiltinTypes, CORE_ANNOTATIONS, getRestriction, isPrimitiveType,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import { customTypes, fileCabinetTypes } from '../src/types'
import { ADDITIONAL_FILE_SUFFIX, SCRIPT_ID, PATH } from '../src/constants'
import { fieldTypes } from '../src/types/field_types'


describe('Types', () => {
  describe('CustomTypes', () => {
    it('should have a required SCRIPT_ID field with regex restriction for all custom types', () => {
      Object.values(customTypes)
        .forEach(typeDef => {
          expect(typeDef.fields[SCRIPT_ID]).toBeDefined()
          expect(typeDef.fields[SCRIPT_ID].annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(true)
          expect(typeDef.fields[SCRIPT_ID].annotations[CORE_ANNOTATIONS.RESTRICTION]).toBeDefined()
          expect(typeDef.fields[SCRIPT_ID].annotations[CORE_ANNOTATIONS.RESTRICTION].regex)
            .toBeDefined()
        })
    })

    it('should have at most 1 fileContent field with ADDITIONAL_FILE_SUFFIX annotation', () => {
      Object.values(customTypes)
        .forEach(typeDef => {
          const fileContentFields = Object.values(typeDef.fields)
            .filter(f => isPrimitiveType(f.type) && f.type.isEqual(fieldTypes.fileContent))
          expect(fileContentFields.length).toBeLessThanOrEqual(1)
          if (!_.isEmpty(fileContentFields)) {
            expect(fileContentFields[0].annotations[ADDITIONAL_FILE_SUFFIX]).toBeDefined()
          }
        })
    })
  })

  describe('FileCabinetTypes', () => {
    describe('file type definition', () => {
      it('should have single fileContent field', () => {
        expect(Object.values(fileCabinetTypes.file.fields)
          .find(f => isPrimitiveType(f.type) && f.type.isEqual(fieldTypes.fileContent)))
          .toBeDefined()
      })

      it('should have service_id path field', () => {
        expect(Object.keys(fileCabinetTypes.file.fields)).toContain(PATH)
        const pathFieldType = fileCabinetTypes.file.fields[PATH].type
        expect(isPrimitiveType(pathFieldType) && pathFieldType.isEqual(BuiltinTypes.SERVICE_ID))
          .toBe(true)
      })

      it('should have correct path regex restriction', () => {
        expect(Object.keys(fileCabinetTypes.file.fields)).toContain(PATH)
        const pathField = fileCabinetTypes.file.fields[PATH]
        const { regex } = getRestriction(pathField)
        expect(values.isDefined(regex)).toBe(true)
        const regExpObj = new RegExp(regex as string)
        expect(regExpObj.test('/Templates/file.html')).toBe(true)
        expect(regExpObj.test('/Templates/file')).toBe(true)
        expect(regExpObj.test('/Templates/.html')).toBe(true)
        expect(regExpObj.test('file.html')).toBe(false)
        expect(regExpObj.test('/file.html')).toBe(false)
        expect(regExpObj.test('Templates/file.html')).toBe(false)
      })
    })

    describe('folder type definition', () => {
      it('should have service_id path field', () => {
        expect(Object.keys(fileCabinetTypes.folder.fields)).toContain(PATH)
        const pathFieldType = fileCabinetTypes.folder.fields[PATH].type
        expect(isPrimitiveType(pathFieldType) && pathFieldType.isEqual(BuiltinTypes.SERVICE_ID))
          .toBe(true)
      })

      it('should have correct path regex restriction', () => {
        expect(Object.keys(fileCabinetTypes.folder.fields)).toContain(PATH)
        const pathField = fileCabinetTypes.folder.fields[PATH]
        const { regex } = getRestriction(pathField)
        expect(values.isDefined(regex)).toBe(true)
        const regExpObj = new RegExp(regex as string)
        expect(regExpObj.test('Templates/FolderName')).toBe(false)
        expect(regExpObj.test('/Templates/')).toBe(false)
        expect(regExpObj.test('/FolderName')).toBe(false)
        expect(regExpObj.test('/Templates/FolderName')).toBe(true)
        expect(regExpObj.test('/Templates/Folder.Name')).toBe(true)
      })
    })
  })
})
