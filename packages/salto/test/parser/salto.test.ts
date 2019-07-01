import Parser from '../../src/parser/salto'
import {
  ObjectType, PrimitiveType, PrimitiveTypes, TypesRegistry, Type, TypeID,
} from '../../src/core/elements'

describe('Salto parser', () => {
  describe('primitive and model', () => {
    let parsedElements: Type[]

    beforeAll(async () => {
      const body = `
      type salesforce_string is string { 
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

      const parser = new Parser(new TypesRegistry())
      const { elements } = await parser.parse(Buffer.from(body), 'none')
      parsedElements = elements
    })

    describe('parse result', () => {
      it('should have two types', () => {
        expect(parsedElements.length).toBe(2)
      })
    })

    describe('primitive type', () => {
      let stringType: PrimitiveType
      beforeAll(() => {
        stringType = parsedElements[0] as PrimitiveType
      })
      it('should have the correct type', () => {
        expect(stringType.primitive).toBe(PrimitiveTypes.STRING)
      })
    })

    describe('model', () => {
      let model: ObjectType
      beforeAll(() => {
        model = parsedElements[1] as ObjectType
      })
      describe('new field', () => {
        it('should exist', () => {
          expect(model.fields).toHaveProperty('name')
        })
        it('should have the correct type', () => {
          expect(model.fields.name.typeID.adapter).toBe('salesforce')
          expect(model.fields.name.typeID.name).toBe('string')
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
      const parser = new Parser(new TypesRegistry())
      await expect(parser.parse(Buffer.from(body), 'none')).rejects.toThrow()
    })
  })
  it('fails on invalid top level syntax', async () => {
    const body = 'bla {}'
    const parser = new Parser(new TypesRegistry())
    await expect(parser.parse(Buffer.from(body), 'none')).rejects.toThrow()
  })
})

describe('Salto Dump', () => {
  const registry = new TypesRegistry()

  const primitive = registry.getType(
    new TypeID({ adapter: 'salesforce', name: 'string' }),
    PrimitiveTypes.STRING,
  )
  const model = registry.getType(new TypeID({ adapter: 'salesforce', name: 'test' })) as ObjectType
  model.fields.name = primitive
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
    body = await Parser.dump([primitive, model])
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
        /salesforce_string "name" {\s+label = "Name"\s+}/m,
      )
    })
    it('can be parsed back', async () => {
      const { elements, errors } = await new Parser(new TypesRegistry()).parse(body, 'none')
      expect(errors.length).toEqual(0)
      expect(elements.length).toEqual(2)
      expect(elements[0]).toEqual(primitive)
      expect(elements[1]).toEqual(model)
    })
  })
})
