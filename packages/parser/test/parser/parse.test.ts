/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  ObjectType,
  PrimitiveType,
  PrimitiveTypes,
  Element,
  ElemID,
  Variable,
  isMapType,
  isContainerType,
  isObjectType,
  InstanceElement,
  BuiltinTypes,
  isListType,
  isVariable,
  isType,
  isPrimitiveType,
  ListType,
  ReferenceExpression,
  VariableExpression,
  TemplateExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { registerTestFunction, registerThrowingFunction } from '../utils'
import { Functions, SourceRange, parse, SourceMap, tokenizeContent, ParseResult } from '../../src/parser'
import { LexerErrorTokenReachedError } from '../../src/parser/internal/native/lexer'

const { awu } = collections.asynciterable
const funcName = 'funcush'

let functions: Functions
describe('Salto parser', () => {
  beforeAll(() => {
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
        withTrailingNewline = '''
        This has 
        a trailing line with spaces
  
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
      }       
      
      type salesforce.escapedDashBeforeQuote {
        str = "you can't run away \\\\"
        unicodeStr = "this is \\u0061 basic thing"
      }

      type salesforce.templates {
        tmpl = "hello {{$\{temp.la@te.instance.stuff@us}}}"
      }
      
      type salesforce.multiline_templates {
        tmpl = '''
multiline
template {{$\{te@mp.late.instance.multiline_stuff@us}}}
value
'''
        escapedTemplateMarker = '''
multiline
\${{$\{te@mp.late.instance.multiline_stuff@us}}} and {{$\{te@mp.late.instance.multiline_stuff@us}}}\${{$\{te@mp.late.instance.multiline_stuff@us}}}{{$\{te@mp.late.instance.multiline_stuff@us}}} hello
'''
      }
      
      type salesforce.escaped_templates {
        tmpl = ">>>\\\${a.b}<<<"
      }
      `
    beforeAll(async () => {
      const parsed = await parse(Buffer.from(body), 'none', functions)
      elements = await awu(parsed.elements)
        .filter(element => !isContainerType(element))
        .toArray()
      genericTypes = await awu(parsed.elements)
        .filter(element => isListType(element) || isMapType(element))
        .toArray()
      sourceMap = parsed.sourceMap
    })

    describe('parse result', () => {
      it('should have all types', () => {
        expect(elements.length).toBe(25)
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
              // eslint-disable-next-line camelcase
              all_profiles: {
                visible: false,
                // eslint-disable-next-line camelcase
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
        expect(config.elemID).toEqual(configTypeId.createNestedID('instance', ElemID.CONFIG_NAME))
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
        expect(settingsInstance.elemID).toEqual(settingsType.elemID.createNestedID('instance', ElemID.CONFIG_NAME))
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
        elements
          .filter(elem => !(isType(elem) && isContainerType(elem)))
          .forEach(elem => expect(sourceMap.get(elem.elemID.getFullName())).not.toHaveLength(0))
      })
      it('should have correct start and end positions', () => {
        const modelSource = sourceMap.get(model.elemID.getFullName()) as SourceRange[]
        expect(modelSource).toBeDefined()
        expect(modelSource).toHaveLength(1)
        expect(modelSource[0].start.line).toBe(16)
        expect(modelSource[0].end.line).toBe(53)
      })
      it('should contain fields', () => {
        Object.values(model.fields).forEach(field =>
          expect(sourceMap.get(field.elemID.getFullName())).not.toHaveLength(0),
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
        const annotationTypesId = model.elemID.createNestedID('annotation')
        const annotationTypesSource = sourceMap.get(annotationTypesId.getFullName())
        expect(annotationTypesSource).toHaveLength(1)
      })
      it('should contain a single annotation type', () => {
        const annotationTypeId = model.elemID.createNestedID('annotation').createNestedID('convertSettings')
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
          expect(instanceWithFunctions.value.contentWithNumber).toHaveProperty('funcName', 'funcush')
          expect(instanceWithFunctions.value.contentWithNumber).toHaveProperty('parameters', [1])
        })
        it('string', () => {
          expect(instanceWithFunctions.value.content).toHaveProperty('funcName', 'funcush')
          expect(instanceWithFunctions.value.content).toHaveProperty('parameters', ['some.png'])
        })
        it('boolean', () => {
          expect(instanceWithFunctions.value.contentWithBoolean).toHaveProperty('funcName', 'funcush')
          expect(instanceWithFunctions.value.contentWithBoolean).toHaveProperty('parameters', [true])
        })
        it('list', () => {
          expect(instanceWithFunctions.value.contentWithList).toHaveProperty('funcName', 'funcush')
          expect(instanceWithFunctions.value.contentWithList).toHaveProperty('parameters')
          expect(instanceWithFunctions.value.contentWithList.parameters[0]).toHaveLength(3)
          expect(instanceWithFunctions.value.contentWithList.parameters[0]).toEqual(['yes', 'dad', true])
        })
        it('several params', () => {
          expect(instanceWithFunctions.value.contentWithSeveralParams).toHaveProperty('funcName', 'funcush')
          expect(instanceWithFunctions.value.contentWithSeveralParams).toHaveProperty('parameters')
          expect(instanceWithFunctions.value.contentWithSeveralParams.parameters).toHaveLength(3)
          expect(instanceWithFunctions.value.contentWithSeveralParams.parameters).toEqual([false, 3, 'WAT'])
        })
        it('mixed', () => {
          expect(instanceWithFunctions.value.contentWithMixed).toHaveProperty('funcName', 'funcush')
          expect(instanceWithFunctions.value.contentWithMixed).toHaveProperty('parameters')
          expect(instanceWithFunctions.value.contentWithMixed.parameters).toHaveLength(3)
          expect(instanceWithFunctions.value.contentWithMixed.parameters).toEqual([false, [3, 3], 'WAT'])
        })
        it('nested', () => {
          expect(instanceWithFunctions.value.contentWithNested).toHaveProperty('funcName', 'funcush')
          expect(instanceWithFunctions.value.contentWithNested).toHaveProperty('parameters')
          expect(instanceWithFunctions.value.contentWithNested.parameters).toHaveLength(3)
          expect(instanceWithFunctions.value.contentWithNested.parameters).toEqual([false, [3, [1, 2]], 'WAT'])
        })
        it('multiline', () => {
          expect(instanceWithFunctions.value.contentWithMultilineArraysAndParameters).toHaveProperty(
            'funcName',
            'funcush',
          )
          expect(instanceWithFunctions.value.contentWithMultilineArraysAndParameters).toHaveProperty('parameters')
          expect(instanceWithFunctions.value.contentWithMultilineArraysAndParameters.parameters).toHaveLength(3)
          expect(instanceWithFunctions.value.contentWithMultilineArraysAndParameters.parameters).toEqual([
            'regular',
            ['aa', 2, false],
            321,
          ])
        })
        it('nested in object', () => {
          expect(instanceWithFunctions.value.contentWithNestedFunction).toHaveProperty('nestalicous')
          const func = instanceWithFunctions.value.contentWithNestedFunction.nestalicous
          expect(func).toHaveProperty('parameters')
          expect(func.parameters).toHaveLength(1)
          expect(func.parameters).toEqual(['yeah'])
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
      it('should preserve end of line spaces without inserting a newline', () => {
        expect(multilineObject.annotations).toHaveProperty('withSpaces')
        expect(multilineObject.annotations.withSpaces).toEqual('        Give me some \n        OK?')
      })
      it('should preserve end of line spaces on new line', () => {
        expect(multilineObject.annotations).toHaveProperty('withTrailingNewline')
        expect(multilineObject.annotations.withTrailingNewline).toEqual(
          '        This has \n        a trailing line with spaces\n  ',
        )
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
      it('should parse a string value with escaped quotes', () => {
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

    describe('templates', () => {
      let refObj: ObjectType
      let multilineRefObj: ObjectType

      beforeAll(() => {
        refObj = elements[22] as ObjectType
        multilineRefObj = elements[23] as ObjectType
      })

      it('should parse references to template as TemplateExpression', () => {
        expect(refObj.annotations.tmpl).toBeInstanceOf(TemplateExpression)
        expect(refObj.annotations.tmpl.parts).toEqual([
          'hello {{',
          expect.objectContaining({
            elemID: new ElemID('temp', 'la@te', 'instance', 'stuff@us'),
          }),
          '}}',
        ])
      })

      it('should parse references to multiline template as TemplateExpression', () => {
        expect(multilineRefObj.annotations.tmpl).toBeInstanceOf(TemplateExpression)
        expect(multilineRefObj.annotations.tmpl.parts).toEqual([
          'multiline\ntemplate {{',
          expect.objectContaining({
            elemID: new ElemID('te@mp', 'late', 'instance', 'multiline_stuff@us'),
          }),
          '}}\nvalue',
        ])
      })

      it('should parse references in multiline that exists on the same line as an escaped template marker as TemplateExpression', () => {
        expect(multilineRefObj.annotations.escapedTemplateMarker).toBeInstanceOf(TemplateExpression)
        expect(multilineRefObj.annotations.escapedTemplateMarker.parts).toEqual([
          'multiline\n${{',
          expect.objectContaining({
            elemID: new ElemID('te@mp', 'late', 'instance', 'multiline_stuff@us'),
          }),
          '}} and {{',
          expect.objectContaining({
            elemID: new ElemID('te@mp', 'late', 'instance', 'multiline_stuff@us'),
          }),
          '}}${{',
          expect.objectContaining({
            elemID: new ElemID('te@mp', 'late', 'instance', 'multiline_stuff@us'),
          }),
          '}}{{',
          expect.objectContaining({
            elemID: new ElemID('te@mp', 'late', 'instance', 'multiline_stuff@us'),
          }),
          '}} hello',
        ])
      })
    })

    describe('escape quote', () => {
      let escapeObj: ObjectType
      beforeAll(() => {
        escapeObj = elements[21] as ObjectType
      })

      it('should parsed the double escaped string', () => {
        expect(escapeObj.annotations.str).toEqual("you can't run away \\")
      })
      it('should parse the unicode escaping', () => {
        expect(escapeObj.annotations.unicodeStr).toEqual('this is a basic thing')
      })
    })

    describe('escaped templates', () => {
      let escapeTemplateObj: ObjectType
      beforeAll(() => {
        escapeTemplateObj = elements[24] as ObjectType
      })

      it('does not parse escaped references', () => {
        // eslint-disable-next-line no-template-curly-in-string
        expect(escapeTemplateObj.annotations.tmpl).toEqual('>>>${a.b}<<<')
      })
    })
  })

  it('parses loooong content strings', async () => {
    const stringLength = 8498737
    const body = `
    type salesforce.escapedQuotes {
      str = "${'a'.repeat(stringLength)}"
    }
    `
    const parsed = await parse(Buffer.from(body), 'none', functions)
    const elements = await awu(parsed.elements)
      .filter(element => !isContainerType(element))
      .toArray()
    expect(elements[0].annotations.str.length).toEqual(stringLength)
  })

  it('parse multiline string with a U+200D unicode before a \\n', async () => {
    // we have this test as this unicode character joins characters together. in our case, the problem is when this
    // joiner is the last character in the string - because we add a \n before the closing ''', parsing that unicode
    // character “correctly” means joining the \n with whatever came before the \u+200D, which makes it not a \n anymore
    // This test makes sure that we parse it correctly.
    const body = `
    type salesforce.escapedQuotes {
      str = '''

        this is a unicode test ‍
      '''
    }
 `
    const parsed = await parse(Buffer.from(body), 'none', functions)
    const elements = await awu(parsed.elements)
      .filter(element => !isContainerType(element))
      .toArray()
    expect(elements[0].annotations.str).toEqual('\n        this is a unicode test ‍')
  })

  describe('simple error tests', () => {
    it('fails on invalid inheritance syntax', async () => {
      const body = `
      type salesforce.string string {}
      `
      const result = await parse(Buffer.from(body), 'none', functions)
      expect(result.errors).not.toHaveLength(0)
      expect(result.errors[0].summary).toEqual('invalid type definition')
    })

    it('fails on invalid syntax', async () => {
      const body = `
      salto {
        test: "Test"
      }
      `
      const result = await parse(Buffer.from(body), 'none', functions)
      expect(result.errors).not.toHaveLength(0)
      expect(result.errors[0].summary).toEqual('Invalid block item')
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
      expect(result.errors[0].summary).toEqual('Invalid block item')
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
      expect(result.errors[0].summary).toEqual('Invalid attribute definition')
    })

    describe('unexpected parsing failures', () => {
      let body: string
      beforeAll(() => {
        body = `
        adapter_id.some_asset {
          content = funcush("some.png")
        `
      })

      it('puts unexpected errors into the parse result, without additional information', async () => {
        const throwingFunctions = registerThrowingFunction(funcName, () => {
          throw new Error('unexpected')
        })
        const result = await parse(Buffer.from(body), 'filename', throwingFunctions)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].message).toEqual('unexpected')
        expect(result.errors[0].context).toEqual({
          filename: 'filename',
          start: { byte: 1, col: 1, line: 1 },
          end: { byte: 1, col: 1, line: 1 },
        })
      })

      it('puts invalid lexer errors into the parse result, with token information', async () => {
        const throwingFunctions = registerThrowingFunction(funcName, () => {
          throw new LexerErrorTokenReachedError({
            type: 'test',
            value: 'test',
            text: 'test',
            lineBreaks: 1,
            offset: 5,
            line: 3,
            col: 6,
          })
        })
        const result = await parse(Buffer.from(body), 'filename', throwingFunctions)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].message).toEqual('Invalid syntax')
        expect(result.errors[0].context).toEqual({
          filename: 'filename',
          start: { byte: 5, col: 6, line: 3 },
          end: { byte: 9, col: 1, line: 4 },
        })
      })
    })

    it('fails on invalid object item with unexpected eof', async () => {
      const body = `
      salto {
        a = {
          {`
      const result = await parse(Buffer.from(body), 'none', functions)
      expect(result.errors).not.toHaveLength(0)
      expect(result.errors[0].summary).toEqual('Invalid attribute key')
    })

    it('fails on invalid character', async () => {
      const body = `
        salesforce.Type inst {
          val = 'aaa"
        }
      `
      const result = await parse(Buffer.from(body), 'none', functions)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].summary).toEqual('Invalid string character')
    })
  })

  it('fails on invalid top level syntax', async () => {
    const body = 'bla'
    const result = await parse(Buffer.from(body), 'none', functions)
    expect(result.errors).not.toHaveLength(0)
  })

  it('should parse instance name that starts with boolean', async () => {
    const body = `
  salesforce.someType false_string {}
  `
    const result = await parse(Buffer.from(body), 'none', functions)
    expect(result.errors).toHaveLength(0)
  })

  it('should create parse error if id type of instance element is invalid', async () => {
    const body = `
  salesforce.someType.a false_string {}
  `
    const result = await parse(Buffer.from(body), 'none', functions)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].summary).toEqual('Invalid type name')
    expect(result.elements).toHaveLength(0)
  })

  it('should create parse error if id of object type is invalid', async () => {
    const body = `
  type salesforce.someType.a {}
  `
    const result = await parse(Buffer.from(body), 'none', functions)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].summary).toEqual('Invalid type name')
    expect(result.elements).toHaveLength(0)
  })

  it('should recover from invalid id type error', async () => {
    const body = `
  type salesforce.someType.a {
    salesforce.otherType.b bField {}
  }
  type salesforce.anotherType { }
  `
    const result = await parse(Buffer.from(body), 'none', functions)
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0].summary).toEqual('Invalid type name')
    expect(result.elements).toHaveLength(1)
    expect((result.elements as InstanceElement[])[0].elemID).toEqual(new ElemID('salesforce', 'anotherType'))
  })

  describe('parse when calcSourceMap is false', () => {
    it('should not return a sourceMap', async () => {
      const body = `
        type salesforce.string is string {
        }
      `
      const parsed = await parse(Buffer.from(body), 'none', functions, false)
      expect(parsed.errors).toHaveLength(0)
      expect(parsed.sourceMap).toBeUndefined()
    })
  })

  describe('parse unicode line terminators', () => {
    let parsed: ParseResult
    beforeAll(async () => {
      const body = `
      type salesforce.unicodeLines {\u2028
        // comment\u2028
        multi = '''\u2028
        end with unicode line separator\u2028
        end with unicode paragraph separator\u2029
        '''\u2028
        single = "end single with unicode"\u2028
        terminatorInString = "have \u2029 in the string"
      }\u2028
      `.replace(/\n/g, '')
      parsed = await parse(Buffer.from(body), 'none', functions)
    })

    it('should not have errors', () => {
      expect(parsed.errors).toHaveLength(0)
    })

    describe('multiline strings', () => {
      it('should parse unicode line separators', () => {
        const parsedValue = (parsed.elements as InstanceElement[])[0].annotations.multi
        expect(parsedValue).toContain('end with unicode line separator')
      })

      it('should parse unicode paragraph separators', () => {
        const parsedValue = (parsed.elements as InstanceElement[])[0].annotations.multi
        expect(parsedValue).toContain('end with unicode paragraph separator')
      })
    })

    describe('single line strings', () => {
      it('should parse unicode line separators', () => {
        const parsedValue = (parsed.elements as InstanceElement[])[0].annotations.single
        expect(parsedValue).toContain('end single with unicode')
      })
      it('should support unicode newlines inside the string', () => {
        const parsedValue = (parsed.elements as InstanceElement[])[0].annotations.terminatorInString
        expect(parsedValue).toEqual('have \u2029 in the string')
      })
    })
  })

  describe('tokenizeContent', () => {
    it('separate and token each part of a line correctly', () => {
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
