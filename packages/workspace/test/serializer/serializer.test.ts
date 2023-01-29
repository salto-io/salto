/*
*                      Copyright 2023 Salto Labs Ltd.
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
import _ from 'lodash'
import {
  PrimitiveType, PrimitiveTypes, ElemID, isInstanceElement, ListType,
  ObjectType, InstanceElement, TemplateExpression, ReferenceExpression, Variable,
  VariableExpression, StaticFile, MapType, BuiltinTypes, isObjectType,
  Element,
  isReferenceExpression,
  TypeReference,
  Field,
} from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { TestFuncImpl } from '../utils'

import { serialize, deserialize, SALTO_CLASS_FIELD, deserializeMergeErrors, deserializeValidationErrors, deserializeParsed } from '../../src/serializer/elements'
import { resolve } from '../../src/expressions'
import { AbsoluteStaticFile, LazyStaticFile } from '../../src/workspace/static_files/source'
import { createInMemoryElementSource } from '../../src/workspace/elements_source'
import { MergeError, DuplicateAnnotationError } from '../../src/merger/internal/common'
import {
  ConflictingFieldTypesError, DuplicateAnnotationFieldDefinitionError,
  DuplicateAnnotationTypeError, ConflictingSettingError,
} from '../../src/merger/internal/object_types'
import { DuplicateInstanceKeyError } from '../../src/merger/internal/instances'
import { MultiplePrimitiveTypesError } from '../../src/merger/internal/primitives'
import { DuplicateVariableNameError } from '../../src/merger/internal/variables'
import { CircularReferenceValidationError, IllegalReferenceValidationError, MissingRequiredFieldValidationError, RegexMismatchValidationError, InvalidValueRangeValidationError, InvalidStaticFileError, InvalidTypeValidationError } from '../../src/validator'
import { UnresolvedReferenceValidationError } from '../../src/errors'
import { MissingStaticFile, AccessDeniedStaticFile } from '../../src/workspace/static_files'

const { awu } = collections.asynciterable
describe('State/cache serialization', () => {
  const strType = new PrimitiveType({
    elemID: new ElemID('salesforce', 'string'),
    primitive: PrimitiveTypes.STRING,
    annotationRefsOrTypes: {
      anno: BuiltinTypes.STRING,
      hiddenAnno: BuiltinTypes.HIDDEN_STRING,
    },
    annotations: {
      anno: 'type annotation',
      hiddenAnno: 'hidden',
    },
  })

  const numType = new PrimitiveType({
    elemID: new ElemID('salesforce', 'number'),
    primitive: PrimitiveTypes.NUMBER,
  })

  const boolType = new PrimitiveType({
    elemID: new ElemID('salesforce', 'bool'),
    primitive: PrimitiveTypes.BOOLEAN,
  })

  const strListType = new ListType(strType)
  const strMapType = new MapType(strType)

  const varElemId = new ElemID(ElemID.VARIABLES_NAMESPACE, 'varName')
  const variable = new Variable(varElemId, 'I am a var')

  const model = new ObjectType({
    elemID: new ElemID('salesforce', 'test'),
    fields: {
      name: {
        refType: strType,
        annotations: { label: 'Name' },
      },
      file: {
        refType: strType,
        annotations: { label: 'File' },
      },
      num: {
        refType: numType,
      },
      list: {
        refType: strListType,
      },
      map: {
        refType: strMapType,
      },
    },
  })

  model.annotate({
    LeadConvertSettings: {
      account: [
        {
          input: 'bla',
          output: 'foo',
        },
      ],
    },
  })

  const instance = new InstanceElement(
    'me',
    model,
    { name: 'me', num: 7 },
    ['path', 'test'],
    { test: 'annotation' },
  )

  class SubInstanceElement extends InstanceElement { }

  const subInstance = new SubInstanceElement(
    'sub_me',
    model,
    { name: 'me', num: 7 },
    ['path', 'test'],
    { test: 'annotation' },
  )

  const refInstance = new InstanceElement(
    'also_me',
    model,
    {
      num: new ReferenceExpression(instance.elemID.createNestedID('num')),
      name: new VariableExpression(varElemId),
    }
  )

  const refInstance2 = new InstanceElement(
    'another',
    model,
    {
      name: new ReferenceExpression(instance.elemID),
    }
  )

  const refInstance3 = new InstanceElement(
    'another3',
    model,
    {
      name: new ReferenceExpression(refInstance2.elemID.createNestedID('name')),
    }
  )

  const templateRefInstance = new InstanceElement(
    'also_me_template',
    model,
    {
      name: new TemplateExpression({
        parts: [
          'I am not',
          new ReferenceExpression(instance.elemID.createNestedID('name')),
        ],
      }),
    }
  )

  const functionRefInstance = new InstanceElement(
    'also_me_function',
    model,
    {
      file: new StaticFile({ filepath: 'some/path.ext', hash: 'hash' }),
      fileWithEncoding: new StaticFile({ filepath: 'some/pathWithEncoding.ext', hash: 'hash', encoding: 'utf-8' }),
      missingFile: new MissingStaticFile('some/missing/path.txt'),
      noAccessFile: new AccessDeniedStaticFile('some/privileged/path.txt'),
      singleparam: new TestFuncImpl('funcadelic', ['aaa']),
      multipleparams: new TestFuncImpl('george', [false, 321]),
      withlist: new TestFuncImpl('washington', ['ZOMG', [3, 2, 1]]),
      withobject: new TestFuncImpl('maggot', [{ aa: '312' }]),
      mixed: new TestFuncImpl('brain', [1, [1, { aa: '312' }], false, 'aaa']),
      nested: {
        WAT: new TestFuncImpl('nestalicous', ['a']),
      },
    },
  )

  const config = new InstanceElement(
    ElemID.CONFIG_NAME,
    model,
    { name: 'other', num: 5 },
  )

  const settings = new ObjectType({
    elemID: new ElemID('salto', 'settingObj'),
    isSettings: true,
  })

  const innerRefsInstance = new InstanceElement(
    'innerRefsInstance',
    model,
  )

  innerRefsInstance.value.c = 2
  innerRefsInstance.value.b = {
    b: new ReferenceExpression(innerRefsInstance.elemID.createNestedID('c'), 2, innerRefsInstance),
  }
  innerRefsInstance.value.a = new ReferenceExpression(innerRefsInstance.elemID.createNestedID('b'), innerRefsInstance.value.b, innerRefsInstance)

  const standaloneField = new Field(
    new ObjectType({ elemID: new ElemID('salesforce', 'test') }),
    'field',
    BuiltinTypes.BOOLEAN,
    { anno: 'test' },
  )

  const elements = [strType, numType, boolType, model, strListType, strMapType, variable,
    instance, subInstance, refInstance, refInstance2, refInstance3, templateRefInstance,
    functionRefInstance, settings, config, innerRefsInstance, standaloneField]

  it('should serialize and deserialize without relying on the constructor name', async () => {
    const serialized = await serialize([subInstance])
    expect(serialized).not.toMatch(subInstance.constructor.name)
  })

  it('should serialize and deserialize elem id correctly without saving the fullname', async () => {
    const serialized = await serialize([subInstance])
    expect(serialized).not.toContain(subInstance.elemID.getFullName())
    const deserialized = await deserialize(serialized)
    expect(deserialized[0].elemID.getFullName()).toBe(subInstance.elemID.getFullName())
  })

  it('should call the static files handler with the static files', async () => {
    const file = new StaticFile({ filepath: 'filepath', content: Buffer.from('content') })
    subInstance.value.a = file
    const staticFileHandler = jest.fn()
    await serialize([subInstance], 'replaceRefWithValue', staticFileHandler)
    expect(staticFileHandler).toHaveBeenCalledWith(file)
  })

  it('should not serialize resolved values', async () => {
    const resolved = await resolve(
      [model],
      createInMemoryElementSource(elements)
    )
    const serialized = await serialize(await awu(resolved).toArray(), 'keepRef')
    const deserialized = await deserialize(serialized)
    Object.values(model.fields).forEach(field => {
      field.refType = new TypeReference(field.refType.elemID)
    })
    model.annotationRefTypes = _.mapValues(
      model.annotationRefTypes,
      refType => new TypeReference(refType.elemID)
    )
    expect(deserialized[0]).toEqual(model)
  })

  // Serializing our nacls to the state file should be the same as serializing the result of fetch
  it('should serialize resolved values to state', async () => {
    const elementsToSerialize = elements.filter(e => e.elemID.name !== 'also_me_template')
    const serialized = await serialize(
      await awu(await resolve(
        elementsToSerialize,
        createInMemoryElementSource(elementsToSerialize)
      )).toArray()
    )
    const deserialized = await deserialize(serialized)
    const refInst = deserialized.find(
      e => e.elemID.getFullName() === refInstance.elemID.getFullName()
    ) as InstanceElement
    const refInst2 = deserialized.find(
      e => e.elemID.getFullName() === refInstance2.elemID.getFullName()
    ) as InstanceElement
    const refInst3 = deserialized.find(
      e => e.elemID.getFullName() === refInstance3.elemID.getFullName()
    ) as InstanceElement
    const innerRefsInst = deserialized.find(
      e => e.elemID.getFullName() === innerRefsInstance.elemID.getFullName()
    ) as InstanceElement
    expect(refInst.value.name).toEqual('I am a var')
    expect(refInst.value.num).toBeInstanceOf(ReferenceExpression)
    expect(refInst2.value.name).toBeInstanceOf(ReferenceExpression)
    expect(refInst2.value.name.elemID.getFullName()).toEqual(instance.elemID.getFullName())
    expect(refInst3.value.name).toBeInstanceOf(ReferenceExpression)
    expect(refInst3.value.name.elemID.getFullName()).toEqual(refInstance2.elemID.createNestedID('name').getFullName())
    expect(innerRefsInst.value.a).toBeInstanceOf(ReferenceExpression)
    expect(innerRefsInst.value.b.b).toBeInstanceOf(ReferenceExpression)
    expect(innerRefsInst.value.c).toBe(2)
  })

  it('should keep the order of the elements the same', async () => {
    const shuffledElements = _.shuffle(elements)
    const shuffledDeserializedElements = await deserialize(await serialize(shuffledElements))
    expect(shuffledDeserializedElements.map(e => e.elemID.getFullName()))
      .toEqual(shuffledElements.map(e => e.elemID.getFullName()))
  })

  describe('validate deserialization', () => {
    let deserializedElements: Element[]
    beforeAll(async () => {
      deserializedElements = await deserialize(await serialize(elements))
    })
    it('should deserialize type correctly', async () => {
      expect(deserializedElements.find(elem => elem.elemID.isEqual(model.elemID))?.isEqual(model))
        .toBeTruthy()
    })
    it('should deserialize field correctly', async () => {
      expect(deserializedElements.find(elem => elem.elemID.isEqual(standaloneField.elemID))?.isEqual(standaloneField))
        .toBeTruthy()
    })
    it('should deserialize instance correctly', async () => {
      expect(deserializedElements.find(elem => elem.elemID.isEqual(instance.elemID))?.isEqual(instance))
        .toBeTruthy()
    })
  })
  describe('validate deserialization of parsed json objects', () => {
    let deserializedElements: Element[]
    beforeAll(async () => {
      deserializedElements = await deserializeParsed(JSON.parse(await serialize(elements)))
    })
    it('should deserialize type correctly', async () => {
      expect(deserializedElements.find(elem => elem.elemID.isEqual(model.elemID))?.isEqual(model))
        .toBeTruthy()
    })
    it('should deserialize field correctly', async () => {
      expect(deserializedElements.find(elem => elem.elemID.isEqual(standaloneField.elemID))?.isEqual(standaloneField))
        .toBeTruthy()
    })
    it('should deserialize instance correctly', async () => {
      expect(deserializedElements.find(elem => elem.elemID.isEqual(instance.elemID))?.isEqual(instance))
        .toBeTruthy()
    })
  })

  it('should throw error if trying to deserialize a non element object', async () => {
    await expect(deserialize(safeJsonStringify([{ test }]))).rejects.toThrow('Deserialization failed. At least one element did not deserialize to an Element')
    await expect(deserializeParsed([{ test }])).rejects.toThrow('Deserialization failed. At least one element did not deserialize to an Element')
  })
  it('should throw error if trying to deserialize a non array', async () => {
    await expect(deserialize(safeJsonStringify({ test }))).rejects.toThrow('got non-array JSON data')
    await expect(deserializeParsed({ test })).rejects.toThrow('got non-array JSON data')
  })

  it('should not serialize redundant values in StaticFile sub classes', async () => {
    const absInstance = new InstanceElement(
      'instance',
      model,
      {
        file: new AbsoluteStaticFile({ filepath: 'filepath', content: Buffer.from('content'), absoluteFilePath: 'absolute/filepath' }),
      },
    )
    expect(
      await serialize([absInstance])
    ).not.toContain('absolute/filepath')
  })

  describe('functions', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let funcElement: InstanceElement
    beforeAll(async () => {
      const elementsToSerialize = elements.filter(e => e.elemID.name === 'also_me_function')
      const serialized = await serialize(elementsToSerialize)
      funcElement = (await deserialize(serialized))[0] as InstanceElement
    })

    it('single parameter', () => {
      expect(funcElement.value).toHaveProperty('singleparam', { funcName: 'funcadelic', parameters: ['aaa'] })
    })
    it('multiple parameters', () => {
      expect(funcElement.value).toHaveProperty('multipleparams', { funcName: 'george', parameters: [false, 321] })
    })
    it('list', () => {
      expect(funcElement.value).toHaveProperty('withlist', { funcName: 'washington', parameters: ['ZOMG', [3, 2, 1]] })
    })
    it('object', () => {
      expect(funcElement.value).toHaveProperty('withobject', { funcName: 'maggot', parameters: [{ aa: '312' }] })
    })
    it('mixed', () => {
      expect(funcElement.value).toHaveProperty('mixed', {
        funcName: 'brain',
        parameters: [1, [1, { aa: '312' }], false, 'aaa'],
      })
    })
    it('file with default encoding', () => {
      expect(funcElement.value).toHaveProperty('file', { filepath: 'some/path.ext', hash: 'hash', encoding: 'binary' })
      expect(funcElement.value.file).toBeInstanceOf(StaticFile)
    })
    it('file with encoding', () => {
      expect(funcElement.value).toHaveProperty('fileWithEncoding', { filepath: 'some/pathWithEncoding.ext', hash: 'hash', encoding: 'utf-8' })
      expect(funcElement.value.fileWithEncoding).toBeInstanceOf(StaticFile)
    })
    it('missing file', () => {
      expect(funcElement.value).toHaveProperty('missingFile')
      expect(funcElement.value.missingFile).toBeInstanceOf(MissingStaticFile)
      expect(funcElement.value.missingFile.filepath).toEqual('some/missing/path.txt')
    })
    it('access denied file', () => {
      expect(funcElement.value).toHaveProperty('noAccessFile')
      expect(funcElement.value.noAccessFile).toBeInstanceOf(AccessDeniedStaticFile)
      expect(funcElement.value.noAccessFile.filepath).toEqual('some/privileged/path.txt')
    })
    it('nested parameter', () => {
      expect(funcElement.value).toHaveProperty('nested', {
        WAT: {
          funcName: 'nestalicous',
          parameters: ['a'],
        },
      })
    })
  })
  describe('with custom static files reviver', () => {
    it('should alter static files', async () => {
      const elementsToSerialize = elements.filter(e => e.elemID.name === 'also_me_function')
      const serialized = await serialize(elementsToSerialize)
      const funcElement = (await deserialize(
        serialized,
        x => Promise.resolve(new StaticFile({ filepath: x.filepath, hash: 'ZOMGZOMGZOMG', encoding: 'utf-8' }))
      ))[0] as InstanceElement

      expect(funcElement.value).toHaveProperty('file', { filepath: 'some/path.ext', hash: 'ZOMGZOMGZOMG', encoding: 'utf-8' })
      expect(funcElement.value.file).toBeInstanceOf(StaticFile)
    })
  })
  describe('when a field collides with the hidden class name attribute', () => {
    let deserialized: InstanceElement
    beforeEach(async () => {
      const classNameInst = new InstanceElement('ClsName', model, { [SALTO_CLASS_FIELD]: 'bla' })
      deserialized = (await deserialize(await serialize([classNameInst])))[0] as InstanceElement
    })
    it('should keep deserialize the instance', () => {
      expect(isInstanceElement(deserialized)).toBeTruthy()
    })
    it('should keep the original value', () => {
      expect(deserialized.value[SALTO_CLASS_FIELD]).toEqual('bla')
    })
  })
  describe('when the field is LazyStaticFile', () => {
    let deserialized: InstanceElement
    beforeEach(async () => {
      const typeWithLazyStaticFile = new ObjectType({
        elemID: new ElemID('salesforce', 'test'),
        fields: {
          lazyFile: {
            refType: strType,
            annotations: { label: 'Lazy File' },
          },
        },
      })
      const classNameInst = new InstanceElement(
        'ClsName',
        typeWithLazyStaticFile,
        {
          file: new LazyStaticFile(
            'some/path.ext', 'hash', 'some/path.ext', async () => Buffer.from('content'),
          ),
        },
      )
      deserialized = (await deserialize(await serialize([classNameInst])))[0] as InstanceElement
    })
    it('should serialize LazyStaticFile to StaticFile', () => {
      expect(isInstanceElement(deserialized)).toBeTruthy()
      expect(deserialized.value.file).toBeInstanceOf(StaticFile)
      expect(deserialized.value.file).not.toBeInstanceOf(LazyStaticFile)
    })
  })
  describe('merge errors', () => {
    const elemID = new ElemID('dummy', 'test')
    let serialized: string
    let deserialized: MergeError[]
    let duplicateAnnotationError: DuplicateAnnotationError
    let conflictingFieldTypesError: ConflictingFieldTypesError
    let duplicateAnnotationFieldDefinitionError: DuplicateAnnotationFieldDefinitionError
    let duplicateAnnotationTypeError: DuplicateAnnotationTypeError
    let conflictingSettingError: ConflictingSettingError
    let duplicateInstanceKeyError: DuplicateInstanceKeyError
    let multiplePrimitiveTypesUnsupportedError: MultiplePrimitiveTypesError
    let duplicateVariableNameError: DuplicateVariableNameError
    beforeAll(async () => {
      duplicateAnnotationError = new DuplicateAnnotationError({ elemID, key: 'test1', existingValue: 'old', newValue: 'new' })
      conflictingFieldTypesError = new ConflictingFieldTypesError({ elemID, definedTypes: ['test', 'test2'] })
      duplicateAnnotationFieldDefinitionError = new DuplicateAnnotationFieldDefinitionError({ elemID, annotationKey: 'test' })
      duplicateAnnotationTypeError = new DuplicateAnnotationTypeError({ elemID, key: 'bla' })
      conflictingSettingError = new ConflictingSettingError({ elemID })
      duplicateInstanceKeyError = new DuplicateInstanceKeyError({ elemID, key: 'test1', existingValue: 'old', newValue: 'new' })
      multiplePrimitiveTypesUnsupportedError = new MultiplePrimitiveTypesError({
        elemID, duplicates: [BuiltinTypes.BOOLEAN, BuiltinTypes.NUMBER],
      })
      duplicateVariableNameError = new DuplicateVariableNameError({ elemID })
      const mergeErrors: MergeError[] = [
        duplicateAnnotationError, conflictingFieldTypesError,
        duplicateAnnotationFieldDefinitionError, duplicateAnnotationTypeError,
        conflictingSettingError, duplicateInstanceKeyError, multiplePrimitiveTypesUnsupportedError,
        duplicateVariableNameError,
      ]
      serialized = await serialize(mergeErrors)
      deserialized = await deserializeMergeErrors(serialized)
    })
    it('serialized value should be non empty string', () => {
      expect(typeof serialized).toEqual('string')
      expect(serialized.length).toBeGreaterThan(0)
    })
    it('should serialize DuplicateAnnotationError correctly', () => {
      expect(deserialized[0]).toEqual(duplicateAnnotationError)
    })
    it('should serialize ConflictingFieldTypesError correctly', () => {
      expect(deserialized[1]).toEqual(conflictingFieldTypesError)
    })
    it('should serialize DuplicateAnnotationFieldDefinitionError correctly', () => {
      expect(deserialized[2]).toEqual(duplicateAnnotationFieldDefinitionError)
    })
    it('should serialize DuplicateAnnotationTypeError correctly', () => {
      expect(deserialized[3]).toEqual(duplicateAnnotationTypeError)
    })
    it('should serialize ConflictingSettingError correctly', () => {
      expect(deserialized[4]).toEqual(conflictingSettingError)
    })
    it('should serialize DuplicateInstanceKeyError correctly', () => {
      expect(deserialized[5]).toEqual(duplicateInstanceKeyError)
    })
    it('should serialize MultiplePrimitiveTypesUnsupportedError correctly', () => {
      expect(deserialized[6]).toEqual(multiplePrimitiveTypesUnsupportedError)
    })
    it('should serialize DuplicateVariableNameError correctly', () => {
      expect(deserialized[7]).toEqual(duplicateVariableNameError)
    })
    it('should throw error if trying to deserialize a non merge error object', async () => {
      await expect(deserializeMergeErrors(safeJsonStringify([{ test }]))).rejects.toThrow()
    })
  })

  describe('validation errors', () => {
    const validationErrors = _.sortBy([
      new InvalidStaticFileError({
        elemID: new ElemID('salto', 'InvalidStaticFileError'),
        error: new MissingStaticFile('invalid').message,
      }),
      new CircularReferenceValidationError({
        elemID: new ElemID('salto', 'CircularReferenceValidationError'),
        ref: 'ref',
      }),
      new IllegalReferenceValidationError({
        elemID: new ElemID('salto', 'IllegalReferenceValidationError'),
        reason: 'reason',
      }),
      new UnresolvedReferenceValidationError({
        elemID: new ElemID('salto', 'UnresolvedReferenceValidationError'),
        target: new ElemID('salto', 'Target'),
      }),
      new MissingRequiredFieldValidationError({
        elemID: new ElemID('salto', 'MissingRequiredFieldValidationError'),
        fieldName: 'name',
      }),
      new RegexMismatchValidationError({
        elemID: new ElemID('salto', 'RegexMismatchValidationError'),
        fieldName: 'name',
        regex: 'regex',
        value: 'asd',
      }),
      new InvalidValueRangeValidationError({
        elemID: new ElemID('salto', 'InvalidValueRangeValidationError'),
        fieldName: 'name',
        value: 12,
        maxValue: 6,
        minValue: 4,
      }),
      new InvalidTypeValidationError(
        new ElemID('salto', 'InvalidTypeValidationError'),
      ),
    ], err => err.elemID.getFullName())

    it('should serialize and deserialize correctly', async () => {
      const serialized = await serialize(validationErrors)
      const deserialized = _.sortBy(
        await deserializeValidationErrors(serialized),
        err => err.elemID.getFullName()
      )
      expect(deserialized).toEqual(validationErrors)
    })
  })

  describe('backward compatibility', () => {
    const ser = '[{"elemID":{"adapter":"salto","typeName":"obj","idType":"type","nameParts":[]},"annotations":{"str":{"elemId":{"adapter":"salto","typeName":"ref","idType":"type","nameParts":[]},"_salto_class":"ReferenceExpression"}},"annotationTypes":{"str":{"elemID":{"adapter":"","typeName":"string","idType":"type","nameParts":[]},"annotations":{},"annotationTypes":{},"primitive":0,"_salto_class":"PrimitiveType"}},"fields":{"list":{"elemID":{"adapter":"salto","typeName":"obj","idType":"field","nameParts":["list"]},"annotations":{},"annotationTypes":{},"parent":{"elemID":{"adapter":"salto","typeName":"obj","idType":"type","nameParts":[]},"annotations":{},"annotationTypes":{},"fields":{},"isSettings":false,"_salto_class":"ObjectType"},"name":"list","type":{"elemID":{"adapter":"","typeName":"list<string>","idType":"type","nameParts":[]},"annotations":{},"annotationTypes":{},"innerType":{"elemID":{"adapter":"","typeName":"string","idType":"type","nameParts":[]},"annotations":{},"annotationTypes":{},"primitive":0,"_salto_class":"PrimitiveType"},"_salto_class":"ListType"},"_salto_class":"Field"},"map":{"elemID":{"adapter":"salto","typeName":"obj","idType":"field","nameParts":["map"]},"annotations":{},"annotationTypes":{},"parent":{"elemID":{"adapter":"salto","typeName":"obj","idType":"type","nameParts":[]},"annotations":{},"annotationTypes":{},"fields":{},"isSettings":false,"_salto_class":"ObjectType"},"name":"map","type":{"elemID":{"adapter":"","typeName":"map<string>","idType":"type","nameParts":[]},"annotations":{},"annotationTypes":{},"innerType":{"elemID":{"adapter":"","typeName":"string","idType":"type","nameParts":[]},"annotations":{},"annotationTypes":{},"primitive":0,"_salto_class":"PrimitiveType"},"_salto_class":"MapType"},"_salto_class":"Field"}},"isSettings":false,"_salto_class":"ObjectType"},{"elemID":{"adapter":"salto","typeName":"obj","idType":"instance","nameParts":["inst"]},"annotations":{},"annotationTypes":{},"type":{"elemID":{"adapter":"salto","typeName":"obj","idType":"type","nameParts":[]},"annotations":{},"annotationTypes":{},"fields":{},"isSettings":false,"_salto_class":"ObjectType"},"value":{},"_salto_class":"InstanceElement"}]'
    let des: Element[]
    let desObj: ObjectType
    let desInst: InstanceElement
    beforeAll(async () => {
      des = await deserialize(ser)
      const foundObj = des.find(e => isObjectType(e))
      if (foundObj !== undefined) {
        desObj = foundObj as ObjectType
      }
      const foundInst = des.find(e => isInstanceElement(e))
      if (foundInst !== undefined) {
        desInst = foundInst as InstanceElement
      }
      expect(desInst).toBeDefined()
      expect(desObj).toBeDefined()
    })
    it('should deserialize refTypes that were serialized as type', () => {
      expect(desInst.refType).toBeDefined()
      expect(desInst.refType.elemID).toBeDefined()
      expect(desInst.refType.elemID.getFullName()).toEqual('salto.obj')
      expect(desObj.fields.list.refType).toBeDefined()
      expect(desObj.fields.list.refType.elemID).toBeDefined()
      expect(desObj.fields.list.refType.elemID.getFullName()).toEqual('List<string>')
    })

    it('should deserialize annotationRefTypes that were serialized as annotationTypes', () => {
      expect(desObj.annotationRefTypes).toBeDefined()
      expect(desObj.annotationRefTypes.str).toBeDefined()
      expect(desObj.annotationRefTypes.str.elemID).toEqual(BuiltinTypes.STRING.elemID)
    })

    it('should deserialize references elemID attr that were serialized as elemId', () => {
      expect(desObj.annotations.str).toBeDefined()
      expect(desObj.annotations.str.elemID).toBeDefined()
      expect(isReferenceExpression(desObj.annotations.str)).toBeTruthy()
    })
  })
})
