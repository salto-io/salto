/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, getRestriction, isPrimitiveType, isServiceId } from '@salto-io/adapter-api'
import _ from 'lodash'
import { values, collections } from '@salto-io/lowerdash'
import { ADDITIONAL_FILE_SUFFIX, SCRIPT_ID, PATH } from '../src/constants'
import { getMetadataTypes, getTopLevelStandardTypes } from '../src/types'
import { fieldTypes } from '../src/types/field_types'

const { awu } = collections.asynciterable

describe('Types', () => {
  const { standardTypes, additionalTypes } = getMetadataTypes()
  describe('StandardTypes', () => {
    it('should have a required SCRIPT_ID field with regex restriction for all custom types', () => {
      getTopLevelStandardTypes(standardTypes).forEach(typeDef => {
        expect(typeDef.fields[SCRIPT_ID]).toBeDefined()
        expect(typeDef.fields[SCRIPT_ID].annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(true)
        expect(typeDef.fields[SCRIPT_ID].annotations[CORE_ANNOTATIONS.RESTRICTION]).toBeDefined()
        expect(typeDef.fields[SCRIPT_ID].annotations[CORE_ANNOTATIONS.RESTRICTION].regex).toBeDefined()
      })
    })

    it('should have at most 1 fileContent field with ADDITIONAL_FILE_SUFFIX annotation', async () => {
      await awu(getTopLevelStandardTypes(standardTypes)).forEach(async typeDef => {
        const fileContentFields = await awu(Object.values(typeDef.fields))
          .filter(async f => {
            const fType = await f.getType()
            return isPrimitiveType(fType) && fType.isEqual(fieldTypes.fileContent)
          })
          .toArray()
        expect(fileContentFields.length).toBeLessThanOrEqual(1)
        if (!_.isEmpty(fileContentFields)) {
          expect(fileContentFields[0].annotations[ADDITIONAL_FILE_SUFFIX]).toBeDefined()
        }
      })
    })
  })

  describe('Additional Types', () => {
    describe('file type definition', () => {
      it('should have single fileContent field', () => {
        expect(
          Object.values(additionalTypes.file.fields).find(f => {
            const fType = f.getTypeSync()
            return isPrimitiveType(fType) && fType.isEqual(fieldTypes.fileContent)
          }),
        ).toBeDefined()
      })

      it('should have service_id path field', async () => {
        expect(Object.keys(additionalTypes.file.fields)).toContain(PATH)
        const pathFieldType = await additionalTypes.file.fields[PATH].getType()
        expect(isPrimitiveType(pathFieldType) && isServiceId(pathFieldType)).toBe(true)
      })

      it('should have correct path regex restriction', () => {
        expect(Object.keys(additionalTypes.file.fields)).toContain(PATH)
        const pathField = additionalTypes.file.fields[PATH]
        const { regex } = getRestriction(pathField)
        expect(values.isDefined(regex)).toBe(true)
        const regExpObj = new RegExp(regex as string)
        expect(regExpObj.test('/Templates/file.html')).toBe(true)
        expect(regExpObj.test('/Templates/file')).toBe(true)
        expect(regExpObj.test('/Templates/.html')).toBe(true)
        expect(regExpObj.test('file.html')).toBe(false)
        expect(regExpObj.test('/file.html')).toBe(true)
        expect(regExpObj.test('Templates/file.html')).toBe(false)
      })
    })

    describe('folder type definition', () => {
      it('should have service_id path field', async () => {
        expect(Object.keys(additionalTypes.folder.fields)).toContain(PATH)
        const pathFieldType = await additionalTypes.folder.fields[PATH].getType()
        expect(isPrimitiveType(pathFieldType) && isServiceId(pathFieldType)).toBe(true)
      })

      it('should have correct path regex restriction', () => {
        expect(Object.keys(additionalTypes.folder.fields)).toContain(PATH)
        const pathField = additionalTypes.folder.fields[PATH]
        const { regex } = getRestriction(pathField)
        expect(values.isDefined(regex)).toBe(true)
        const regExpObj = new RegExp(regex as string)
        expect(regExpObj.test('Templates/FolderName')).toBe(false)
        expect(regExpObj.test('/Templates/')).toBe(true)
        expect(regExpObj.test('/FolderName')).toBe(true)
        expect(regExpObj.test('/Templates/FolderName')).toBe(true)
        expect(regExpObj.test('/Templates/Folder.Name')).toBe(true)
      })
    })
  })
})
