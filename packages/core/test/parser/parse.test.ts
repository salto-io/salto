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
import {
  ObjectType, PrimitiveType, PrimitiveTypes, Element, ElemID,
  isObjectType, InstanceElement, BuiltinTypes,
} from '@salto-io/adapter-api'
import { SourceRange, SourceMap, parse } from '../../src/parser/parse'

describe('Salto parser', () => {
  describe('primitive, model and extensions', () => {
    let elements: Element[]
    let sourceMap: SourceMap

    const body = `
      type salesforce.string is string {
      }

      type salesforce.number is number {
      }

      type salesforce.boolean is boolean {
      }

      type salesforce.obj is object {
        salesforce.number num {}
      }

      type salesforce.test {
        salesforce.string name {
          label = "Name"
          _required = true
        }

        list salesforce.string nicknames {
        }

        salesforce.phone fax {
          fieldLevelSecurity = {
            all_profiles = {
              visible = false
              read_only = false
            }
          }
        }

        LeadConvertSettings = {
          account = [
            {
              input = "bla"
              output = "foo"
            }
          ]
        }

        annotations {
          salesforce.LeadConvertSettings convertSettings {}
        }
      }

      salesforce.test inst {
        _depends_on = "fake1"
        name = "me"
      }

      salesforce {
        username = "foo"
      }

      type salesforce.type {
        salesforce.number num {}
      }

      type salesforce.type {
        update num {
          label = "Name"
          _required = true
        }
      }

      type salesforce.field is number {
        annotations {
          number scale {
          }
          number precision {
          }
          boolean unique {
          }
        }
      }
      settings salesforce.path_assistant_settings {
         metadataType = "PathAssistantSettings"
         string full_name {
           _required = false
         }
         boolean path_assistant_enabled {
           _required = false
         }

      }
      salesforce.path_assistant_settings {
        full_name              = "PathAssistant"
        path_assistant_enabled = false
      }

      salesforce.test_static_something {
         filepath               = @aaa.png
      }
      `
    beforeAll(() => {
      ({ elements, sourceMap } = parse(Buffer.from(body), 'none'))
    })

    describe('parse result', () => {
      it('should have all types', () => {
        expect(elements.length).toBe(13)
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
            fieldLevelSecurity: {
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
          expect(model.annotations).toHaveProperty('LeadConvertSettings')
        })
        it('should have the correct value', () => {
          expect(model.annotations.LeadConvertSettings).toEqual({
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
          expect(model.annotationTypes).toHaveProperty('convertSettings')
        })
        it('should have the correct type', () => {
          expect(model.annotationTypes.convertSettings.elemID.adapter).toEqual('salesforce')
          expect(model.annotationTypes.convertSettings.elemID.name).toEqual('LeadConvertSettings')
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

      it('should have annotations', () => {
        expect(inst.annotations).toHaveProperty('_depends_on')
        // eslint-disable-next-line no-underscore-dangle
        expect(inst.annotations._depends_on).toEqual('fake1')
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
          configTypeId.createNestedID('instance', ElemID.CONFIG_NAME),
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

    describe('static file asset', () => {
      let settingsType: InstanceElement

      beforeAll(() => {
        settingsType = elements[12] as InstanceElement
      })

      it('should have the correct path', () => {
        expect(settingsType.value.filepath).toEqual('aaa.png')
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
          settingsType.elemID.createNestedID('instance', ElemID.CONFIG_NAME),
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
          .createNestedID('LeadConvertSettings')
          .createNestedID('account')
          .createNestedID('0')
          .createNestedID('input')
        const nestedAttrSource = sourceMap.get(nestedAttrId.getFullName())
        expect(nestedAttrSource).toHaveLength(1)
      })
      it('should contain annotation types', () => {
        const annotationTypesId = model.elemID
          .createNestedID('annotation')
        const annotationTypesSource = sourceMap.get(annotationTypesId.getFullName())
        expect(annotationTypesSource).toHaveLength(1)
      })
      it('should contain a single annotation type', () => {
        const annotationTypeId = model.elemID
          .createNestedID('annotation')
          .createNestedID('convertSettings')
        const annotationTypeSource = sourceMap.get(annotationTypeId.getFullName())
        expect(annotationTypeSource).toHaveLength(1)
      })
    })
  })

  describe('error tests', () => {
    it('fails on invalid inheritance syntax', async () => {
      const body = `
      type salesforce.string string {}
      `
      expect(() => parse(Buffer.from(body), 'none')).toThrow()
    })
  })
  it('fails on invalid top level syntax', async () => {
    const body = 'bla'
    expect(parse(Buffer.from(body), 'none').errors).not.toHaveLength(0)
  })
})
