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
  PrimitiveType, PrimitiveTypes, ElemID, Field, isInstanceElement,
  ObjectType, InstanceElement, TemplateExpression, ReferenceExpression,
} from '@salto-io/adapter-api'

import { serialize, deserialize, SALTO_CLASS_FIELD } from '../../src/serializer/elements'

describe('State serialization', () => {
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

  const model = new ObjectType({
    elemID: new ElemID('salesforce', 'test'),
  })
  model.fields.name = new Field(model.elemID, 'name', strType, { label: 'Name' })
  model.fields.num = new Field(model.elemID, 'num', numType)
  model.fields.list = new Field(model.elemID, 'list', strType, {}, true)

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

  const refInstance = new InstanceElement(
    'also_me',
    model,
    {
      name: new TemplateExpression({
        parts: [
          'I am not',
          new ReferenceExpression(instance.elemID.createNestedID('name')),
        ],
      }),
      num: new ReferenceExpression(instance.elemID.createNestedID('num')),
    }
  )

  const config = new InstanceElement(
    ElemID.CONFIG_NAME,
    model,
    { name: 'other', num: 5 },
  )

  const elements = [strType, numType, boolType, model, instance, refInstance, config]

  it('should serialize and deserialize all element types', () => {
    const serialized = serialize(elements)
    const deserialized = deserialize(serialized)
    const sortedElements = _.sortBy(elements, e => e.elemID.getFullName())
    expect(deserialized).toEqual(sortedElements)
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
  describe('when a field collides with the hidden class name attribute', () => {
    let deserialized: InstanceElement
    beforeEach(() => {
      const classNameInst = new InstanceElement('ClsName', model, { [SALTO_CLASS_FIELD]: 'bla' })
      deserialized = deserialize(serialize([classNameInst]))[0] as InstanceElement
    })
    it('should keep deserialize the instance', () => {
      expect(isInstanceElement(deserialized)).toBeTruthy()
    })
    it('should keep the original value', () => {
      expect(deserialized.value[SALTO_CLASS_FIELD]).toEqual('bla')
    })
  })
})
