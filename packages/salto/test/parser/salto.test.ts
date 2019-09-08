import {
  ObjectType, PrimitiveType, PrimitiveTypes, Element, ElemID, isObjectType, Type, InstanceElement,
  Field,
  BuiltinTypes,
} from 'adapter-api'
import * as TestHelpers from '../common/helpers'
import Parser, { SourceMap } from '../../src/parser/salto'

describe('Salto parser', () => {
  describe('primitive, model and extensions', () => {
    let elements: Element[]
    let sourceMap: SourceMap

    const body = `
      type salesforce_string is string {
      }

      type salesforce_number is number {
      }

      type salesforce_boolean is boolean {
      }

      type salesforce_obj is object {
        salesforce_number num {}
      }

      type salesforce_test {
        salesforce_string name {
          label = "Name"
          _required = true
        }

        list salesforce_string nicknames {
        }

        salesforce_phone fax {
          field_level_security = {
            all_profiles = {
              visible = false
              read_only = false
            }
          }
        }

        lead_convert_settings = {
          account = [
            {
              input = "bla"
              output = "foo"
            }
          ]
        }
      }

      salesforce_test inst {
        name = "me"
      }

      salesforce {
        username = "foo"
      }

      type salesforce_type {
        salesforce_number num {}
      }

      type salesforce_type {
        update num {
          label = "Name"
          _required = true
        }
      }

      type salesforce_field is number {
        annotations {
          number scale {
          }
          number precision {
          }
          boolean unique {
          }
        }
      }
      `

    beforeAll(async () => {
      ({ elements, sourceMap } = await Parser.parse(Buffer.from(body), 'none'))
    })

    describe('parse result', () => {
      it('should have all types', () => {
        expect(elements.length).toBe(10)
      })
    })

    describe('string type', () => {
      let stringType: PrimitiveType
      beforeAll(() => {
        stringType = elements[0] as PrimitiveType
      })
      it('should have the correct type', () => {
        expect(stringType.primitive).toBe(PrimitiveTypes.STRING)
      })
    })

    describe('number type', () => {
      let numberType: PrimitiveType
      beforeAll(() => {
        numberType = elements[1] as PrimitiveType
      })
      it('should have the correct type', () => {
        expect(numberType.primitive).toBe(PrimitiveTypes.NUMBER)
      })
    })

    describe('boolean type', () => {
      let booleanType: PrimitiveType
      beforeAll(() => {
        booleanType = elements[2] as PrimitiveType
      })
      it('should have the correct type', () => {
        expect(booleanType.primitive).toBe(PrimitiveTypes.BOOLEAN)
      })
    })

    describe('object type', () => {
      let objectType: ObjectType
      beforeAll(() => {
        expect(isObjectType(elements[3])).toBe(true)
        objectType = elements[3] as ObjectType
      })
      it('should have a number field', () => {
        expect(objectType.fields).toHaveProperty('num')
      })
    })

    describe('model', () => {
      let model: ObjectType
      beforeAll(() => {
        model = elements[4] as ObjectType
      })
      describe('new field', () => {
        it('should exist', () => {
          expect(model.fields).toHaveProperty('name')
        })
        it('should have the correct type', () => {
          expect(model.fields.name.type.elemID.adapter).toBe('salesforce')
          expect(model.fields.name.type.elemID.name).toEqual('string')
        })
        it('should have annotation values', () => {
          expect(model.fields.name.getAnnotationsValues()).toHaveProperty('label')
          expect(model.fields.name.getAnnotationsValues().label).toEqual('Name')
          expect(model.fields.name.getAnnotationsValues()).toHaveProperty('_required')
          // eslint-disable-next-line no-underscore-dangle
          expect(model.fields.name.getAnnotationsValues()._required).toEqual(true)
        })
      })
      describe('list field', () => {
        it('should exist', () => {
          expect(model.fields).toHaveProperty('nicknames')
        })
        it('should have the correct type', () => {
          expect(model.fields.nicknames.type.elemID.adapter).toBe('salesforce')
          expect(model.fields.nicknames.type.elemID.name).toEqual('string')
          expect(model.fields.nicknames.isList).toBe(true)
        })
      })
      describe('field annotations', () => {
        it('should exist', () => {
          expect(model.fields).toHaveProperty('fax')
        })
        it('should have the correct value', () => {
          expect(model.fields.fax.getAnnotationsValues()).toEqual({
            // eslint-disable-next-line @typescript-eslint/camelcase
            field_level_security: {
              // eslint-disable-next-line @typescript-eslint/camelcase
              all_profiles: {
                visible: false,
                // eslint-disable-next-line @typescript-eslint/camelcase
                read_only: false,
              },
            },
          })
        })
      })

      describe('model annotations', () => {
        it('should exist', () => {
          expect(model.getAnnotationsValues()).toHaveProperty('lead_convert_settings')
        })
        it('should have the correct value', () => {
          expect(model.getAnnotationsValues().lead_convert_settings).toEqual({
            account: [
              {
                input: 'bla',
                output: 'foo',
              },
            ],
          })
        })
      })
    })

    describe('instance', () => {
      let inst: InstanceElement
      beforeAll(() => {
        inst = elements[5] as InstanceElement
      })
      it('should have the right id', () => {
        expect(inst.elemID.adapter).toEqual('salesforce')
        expect(inst.elemID.name).toEqual('inst')
      })
      it('should have the right type', () => {
        expect(inst.type.elemID.adapter).toEqual('salesforce')
        expect(inst.type.elemID.name).toEqual('test')
      })
      it('should have values', () => {
        expect(inst.value).toHaveProperty('name')
        expect(inst.value.name).toEqual('me')
      })
    })

    describe('config', () => {
      let config: InstanceElement
      beforeAll(() => {
        config = elements[6] as InstanceElement
      })
      it('should have the right id', () => {
        expect(config.elemID.adapter).toEqual('salesforce')
        expect(config.elemID.name).toEqual(ElemID.CONFIG_INSTANCE_NAME)
      })
      it('should have the right type', () => {
        expect(config.type.elemID.adapter).toEqual('salesforce')
        expect(config.type.elemID.name).toEqual('')
      })
      it('should have values', () => {
        expect(config.value).toHaveProperty('username')
        expect(config.value.username).toEqual('foo')
      })
    })

    describe('updates', () => {
      it('parse update fields', async () => {
        const orig = elements[7] as ObjectType
        const update = elements[8] as ObjectType
        expect(orig.elemID).toEqual(update.elemID)
        expect(update.fields.num.type.elemID.name).toBe('update')
      })
    })

    describe('field type', () => {
      let numberType: PrimitiveType
      beforeAll(() => {
        numberType = elements[9] as PrimitiveType
      })
      it('should have the correct type', () => {
        expect(numberType.primitive).toBe(PrimitiveTypes.NUMBER)
      })

      it('should have the right annotations', () => {
        expect(numberType.annotations.scale.elemID.getFullName()).toEqual('number')
        expect(numberType.annotations.precision.elemID.getFullName()).toEqual('number')
        expect(numberType.annotations.unique.elemID.getFullName()).toEqual('boolean')
      })
    })

    describe('source map', () => {
      let model: ObjectType
      beforeAll(() => {
        model = elements[4] as ObjectType
      })

      it('should contain all top level elements', () => {
        elements.forEach(
          elem => expect(sourceMap.get(elem.elemID.getFullName())).not.toHaveLength(0)
        )
      })
      it('should have correct start and end positions', () => {
        const modelSource = sourceMap.get(model.elemID.getFullName())
        expect(modelSource).toHaveLength(1)
        expect(modelSource[0].start.line).toBe(15)
        expect(modelSource[0].end.line).toBe(41)
      })
      it('should contain fields', () => {
        Object.values(model.fields).forEach(
          field => expect(sourceMap.get(field.elemID.getFullName())).not.toHaveLength(0)
        )
      })
      it('should have all definitions of a field', () => {
        const updatedType = elements[7] as ObjectType
        const updatedField = Object.values(updatedType.fields)[0]
        const fieldSource = sourceMap.get(updatedField.elemID.getFullName())
        expect(fieldSource).toHaveLength(2)
      })
    })
  })

  describe('error tests', () => {
    it('fails on invalid inheritence syntax', async () => {
      const body = `
      type salesforce_string string {}
      `
      await expect(Parser.parse(Buffer.from(body), 'none')).rejects.toThrow()
    })
  })
  it('fails on invalid top level syntax', async () => {
    const body = 'bla'
    expect((await Parser.parse(Buffer.from(body), 'none')).errors.length).not.toBe(0)
  })
})

