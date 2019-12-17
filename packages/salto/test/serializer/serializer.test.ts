import _ from 'lodash'
import {
  PrimitiveType, PrimitiveTypes, ElemID, Field,
  ObjectType, InstanceElement, TemplateExpression, ReferenceExpression,
} from 'adapter-api'

import { serialize, deserialize } from '../../src/serializer/elements'

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
    // eslint-disable-next-line @typescript-eslint/camelcase
    lead_convert_settings: {
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
})
