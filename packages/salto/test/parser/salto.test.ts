import {
  ObjectType, PrimitiveType, PrimitiveTypes, Element, ElemID, isObjectType, Type, InstanceElement,
  Field,
} from 'adapter-api'
import Parser from '../../src/parser/salto'

/**
 * Compare two types and expect them to be the same.
 * This is slightly different than just deep equality because
 * in fields and annotations we only exepct the type ID to match
 */
const expectTypesToMatch = (actual: Type, expected: Type): void => {
  expect(typeof actual).toBe(typeof expected)
  expect(actual.elemID).toEqual(expected.elemID)
  expect(actual.annotationsValues).toEqual(expected.annotationsValues)

  // Check annotations match
  expect(Object.keys(actual.annotate)).toEqual(Object.keys(expected.annotations))
  Object.keys(expected.annotations).forEach(
    key => expect(actual.annotations[key].elemID).toEqual(expected.annotations[key].elemID)
  )

  // Check fields match
  if (isObjectType(expected) && isObjectType(actual)) {
    expect(Object.keys(actual.fields)).toEqual(Object.keys(expected.fields))

    Object.values(expected.fields).forEach(expectedField => {
      expect(actual.fields).toHaveProperty(expectedField.name)
      const actualField = actual.fields[expectedField.name]

      expect(actualField.elemID).toEqual(expectedField.elemID)
      expect(actualField.name).toEqual(expectedField.name)
      expect(actualField.annotationsValues).toEqual(expectedField.annotationsValues)
      expect(actualField.type.elemID).toEqual(expectedField.type.elemID)
    })
  }
}

/**
 * Compare two instance elements and expect them to be the same.
 * This is slightly different than just deep equality beacuse we only expect
 * the type ID to match and not the whole type instance
 */
const expectInstancesToMatch = (expected: InstanceElement, actual: InstanceElement): void => {
  expect(expected.elemID).toEqual(actual.elemID)
  expect(expected.value).toEqual(actual.value)
  expect(expected.type.elemID).toEqual(actual.type.elemID)
}

