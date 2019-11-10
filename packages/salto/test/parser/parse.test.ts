import {
  ObjectType, PrimitiveType, PrimitiveTypes, Element, ElemID,
  isObjectType, InstanceElement, BuiltinTypes,
} from 'adapter-api'
import { SourceRange, SourceMap, parse } from '../../src/parser/parse'

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
        
        annotations {
          salesforce_lead_convert_settings convert_settings {}
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
      settings salesforce_path_assistant_settings {
         metadata_type = "PathAssistantSettings"
         string full_name {
           _required = false
         }
         boolean path_assistant_enabled {
           _required = false
         }
      }
      salesforce_path_assistant_settings {
        full_name              = "PathAssistant"
        path_assistant_enabled = false
      }
      `

    beforeAll(async () => {
      ({ elements, sourceMap } = await parse(Buffer.from(body), 'none'))
    })

    describe('parse result', () => {
      it('should have all types', () => {
        expect(elements.length).toBe(12)
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
          expect(model.fields.name.type.elemID).toEqual(new ElemID('salesforce', 'string'))
        })
        it('should have annotation values', () => {
          expect(model.fields.name.annotations).toHaveProperty('label')
          expect(model.fields.name.annotations.label).toEqual('Name')
          expect(model.fields.name.annotations).toHaveProperty('_required')
          // eslint-disable-next-line no-underscore-dangle
          expect(model.fields.name.annotations._required).toEqual(true)
        })
      })
      describe('list field', () => {
        it('should exist', () => {
          expect(model.fields).toHaveProperty('nicknames')
        })
        it('should have the correct type', () => {
          expect(model.fields.nicknames.type.elemID).toEqual(new ElemID('salesforce', 'string'))
          expect(model.fields.nicknames.isList).toBe(true)
        })
      })
      describe('field annotations', () => {
        it('should exist', () => {
          expect(model.fields).toHaveProperty('fax')
        })
        it('should have the correct value', () => {
          expect(model.fields.fax.annotations).toEqual({
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
          expect(model.annotations).toHaveProperty('lead_convert_settings')
        })
        it('should have the correct value', () => {
          expect(model.annotations.lead_convert_settings).toEqual({
            account: [
              {
                input: 'bla',
                output: 'foo',
              },
            ],
          })
        })
      })

      describe('annotation types', () => {
        it('should exist', () => {
          expect(model.annotationTypes).toHaveProperty('convert_settings')
        })
        it('should have the correct type', () => {
          expect(model.annotationTypes.convert_settings.elemID.adapter).toEqual('salesforce')
          expect(model.annotationTypes.convert_settings.elemID.name).toEqual('lead_convert_settings')
        })
      })
    })

    describe('instance', () => {
      let instType: ObjectType
      let inst: InstanceElement
      beforeAll(() => {
        instType = elements[4] as ObjectType
        inst = elements[5] as InstanceElement
      })
      it('should have the right id', () => {
        expect(inst.elemID).toEqual(instType.elemID.createNestedID('instance', 'inst'))
      })
      it('should have the right type', () => {
        expect(inst.type.elemID).toEqual(instType.elemID)
      })
      it('should have values', () => {
        expect(inst.value).toHaveProperty('name')
        expect(inst.value.name).toEqual('me')
      })
      it('should not be setting', () => {
        expect(inst.type.isSettings).toBeFalsy()
      })
    })

    describe('config', () => {
      const configTypeId = new ElemID('salesforce')
      let config: InstanceElement
      beforeAll(() => {
        config = elements[6] as InstanceElement
      })
      it('should have the right id', () => {
        expect(config.elemID).toEqual(
          configTypeId.createNestedID('instance', ElemID.CONFIG_INSTANCE_NAME),
        )
      })
      it('should have the right type', () => {
        expect(config.type.elemID).toEqual(configTypeId)
      })
      it('should have values', () => {
        expect(config.value).toHaveProperty('username')
        expect(config.value.username).toEqual('foo')
      })
      it('should not be setting', () => {
        expect(config.type.isSettings).toBeFalsy()
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

      it('should have the correct annotations', () => {
        expect(numberType.annotationTypes.scale.elemID).toEqual(BuiltinTypes.NUMBER.elemID)
        expect(numberType.annotationTypes.precision.elemID).toEqual(BuiltinTypes.NUMBER.elemID)
        expect(numberType.annotationTypes.unique.elemID).toEqual(BuiltinTypes.BOOLEAN.elemID)
      })
    })

    describe('settings type', () => {
      let settingsType: ObjectType

      beforeAll(() => {
        settingsType = elements[10] as ObjectType
      })

      it('should have the correct id', () => {
        expect(settingsType.elemID).toEqual(new ElemID('salesforce', 'path_assistant_settings'))
      })
      it('should be marked as a settings type', () => {
        expect(settingsType.isSettings).toBeTruthy()
      })
    })

    describe('settings instance', () => {
      let settingsType: ObjectType
      let settingsInstance: InstanceElement

      beforeAll(() => {
        settingsType = elements[10] as ObjectType
        settingsInstance = elements[11] as InstanceElement
      })

      it('should have the correct id', () => {
        expect(settingsInstance.elemID).toEqual(
          settingsType.elemID.createNestedID('instance', ElemID.CONFIG_INSTANCE_NAME),
        )
      })
      it('should have to correct type ID', () => {
        expect(settingsInstance.type.elemID).toEqual(settingsType.elemID)
        expect(settingsInstance.type.isSettings).toBeTruthy()
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
        const modelSource = sourceMap.get(model.elemID.getFullName()) as SourceRange[]
        expect(modelSource).toBeDefined()
        expect(modelSource).toHaveLength(1)
        expect(modelSource[0].start.line).toBe(15)
        expect(modelSource[0].end.line).toBe(45)
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
      it('should contain nested attribute values', () => {
        const nestedAttrId = model.elemID
          .createNestedID('attr')
          .createNestedID('lead_convert_settings')
          .createNestedID('account')
          .createNestedID('0')
          .createNestedID('input')
        const nestedAttrSource = sourceMap.get(nestedAttrId.getFullName())
        expect(nestedAttrSource).toHaveLength(1)
      })
    })
  })

  describe('error tests', () => {
    it('fails on invalid inheritence syntax', async () => {
      const body = `
      type salesforce_string string {}
      `
      await expect(parse(Buffer.from(body), 'none')).rejects.toThrow()
    })
  })
  it('fails on invalid top level syntax', async () => {
    const body = 'bla'
    expect((await parse(Buffer.from(body), 'none')).errors.length).not.toBe(0)
  })
})