describe('Salto Dump', () => {
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

  const fieldType = new PrimitiveType({
    elemID: new ElemID('salesforce', 'field'),
    primitive: PrimitiveTypes.NUMBER,
    annotations: {
      alice: BuiltinTypes.NUMBER,
      bob: BuiltinTypes.NUMBER,
      tom: BuiltinTypes.BOOLEAN,
      jerry: BuiltinTypes.STRING,
    },
  })

  const model = new ObjectType({
    elemID: new ElemID('salesforce', 'test'),
  })
  model.fields.name = new Field(model.elemID, 'name', strType, { label: 'Name' })
  model.fields.num = new Field(model.elemID, 'num', numType)
  model.fields.list = new Field(model.elemID, 'list', strType, {}, true)
  model.fields.field = new Field(model.elemID, 'field', fieldType, {
    alice: 1,
    bob: 2,
    tom: true,
    jerry: 'mouse',
  })

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

  let body: string

  beforeAll(async () => {
    body = await Parser.dump([strType, numType, boolType, fieldType, model, instance, config])
  })

  it('dumps primitive types', () => {
    expect(body).toMatch(/type salesforce_string is string {/)
    expect(body).toMatch(/type salesforce_number is number {/)
    expect(body).toMatch(/type salesforce_bool is boolean {/)
  })

  it('dumps primitive field type annotations', () => {
    expect(body).toMatch(/type salesforce_field is number {.*?annotations {.*?number alice {/s)
    expect(body).toMatch(/type salesforce_field is number {.*?annotations {.*?number bob {/s)
    expect(body).toMatch(/type salesforce_field is number {.*?annotations {.*?boolean tom {/s)
    expect(body).toMatch(/type salesforce_field is number {.*?annotations {.*?string jerry {/s)
  })

  it('dumps instance elements', () => {
    expect(body).toMatch(/salesforce_test me {/)
  })

  it('dumps config elements', () => {
    expect(body).toMatch(/salesforce_test {/)
  })

  describe('dumped model', () => {
    it('has correct block type and label', () => {
      expect(body).toMatch(/type salesforce_test {/)
    })
    it('has complex attributes', () => {
      expect(body).toMatch(
        /lead_convert_settings = {\s*account = \[\s*{\s*input\s*=\s*"bla",\s*output\s*=\s*"foo"\s*}\s*\]\s*}/m,
      )
    })
    it('has fields', () => {
      expect(body).toMatch(
        /salesforce_string name {\s+label = "Name"\s+}/m,
      )
      expect(body).toMatch(
        /salesforce_number num {/m,
      )
      expect(body).toMatch(
        /list salesforce_string list {/m
      )
    })
    it('can be parsed back', async () => {
      const { elements, errors } = await Parser.parse(Buffer.from(body), 'none')
      expect(errors.length).toEqual(0)
      expect(elements.length).toEqual(7)
      expect(elements[0]).toEqual(strType)
      expect(elements[1]).toEqual(numType)
      expect(elements[2]).toEqual(boolType)
      TestHelpers.expectTypesToMatch(elements[3] as Type, fieldType)
      TestHelpers.expectTypesToMatch(elements[4] as Type, model)
      TestHelpers.expectInstancesToMatch(elements[5] as InstanceElement, instance)
      TestHelpers.expectInstancesToMatch(elements[6] as InstanceElement, config)
    })
  })
})
