/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ListType, ObjectType } from '@salto-io/adapter-api'
import * as soap from 'soap'
import { extractTypes } from '../../src/soap'

const WSDL_PATH = `${__dirname.replace('/dist', '')}/wsdl/main.wsdl`
const INVALID_WSDL_PATH = `${__dirname.replace('/dist', '')}/wsdl/invalid.wsdl`

const TESTED_TYPE = 'testedType'
describe('extractTypes', () => {
  let testedType: ObjectType
  let types: ObjectType[]
  beforeEach(async () => {
    types = await extractTypes('adapterName', WSDL_PATH, { camelCase: true })
    testedType = types.find(type => type.elemID.name === TESTED_TYPE) as ObjectType
  })
  it('should return the expected type', () => {
    expect(testedType).toBeDefined()
  })

  it('should have the right id', () => {
    expect(testedType.elemID.getFullNameParts()).toEqual(['adapterName', TESTED_TYPE])
  })

  it('should have a primitive field', () => {
    expect(testedType.fields.primitiveField.elemID.getFullNameParts()).toEqual([
      'adapterName',
      TESTED_TYPE,
      'field',
      'primitiveField',
    ])
    expect(testedType.fields.primitiveField.refType.elemID.getFullNameParts()).toEqual(['string'])
  })

  it('should have an object type field', () => {
    expect(testedType.fields.fieldToType.refType.elemID.getFullNameParts()).toEqual(['adapterName', 'someType'])
  })

  it('should have an aliased field', () => {
    expect(testedType.fields.aliasField.refType.elemID.getFullNameParts()).toEqual(['string'])
  })

  it('should have an unknown field', () => {
    expect(testedType.fields.testUnknown.refType.elemID.getFullNameParts()).toEqual(['unknown'])
  })

  it('should have extension fields', () => {
    expect(testedType.fields.testAttr.refType.elemID.getFullNameParts()).toEqual(['string'])
    expect(testedType.fields.testAttr.annotations.isAttribute).toBeTruthy()
  })

  it('should have sub types defined in the same file as the type', async () => {
    expect(testedType.fields.subtypeField.refType.elemID.getFullNameParts()).toEqual([
      'adapterName',
      'testedTypeSubtype',
    ])
  })

  it('should have types defined in the WSDL', async () => {
    const type = types.find(t => t.elemID.name === 'typeInMain2') as ObjectType
    expect(type).toBeDefined()
    expect(type.fields.someField.elemID.getFullNameParts()).toEqual([
      'adapterName',
      'typeInMain2',
      'field',
      'someField',
    ])
    expect(type.fields.someField.refType.elemID.getFullNameParts()).toEqual(['adapterName', 'typeInMain'])
  })

  it('should have list fields', async () => {
    expect((await testedType.fields.listField.getType()) instanceof ListType).toBeTruthy()
  })

  it('should work when a wsdl object is passed', async () => {
    const { wsdl } = (await soap.createClientAsync(WSDL_PATH)) as unknown as { wsdl: soap.WSDL }
    types = await extractTypes('adapterName', wsdl, { camelCase: true })
    testedType = types.find(type => type.elemID.name === TESTED_TYPE) as ObjectType
    expect(testedType).toBeDefined()
  })

  it('should return duplicate types', async () => {
    const typesWithDuplicates = await extractTypes('adapterName', INVALID_WSDL_PATH, { camelCase: true })
    expect(typesWithDuplicates.filter(type => type.elemID.name === 'testedType')).toHaveLength(2)
  })
})
