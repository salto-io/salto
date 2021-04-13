/*
*                      Copyright 2021 Salto Labs Ltd.
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
  ObjectType, PrimitiveType, PrimitiveTypes, Element, ElemID, Variable, isMapType, isContainerType,
  isObjectType, InstanceElement, BuiltinTypes, isListType, isVariable,
  isType, isPrimitiveType, ListType, ReferenceExpression, VariableExpression,
} from '@salto-io/adapter-api'
import each from 'jest-each'
// import each from 'jest-each'
import { collections } from '@salto-io/lowerdash'
import { registerTestFunction } from '../utils'
import {
  Functions,
} from '../../src/parser/functions'
import { SourceRange, parse, SourceMap, tokenizeContent } from '../../src/parser'

const { awu } = collections.asynciterable
const funcName = 'funcush'

let functions: Functions
each([true, false]).describe('Salto parser', (useLegacyParser: boolean) => {
  beforeAll(() => {
    if (useLegacyParser) {
      process.env.SALTO_USE_LEGACY_PARSER = '1'
    } else {
      delete process.env.SALTO_USE_LEGACY_PARSER
    }
    functions = registerTestFunction(funcName)
  })
  describe('primitive, model and extensions', () => {
    let elements: Element[]
    let genericTypes: Element[]
    let sourceMap: SourceMap

    const body = `
      type salesforce.string is string {
      }

      type salesforce.number is number {
      }

      type salesforce.boolean is boolean {
      }
      // comment between top level blocks
      type salesforce.obj {
        // comments inside a block with invalid ending characters ?
        salesforce.number num {}
      }

      type salesforce.test {
        salesforce.string name { // comment after block def line end with questionmark?
          // comment inside a field
          label = "Name"
          _required = true //comment after attribute
        }

        "List<salesforce.string>" nicknames {
        }

        "Map<salesforce.number>" numChildren {
        }

        salesforce.phone fax {
          fieldLevelSecurity = {
            all_profiles = {
              visible = false
              read_only = false
              //comment inside an object
            }
          }
        }

        LeadConvertSettings = {
          account = [
            // comment inside an array
            {
              input = "bla"
              output = "foo"
            }
          ]
        }

        annotations {
          //comment inside an annotation block
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
      adapter_id.some_asset {
        content                                 = funcush("some.png")
        contentWithNumber                       = funcush(1)
        contentWithBoolean                      = funcush(true)
        contentWithList                         = funcush(["yes", "dad", true])
        contentWithSeveralParams                = funcush(false, 3, "WAT")
        contentWithMixed                        = funcush(false, [3, 3], "WAT")
        contentWithNested                       = funcush(false, [3, [
          1,
          2
        ]], "WAT")
        contentWithMultilineArraysAndParameters = funcush("regular", [
          "aa",
          2,
          false
        ], 321)
        contentWithNestedFunction               = {
          nestalicous                           = funcush("yeah")
        }
      }

      vars {
        name = 7
        name2 = "some string"
      }

      type salesforce.type {
        data = '''
        This
        is
        Multiline
        '''
        withSpaces = '''
        Give me some 
        OK?
        '''
        withQuotes = '''
          "I can see Russia from my house!"
        '''
      }

      type salesforce.stringAttr {
        "#strAttr" = "attr"
      }

      type salesforce.unknown is unknown {
      }

      type salesforce.emptyString {
        str = ""
      }

      type salesforce.escapedQuotes {
        str = "Is this \\"escaped\\"?"
      }

      type salesforce.references {
        toVar = var.name3
        toVal = salesforce.test.instance.inst.name
      }       `
    beforeAll(async () => {
      const parsed = await parse(Buffer.from(body), 'none', functions)
      elements = await awu(parsed.elements).filter(element => !isContainerType(element))
        .toArray()
      genericTypes = await awu(parsed.elements)
        .filter(element => isListType(element) || isMapType(element))
        .toArray()
      sourceMap = parsed.sourceMap
    })

    describe('parse result', () => {
      it('should have all types', () => {
        expect(elements.length).toBe(21)
        expect(genericTypes.length).toBe(2)
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

    describe('list type', () => {
      it('should have the correct inner type', () => {
        expect(genericTypes[0]).toBeDefined()
        const listType = genericTypes[0] as ListType
        expect(listType?.refInnerType.elemID).toEqual(new ElemID('salesforce', 'string'))
      })
    })

    describe('map type', () => {
      it('should have the correct inner type', () => {
        const mapType = genericTypes.find(isMapType)
        expect(mapType?.refInnerType.elemID).toEqual(new ElemID('salesforce', 'number'))
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
          expect(model.fields.name.refType.elemID).toEqual(new ElemID('salesforce', 'string'))
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
          expect(model.fields.nicknames.refType.elemID).toEqual(new ElemID('', 'List<salesforce.string>'))
        })
      })
      describe('map field', () => {
        it('should exist', () => {
          expect(model.fields).toHaveProperty('numChildren')
        })
        it('should have the correct type', () => {
          expect(model.fields.numChildren.refType.elemID).toEqual(new ElemID('', 'Map<salesforce.number>'))
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
          expect(model.annotationRefTypes).toHaveProperty('convertSettings')
        })
        it('should have the correct type', () => {
          expect(model.annotationRefTypes.convertSettings.elemID.adapter).toEqual('salesforce')
          expect(model.annotationRefTypes.convertSettings.elemID.name).toEqual('LeadConvertSettings')
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
        expect(inst.refType.elemID).toEqual(instType.elemID)
      })
      it('should have values', () => {
        expect(inst.value).toHaveProperty('name')
        expect(inst.value.name).toEqual('me')
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
        expect(config.refType.elemID).toEqual(configTypeId)
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
        expect(update.fields.num.refType.elemID.name).toBe('update')
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
        expect(numberType.annotationRefTypes.scale.elemID).toEqual(BuiltinTypes.NUMBER.elemID)
        expect(numberType.annotationRefTypes.precision.elemID).toEqual(BuiltinTypes.NUMBER.elemID)
        expect(numberType.annotationRefTypes.unique.elemID).toEqual(BuiltinTypes.BOOLEAN.elemID)
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
        expect(settingsInstance.refType.elemID).toEqual(settingsType.elemID)
      })
    })

    describe('source map', () => {
      let model: ObjectType
      beforeAll(() => {
        model = elements[4] as ObjectType
      })

      it('should contain all top level elements except list and map types', () => {
        elements.filter(elem => !(isType(elem) && isContainerType(elem))).forEach(
          elem => expect(sourceMap.get(elem.elemID.getFullName())).not.toHaveLength(0)
        )
      })
      it('should have correct start and end positions', () => {
        const modelSource = sourceMap.get(model.elemID.getFullName()) as SourceRange[]
        expect(modelSource).toBeDefined()
        expect(modelSource).toHaveLength(1)
        expect(modelSource[0].start.line).toBe(16)
        expect(modelSource[0].end.line).toBe(53)
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
    describe('functions', () => {
      let instanceWithFunctions: InstanceElement

      beforeAll(() => {
        instanceWithFunctions = elements[12] as InstanceElement
      })

      describe('parameters', () => {
        it('number', () => {
          expect(instanceWithFunctions.value.contentWithNumber)
            .toHaveProperty('funcName', 'funcush')
          expect(instanceWithFunctions.value.contentWithNumber)
            .toHaveProperty('parameters', [1])
        })
        it('string', () => {
          expect(instanceWithFunctions.value.content)
            .toHaveProperty('funcName', 'funcush')
          expect(instanceWithFunctions.value.content)
            .toHaveProperty('parameters', ['some.png'])
        })
        it('boolean', () => {
          expect(instanceWithFunctions.value.contentWithBoolean)
            .toHaveProperty('funcName', 'funcush')
          expect(instanceWithFunctions.value.contentWithBoolean)
            .toHaveProperty('parameters', [true])
        })
        it('list', () => {
          expect(instanceWithFunctions.value.contentWithList)
            .toHaveProperty('funcName', 'funcush')
          expect(instanceWithFunctions.value.contentWithList).toHaveProperty('parameters')
          expect(instanceWithFunctions.value.contentWithList.parameters[0])
            .toHaveLength(3)
          expect(instanceWithFunctions.value.contentWithList.parameters[0])
            .toEqual(['yes', 'dad', true])
        })
        it('several params', () => {
          expect(instanceWithFunctions.value.contentWithSeveralParams)
            .toHaveProperty('funcName', 'funcush')
          expect(instanceWithFunctions.value.contentWithSeveralParams).toHaveProperty('parameters')
          expect(instanceWithFunctions.value.contentWithSeveralParams.parameters)
            .toHaveLength(3)
          expect(instanceWithFunctions.value.contentWithSeveralParams.parameters)
            .toEqual([false, 3, 'WAT'])
        })
        it('mixed', () => {
          expect(instanceWithFunctions.value.contentWithMixed)
            .toHaveProperty('funcName', 'funcush')
          expect(instanceWithFunctions.value.contentWithMixed).toHaveProperty('parameters')
          expect(instanceWithFunctions.value.contentWithMixed.parameters)
            .toHaveLength(3)
          expect(instanceWithFunctions.value.contentWithMixed.parameters)
            .toEqual([false, [3, 3], 'WAT'])
        })
        it('nested', () => {
          expect(instanceWithFunctions.value.contentWithNested)
            .toHaveProperty('funcName', 'funcush')
          expect(instanceWithFunctions.value.contentWithNested).toHaveProperty('parameters')
          expect(instanceWithFunctions.value.contentWithNested.parameters)
            .toHaveLength(3)
          expect(instanceWithFunctions.value.contentWithNested.parameters)
            .toEqual([false, [3, [1, 2]], 'WAT'])
        })
        it('multiline', () => {
          expect(instanceWithFunctions.value.contentWithMultilineArraysAndParameters)
            .toHaveProperty('funcName', 'funcush')
          expect(instanceWithFunctions.value.contentWithMultilineArraysAndParameters).toHaveProperty('parameters')
          expect(instanceWithFunctions.value.contentWithMultilineArraysAndParameters.parameters)
            .toHaveLength(3)
          expect(instanceWithFunctions.value.contentWithMultilineArraysAndParameters.parameters)
            .toEqual(['regular', ['aa', 2, false], 321])
        })
        it('nested in object', () => {
          expect(instanceWithFunctions.value.contentWithNestedFunction)
            .toHaveProperty('nestalicous')
          const func = instanceWithFunctions.value.contentWithNestedFunction.nestalicous
          expect(func).toHaveProperty('parameters')
          expect(func.parameters)
            .toHaveLength(1)
          expect(func.parameters)
            .toEqual(['yeah'])
        })
      })
    })

    describe('variables', () => {
      let variable1: Variable
      let variable2: Variable

      beforeAll(() => {
        expect(isVariable(elements[13])).toBeTruthy()
        variable1 = elements[13] as Variable
        expect(isVariable(elements[14])).toBeTruthy()
        variable2 = elements[14] as Variable
      })

      it('should have the correct value', () => {
        expect(variable1.value).toBe(7)
        expect(variable2.value).toBe('some string')
      })
    })

    describe('multiline strings', () => {
      let multilineObject: ObjectType
      beforeAll(() => {
        multilineObject = elements[15] as ObjectType
      })
      it('should have a multiline string field', () => {
        expect(multilineObject.annotations).toHaveProperty('data')
        expect(multilineObject.annotations.data).toEqual('        This\n        is\n        Multiline')
      })
      it('should preserve end of line spaces', () => {
        expect(multilineObject.annotations).toHaveProperty('withSpaces')
        expect(multilineObject.annotations.withSpaces).toEqual('        Give me some \n        OK?')
      })
      it('should handle qoutation marks inside the multiline string', () => {
        expect(multilineObject.annotations).toHaveProperty('withQuotes')
        expect(multilineObject.annotations.withQuotes).toEqual('          "I can see Russia from my house!"')
      })
    })

    describe('string attr keys', () => {
      let stringAttrObject: ObjectType
      beforeAll(() => {
        stringAttrObject = elements[16] as ObjectType
      })
      it('should parse string attributes', () => {
        expect(stringAttrObject.annotations).toHaveProperty('#strAttr')
        expect(stringAttrObject.annotations['#strAttr']).toEqual('attr')
      })
    })

    describe('unknown primitive type', () => {
      it('should parse unknown primitive types', () => {
        const element = elements[17]
        expect(isPrimitiveType(element)).toBeTruthy()
        const unknownType = element as PrimitiveType
        expect(unknownType.primitive).toBe(PrimitiveTypes.UNKNOWN)
      })
    })

    describe('empty string', () => {
      it('should parse an empty string value', () => {
        const element = elements[18]
        expect(isObjectType(element)).toBeTruthy()
        const obj = element as ObjectType
        expect(obj.annotations.str).toEqual('')
      })
    })

    describe('escaped quotes', () => {
      it('should parse a string value with escaped qoutes', () => {
        const element = elements[19]
        expect(isObjectType(element)).toBeTruthy()
        const obj = element as ObjectType
        expect(obj.annotations.str).toEqual('Is this "escaped"?')
      })
    })

    describe('references', () => {
      let refObj: ObjectType
      beforeAll(() => {
        refObj = elements[20] as ObjectType
      })

      it('should parse references to values as ReferenceExpressions', () => {
        expect(refObj.annotations.toVal).toBeInstanceOf(ReferenceExpression)
      })

      it('should parse references to variables as VariableExpressions', () => {
        expect(refObj.annotations.toVar).toBeInstanceOf(VariableExpression)
      })
    })
  })

  describe('simple error tests', () => {
    it('fails on invalid inheritance syntax', async () => {
      const body = `
      type salesforce.string string {}
      `
      const result = await parse(Buffer.from(body), 'none', functions)
      expect(result.errors).not.toHaveLength(0)
      const expectedErrMsg = useLegacyParser
        ? 'expected keyword is. found string'
        : 'invalid type definition'
      expect(result.errors[0].summary).toEqual(expectedErrMsg)
    })

    it('fails on invalid syntax', async () => {
      const body = `
      salto {
        test: "Test"
      }
      `
      const result = await parse(Buffer.from(body), 'none', functions)
      expect(result.errors).not.toHaveLength(0)
      const expectedErrMsg = useLegacyParser
        ? 'Unexpected token: :'
        : 'Invalid block item'
      expect(result.errors[0].summary).toEqual(expectedErrMsg)
    })

    it('fails on missing list open in object', async () => {
      const body = `
      salto {
          {
            a = 1
          },
          {
            a = 2
          }
        ]
      }
      `
      const result = await parse(Buffer.from(body), 'none', functions)
      expect(result.errors).not.toHaveLength(0)
      const expectedErrMsg = useLegacyParser
        ? 'Unexpected token: {'
        : 'Invalid block item'
      expect(result.errors[0].summary).toEqual(expectedErrMsg)
    })

    it('fails on missing list open in object item', async () => {
      const body = `
      salto {
        a = {
            "abc"
          ]
        }
      }
      `
      const result = await parse(Buffer.from(body), 'none', functions)
      expect(result.errors).not.toHaveLength(0)
      const expectedErrMsg = useLegacyParser
        ? 'Unexpected token: ]'
        : 'Invalid attribute definition'
      expect(result.errors[0].summary).toEqual(expectedErrMsg)
    })

    it('fails on invalid object item with unexpected eof', async () => {
      const body = `
      salto {
        a = {
          {`
      const result = await parse(Buffer.from(body), 'none', functions)
      expect(result.errors).not.toHaveLength(0)
      const expectedErrMsg = useLegacyParser
        ? 'Unexpected end of file'
        : 'Invalid attribute key'
      expect(result.errors[0].summary).toEqual(expectedErrMsg)
    })
  })

  it('fails on invalid top level syntax', async () => {
    const body = 'bla'
    const result = await parse(Buffer.from(body), 'none', functions)
    expect(result.errors).not.toHaveLength(0)
  })
  describe('tokenizeContent', () => {
    it('seperate and token each part of a line correctly', () => {
      expect(Array.from(tokenizeContent('aaa   bbb ccc.ddd   "eee fff  ggg.hhh"'))).toEqual([
        { value: 'aaa', type: 'word', line: 1, col: 1 },
        { value: 'bbb', type: 'word', line: 1, col: 7 },
        { value: 'ccc.ddd', type: 'word', line: 1, col: 11 },
        { value: '"', type: 'dq', line: 1, col: 21 },
        { value: 'eee fff  ggg.hhh', type: 'content', line: 1, col: 22 },
        { value: '"', type: 'dq', line: 1, col: 38 },
      ])
    })
  })
})
