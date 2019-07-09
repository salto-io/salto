import {
  ObjectType, PrimitiveType, PrimitiveTypes, Element, ElemID, isObjectType, Type,
} from 'adapter-api'
import Parser from '../../src/parser/salto'

/**
 * Compare two types and expect them to be the same.
 * This is slightly different than just deep equality because
 * in fields and annotations we only exepct the type ID to match
 */
const expectTypesToMatch = (expected: Type, actual: Type): void => {
  expect(typeof expected).toBe(typeof actual)
  expect(expected.elemID).toEqual(actual.elemID)
  expect(expected.annotationsValues).toEqual(actual.annotationsValues)

  const expectTypeMapToMatch = (
    expectedTypes: Record<string, Type>,
    actualTypes: Record<string, Type>
  ): void => {
    expect(Object.keys(expectedTypes)).toEqual(Object.keys(actualTypes))
    Object.keys(expectedTypes).forEach(
      key => expect(expectedTypes[key].elemID).toEqual(actualTypes[key].elemID)
    )
  }
  expectTypeMapToMatch(expected.annotations, actual.annotations)

  if (isObjectType(expected) && isObjectType(actual)) {
    expectTypeMapToMatch(expected.fields, actual.fields)
  }
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
      }`

      const { elements } = await Parser.parse(Buffer.from(body), 'none')
      parsedElements = elements
    })

    describe('parse result', () => {
      it('should have two types', () => {
        expect(parsedElements.length).toBe(5)
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
          expect(model.fields.name.elemID.adapter).toBe('salesforce')
          expect(model.fields.name.elemID.name).toBe('string')
        })
        it('should have annotation values', () => {
          expect(model.annotationsValues).toHaveProperty('name')
          expect(model.annotationsValues.name).toHaveProperty('label')
          expect(model.annotationsValues.name.label).toEqual('Name')
          expect(model.annotationsValues.name).toHaveProperty('_required')
          // eslint-disable-next-line no-underscore-dangle
          expect(model.annotationsValues.name._required).toEqual(true)
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
    const body = 'bla {}'
    await expect(Parser.parse(Buffer.from(body), 'none')).rejects.toThrow()
  })
})

describe('Salto Dump', () => {
  const strType = new PrimitiveType({
    elemID: new ElemID({ adapter: 'salesforce', name: 'string' }),
    primitive: PrimitiveTypes.STRING,
  })

  const numType = new PrimitiveType({
    elemID: new ElemID({ adapter: 'salesforce', name: 'number' }),
    primitive: PrimitiveTypes.NUMBER,
  })

  const boolType = new PrimitiveType({
    elemID: new ElemID({ adapter: 'salesforce', name: 'bool' }),
    primitive: PrimitiveTypes.BOOLEAN,
  })

  const model = new ObjectType({
    elemID: new ElemID({ adapter: 'salesforce', name: 'test' }),
  })
  model.fields.name = strType
  model.fields.num = numType

  model.annotationsValues = {
    name: {
      label: 'Name',
    },
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

  let body: Buffer

  beforeAll(async () => {
    body = await Parser.dump([strType, numType, boolType, model])
  })

  it('dumps primitive string', () => {
    expect(body).toMatch('type "salesforce_string" "is" "string" {')
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
    })
    it('can be parsed back', async () => {
      const { elements, errors } = await Parser.parse(body, 'none')
      expect(errors.length).toEqual(0)
      expect(elements.length).toEqual(4)
      expect(elements[0]).toEqual(strType)
      expect(elements[1]).toEqual(numType)
      expect(elements[2]).toEqual(boolType)
      // When parsing every field gets annotation values, even if they are empty
      // this is not really a problem so it is ok to compare the parsed value with
      // a slightly modified version of the original
      model.annotationsValues.num = {}
      expectTypesToMatch(elements[3] as Type, model)
    })
  })
})