describe('Salto parser', () => {
  describe('primitive and model', () => {
    let parsedElements: Element[]

    beforeAll(async () => {
      const body = `
      type salesforce_string is string { 
      }

      type salesforce_number is number {
      }

      type salesforce_boolean is boolean {
      }

      type salesforce_type is object {
        salesforce_number num {}
      }

      model salesforce_test {
        salesforce_string name {
          label = "Name"
          _required = true
        }

        list salesforce_string nicknames {
        }

        fax {
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
      `

      const { elements } = await Parser.parse(Buffer.from(body), 'none')
      parsedElements = elements
    })

    describe('parse result', () => {
      it('should have two types', () => {
        expect(parsedElements.length).toBe(7)
      })
    })

    describe('string type', () => {
      let stringType: PrimitiveType
      beforeAll(() => {
        stringType = parsedElements[0] as PrimitiveType
      })
      it('should have the correct type', () => {
        expect(stringType.primitive).toBe(PrimitiveTypes.STRING)
      })
    })

    describe('number type', () => {
      let numberType: PrimitiveType
      beforeAll(() => {
        numberType = parsedElements[1] as PrimitiveType
      })
      it('should have the correct type', () => {
        expect(numberType.primitive).toBe(PrimitiveTypes.NUMBER)
      })
    })

    describe('boolean type', () => {
      let booleanType: PrimitiveType
      beforeAll(() => {
        booleanType = parsedElements[2] as PrimitiveType
      })
      it('should have the correct type', () => {
        expect(booleanType.primitive).toBe(PrimitiveTypes.BOOLEAN)
      })
    })

    describe('object type', () => {
      let objectType: ObjectType
      beforeAll(() => {
        expect(isObjectType(parsedElements[3])).toBe(true)
        objectType = parsedElements[3] as ObjectType
      })
      it('should have a number field', () => {
        expect(objectType.fields).toHaveProperty('num')
      })
    })

    describe('model', () => {
      let model: ObjectType
      beforeAll(() => {
        model = parsedElements[4] as ObjectType
      })
      describe('new field', () => {
        it('should exist', () => {
          expect(model.fields).toHaveProperty('name')
        })
        it('should have the correct type', () => {
          expect(model.fields.name.type.elemID.adapter).toBe('salesforce')
          expect(model.fields.name.type.elemID.name).toEqual('string')
        })
        it('should identify list fields', () => {
          expect(model.fields.nicknames.type.elemID.adapter).toBe('salesforce')
          expect(model.fields.nicknames.type.elemID.name).toEqual('string')
          expect(model.fields.nicknames.isList).toBe(true)
        })
        it('should have annotation values', () => {
          expect(model.fields.name.annotationsValues).toHaveProperty('label')
          expect(model.fields.name.annotationsValues.label).toEqual('Name')
          expect(model.fields.name.annotationsValues).toHaveProperty('_required')
          // eslint-disable-next-line no-underscore-dangle
          expect(model.fields.name.annotationsValues._required).toEqual(true)
        })
      })
      describe('list field', () => {
        it('should exist', () => {
          expect(model.fields).toHaveProperty('nicknames')
        })
        it('should identify list fields', () => {
          expect(model.fields.nicknames.type.elemID.adapter).toBe('salesforce')
          expect(model.fields.nicknames.type.elemID.name).toEqual('string')
          expect(model.fields.nicknames.isList).toBe(true)
        })
      })
      describe('field override', () => {
        it('should exist', () => {
          expect(model.annotationsValues).toHaveProperty('fax')
        })
        it('should not be a new field', () => {
          expect(model.fields).not.toHaveProperty('fax')
        })
        it('should have the correct value', () => {
          expect(model.annotationsValues.fax).toEqual({
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
          expect(model.annotationsValues).toHaveProperty('lead_convert_settings')
        })
        it('should have the correct value', () => {
          expect(model.annotationsValues.lead_convert_settings).toEqual({
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
        inst = parsedElements[5] as InstanceElement
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
        config = parsedElements[6] as InstanceElement
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

  const model = new ObjectType({
    elemID: new ElemID('salesforce', 'test'),
  })
  model.fields.name = new Field(model.elemID, 'name', strType, { label: 'Name' })
  model.fields.num = new Field(model.elemID, 'num', numType)
  model.fields.list = new Field(model.elemID, 'list', strType, {}, true)

  model.annotationsValues = {
    // eslint-disable-next-line @typescript-eslint/camelcase
    lead_convert_settings: {
      account: [
        {
          input: 'bla',
          output: 'foo',
        },
      ],
    },
  }

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

  let body: Buffer

  beforeAll(async () => {
    body = await Parser.dump([strType, numType, boolType, model, instance, config])
  })

  it('dumps primitive types', () => {
    expect(body).toMatch('type "salesforce_string" "is" "string" {')
    expect(body).toMatch('type "salesforce_number" "is" "number" {')
    expect(body).toMatch('type "salesforce_bool" "is" "boolean" {')
  })

  it('dumps instance elements', () => {
    expect(body).toMatch(/salesforce_test "?me"? {/)
  })

  it('dumps config elements', () => {
    expect(body).toMatch(/salesforce_test {/)
  })

  describe('dumped model', () => {
    it('has correct block type and label', () => {
      expect(body).toMatch('model "salesforce_test" {')
    })
    it('has complex attributes', () => {
      expect(body).toMatch(
        /lead_convert_settings = {\s*account = \[{\s*input = "bla",\s*output = "foo"\s*}\]\s*}/m,
      )
    })
    it('has fields', () => {
      expect(body).toMatch(
        /salesforce_string "?name"? {\s+label = "Name"\s+}/m,
      )
      expect(body).toMatch(
        /salesforce_number "?num"? {/m,
      )
      expect(body).toMatch(
        /list "?salesforce_string"? "?list"? {/m
      )
    })
    it('can be parsed back', async () => {
      const { elements, errors } = await Parser.parse(body, 'none')
      expect(errors.length).toEqual(0)
      expect(elements.length).toEqual(6)
      expect(elements[0]).toEqual(strType)
      expect(elements[1]).toEqual(numType)
      expect(elements[2]).toEqual(boolType)
      expectTypesToMatch(elements[3] as Type, model)
      expectInstancesToMatch(elements[4] as InstanceElement, instance)
      expectInstancesToMatch(elements[5] as InstanceElement, config)
    })
  })
})
