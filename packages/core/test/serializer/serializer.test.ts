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
import _ from 'lodash'
import {
  PrimitiveType, PrimitiveTypes, ElemID, isInstanceElement, ListType,
  ObjectType, InstanceElement, TemplateExpression, ReferenceExpression, Variable,
  VariableExpression, StaticFile,
} from '@salto-io/adapter-api'
import {
  TestFuncImpl,
} from '../parser/functions.test'

import { serialize, deserialize, SALTO_CLASS_FIELD } from '../../src/serializer/elements'
import { resolve } from '../../src/core/expressions'

describe('State/cache serialization', () => {
  const strType = new PrimitiveType({
    elemID: new ElemID('salesforce', 'string'),
    primitive: PrimitiveTypes.STRING,
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

  const varElemId = new ElemID(ElemID.VARIABLES_NAMESPACE, 'varName')
  const variable = new Variable(varElemId, 'I am a var')

  const model = new ObjectType({
    elemID: new ElemID('salesforce', 'test'),
    fields: {
      name: { type: strType, annotations: { label: 'Name' } },
      file: { type: strType, annotations: { label: 'File' } },
      num: { type: numType },
      list: { type: strListType },
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

  const elements = [strType, numType, boolType, model, strListType, variable, instance,
    subInstance, refInstance, refInstance2, refInstance3, templateRefInstance, functionRefInstance,
    settings, config]

  it('should serialize and deserialize all element types', async () => {
    const serialized = serialize(elements)
    const deserialized = await deserialize(serialized)
    const sortedElements = _.sortBy(elements, e => e.elemID.getFullName())
    expect(deserialized).toEqual(sortedElements)
  })

  it('should serialize and deserialize without relying on the constructor name', async () => {
    const serialized = serialize([subInstance])
    expect(serialized).not.toMatch(subInstance.constructor.name)
  })


  it('should not serialize resolved values', async () => {
    // TemplateExpressions are discarded
    const elementsToSerialize = elements.filter(e => e.elemID.name !== 'also_me_template')
    const serialized = serialize(resolve(elementsToSerialize), 'keepRef')
    const deserialized = await deserialize(serialized)
    const sortedElements = _.sortBy(elementsToSerialize, e => e.elemID.getFullName())

    expect(deserialized).toEqual(sortedElements)
  })

  // Serializing our nacls to the state file should be the same as serializing the result of fetch
  it('should serialize resolved values to state', async () => {
    const elementsToSerialize = elements.filter(e => e.elemID.name !== 'also_me_template')
    const serialized = serialize(resolve(elementsToSerialize))
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
    expect(refInst.value.name).toEqual('I am a var')
    expect(refInst.value.num).toEqual(7)
    expect(refInst2.value.name).toBeInstanceOf(ReferenceExpression)
    expect(refInst2.value.name.elemId.getFullName()).toEqual(instance.elemID.getFullName())
    expect(refInst3.value.name).toBeInstanceOf(ReferenceExpression)
    expect(refInst3.value.name.elemId.getFullName()).toEqual(instance.elemID.getFullName())
  })

  it('should create the same result for the same input regardless of elements order', () => {
    const serialized = serialize(elements)
    const shuffledSer = serialize(_.shuffle(elements))
    expect(serialized).toEqual(shuffledSer)
  })

  it('should create the same result for the same input regardless of values order', () => {
    const serialized = serialize(elements)
    const shuffledConfig = _.last(elements) as InstanceElement
    // We maintain values but shuffle set order
    shuffledConfig.value.num = 5
    shuffledConfig.value.name = 'other'
    const shuffledSer = serialize([
      ...elements.slice(0, -1),
      shuffledConfig,
    ])
    expect(serialized).toEqual(shuffledSer)
  })

  describe('functions', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let funcElement: InstanceElement
    beforeAll(async () => {
      const elementsToSerialize = elements.filter(e => e.elemID.name === 'also_me_function')
      const serialized = serialize(elementsToSerialize)
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
    it('file', () => {
      expect(funcElement.value).toHaveProperty('file', { filepath: 'some/path.ext', hash: 'hash' })
      expect(funcElement.value.file).toBeInstanceOf(StaticFile)
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
      const serialized = serialize(elementsToSerialize)
      const funcElement = (await deserialize(
        serialized,
        x => Promise.resolve(new StaticFile({ filepath: x.filepath, hash: 'ZOMGZOMGZOMG' }))
      ))[0] as InstanceElement

      expect(funcElement.value).toHaveProperty('file', { filepath: 'some/path.ext', hash: 'ZOMGZOMGZOMG' })
      expect(funcElement.value.file).toBeInstanceOf(StaticFile)
    })
  })
  describe('when a field collides with the hidden class name attribute', () => {
    let deserialized: InstanceElement
    beforeEach(async () => {
      const classNameInst = new InstanceElement('ClsName', model, { [SALTO_CLASS_FIELD]: 'bla' })
      deserialized = (await deserialize(serialize([classNameInst])))[0] as InstanceElement
    })
    it('should keep deserialize the instance', () => {
      expect(isInstanceElement(deserialized)).toBeTruthy()
    })
    it('should keep the original value', () => {
      expect(deserialized.value[SALTO_CLASS_FIELD]).toEqual('bla')
    })
  })
})
