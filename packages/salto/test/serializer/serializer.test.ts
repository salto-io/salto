import {
  PrimitiveType, PrimitiveTypes, ElemID, Field,
  ObjectType, InstanceElement,
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
    new ElemID('salesforce', 'me'),
    model,
    {
      name: 'me',
      num: 7,
    }
  )

  const config = new InstanceElement(
    new ElemID('salesforce', ElemID.CONFIG_INSTANCE_NAME),
    model,
    {
      name: 'other',
      num: 5,
    }
  )

  const elements = [strType, numType, boolType, model, instance, config]

  it('should serialize and deserialize all element types', () => {
    const serialized = serialize(elements)
    const deserialized = deserialize(serialized)
    expect(deserialized).toEqual(elements)
  })
})
