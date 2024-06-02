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
  ListType,
  ReferenceExpression,
  VariableExpression,
  TemplateExpression,
  MapType,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { registerTestFunction, registerThrowingFunction } from '../utils'
import { Functions, SourceRange, parse, SourceMap, tokenizeContent, ParseError } from '../../src/parser'
import { LexerErrorTokenReachedError } from '../../src/parser/internal/native/lexer'

const { awu } = collections.asynciterable
const funcName = 'myFunc'

let functions: Functions

describe('Salto parser', () => {
  let elements: Element[]
  let sourceMap: SourceMap
  let errors: ParseError[]

  const parseBody = async (
    body: string,
  ): Promise<{ elements: Element[]; sourceMap: SourceMap; errors: ParseError[] }> => {
    const parsed = await parse(Buffer.from(body), 'none', functions, true)
    return {
      elements: await awu(parsed.elements).toArray(),
      sourceMap: parsed.sourceMap,
      errors: parsed.errors,
    }
  }

  const validateSourceMap = (): void => {
    elements
      .filter(elem => !(isType(elem) && isContainerType(elem)))
      .forEach(elem => expect(sourceMap.get(elem.elemID.getFullName())).not.toHaveLength(0))
  }

  const checkNoErrors = (): void => {
    expect(errors).toHaveLength(0)
  }

  beforeAll(() => {
    functions = registerTestFunction(funcName)
  })

  describe('with primitive definitions', () => {
    describe('when type is string', () => {
      const body = `
        type salesforce.string is string {
        }
      `

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
      })

      it('should have the correct type and ID', () => {
        expect(elements).toHaveLength(1)
        const stringType = elements[0] as PrimitiveType
        expect(stringType.primitive).toBe(PrimitiveTypes.STRING)
        expect(stringType.elemID).toEqual(new ElemID('salesforce', 'string'))
      })

      it('should contain all elements in source map', validateSourceMap)

      it('should have no errors', checkNoErrors)
    })

    describe('when type is number', () => {
      const body = `
        type salesforce.number is number {
        }
      `

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
      })

      it('should have the correct type and ID', () => {
        expect(elements).toHaveLength(1)
        const numberType = elements[0] as PrimitiveType
        expect(numberType.primitive).toBe(PrimitiveTypes.NUMBER)
        expect(numberType.elemID).toEqual(new ElemID('salesforce', 'number'))
      })

      it('should contain all elements in source map', validateSourceMap)

      it('should have no errors', checkNoErrors)
    })

    describe('when type is boolean', () => {
      const body = `
        type salesforce.boolean is boolean {
        }
      `

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
      })

      it('should have the correct type and ID', () => {
        expect(elements).toHaveLength(1)
        const booleanType = elements[0] as PrimitiveType
        expect(booleanType.primitive).toBe(PrimitiveTypes.BOOLEAN)
        expect(booleanType.elemID).toEqual(new ElemID('salesforce', 'boolean'))
      })

      it('should contain all elements in source map', validateSourceMap)

      it('should have no errors', checkNoErrors)
    })

    describe('when type is unknown', () => {
      const body = `
        type salesforce.unknown is unknown {
        }
      `

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
      })

      it('should have the correct type and ID', () => {
        expect(elements).toHaveLength(1)
        const unknownType = elements[0] as PrimitiveType
        expect(unknownType.primitive).toBe(PrimitiveTypes.UNKNOWN)
        expect(unknownType.elemID).toEqual(new ElemID('salesforce', 'unknown'))
      })

      it('should contain all elements in source map', validateSourceMap)

      it('should have no errors', checkNoErrors)
    })

    describe('when type is invalid', () => {
      const body = `
        type salesforce.invalid is invalid {
        }
      `

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
      })

      it('should parse type as unknown primitive with the correct ID', () => {
        expect(elements).toHaveLength(1)
        const unknownType = elements[0] as PrimitiveType
        expect(unknownType.primitive).toBe(PrimitiveTypes.UNKNOWN)
        expect(unknownType.elemID).toEqual(new ElemID('salesforce', 'invalid'))
      })

      it('should contain all elements in source map', validateSourceMap)

      it('should have an error', () => {
        expect(errors).toHaveLength(1)
        const error = errors[0]
        expect(error.summary).toEqual('Unknown primitive type')
        expect(error.message).toEqual("Unknown primitive type 'invalid'.")
      })
    })

    describe('when type is missing', () => {
      const body = `
        type salesforce.unknown is {
        }
      `

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
      })

      it('should have an error', () => {
        expect(errors).toHaveLength(1)
        const error = errors[0]
        expect(error.summary).toEqual('Invalid type definition')
        expect(elements).toHaveLength(0)
      })
    })
  })

  describe('with an object type definition', () => {
    describe('labels', () => {
      describe("with explicit 'is object'", () => {
        const body = `
          type salesforce.object is object {
          }
        `

        beforeEach(async () => {
          ;({ elements, sourceMap, errors } = await parseBody(body))
        })

        it('should parse type', () => {
          expect(elements).toHaveLength(1)
          const objectType = elements[0] as ObjectType
          expect(isObjectType(objectType)).toBe(true)
          expect(objectType.elemID).toEqual(new ElemID('salesforce', 'object'))
        })

        it('should contain all elements in source map', validateSourceMap)

        it('should have no errors', checkNoErrors)
      })

      describe('with implicit definition', () => {
        const body = `
          type salesforce.object {
          }
        `

        beforeEach(async () => {
          ;({ elements, sourceMap, errors } = await parseBody(body))
        })

        it('should parse type', () => {
          expect(elements).toHaveLength(1)
          const objectType = elements[0] as ObjectType
          expect(isObjectType(objectType)).toBe(true)
          expect(objectType.elemID).toEqual(new ElemID('salesforce', 'object'))
        })

        it('should contain all elements in source map', validateSourceMap)

        it('should have no errors', checkNoErrors)
      })

      describe("when 'is' keyword is dropped", () => {
        const body = `
          type salesforce.object object {
          }
        `

        beforeEach(async () => {
          ;({ elements, sourceMap, errors } = await parseBody(body))
        })

        it('should have an error', () => {
          expect(errors).toHaveLength(1)
          const error = errors[0]
          expect(error.summary).toEqual('Invalid type definition')
          expect(elements).toHaveLength(0)
        })
      })

      describe('with invalid name', () => {
        const body = `
          type salesforce.someType.a {
          }
        `

        beforeEach(async () => {
          ;({ elements, sourceMap, errors } = await parseBody(body))
        })

        it('should have an error', () => {
          expect(errors).toHaveLength(1)
          expect(errors[0].summary).toEqual('Invalid type name')
          expect(elements).toHaveLength(0)
        })
      })

      describe('with extra labels', () => {
        const body = `
          type salesforce.object is object and also additional labels {
          }
        `

        beforeEach(async () => {
          ;({ elements, sourceMap, errors } = await parseBody(body))
        })

        it('should have an error', () => {
          expect(errors).toHaveLength(1)
          expect(errors[0].summary).toEqual('Invalid type definition')
          expect(elements).toHaveLength(0)
        })
      })

      describe('invalid name followed by a valid type', () => {
        const body = `
          type salesforce.someType.a {
            salesforce.otherType.b bField {
            }
          }
          type salesforce.anotherType {
          }
        `

        beforeEach(async () => {
          ;({ elements, sourceMap, errors } = await parseBody(body))
        })

        it('should have errors', () => {
          expect(errors).toHaveLength(2)
          errors.forEach(error => expect(error.summary).toEqual('Invalid type name'))
        })

        it('should parse valid element', () => {
          expect(elements).toHaveLength(1)
          expect(elements[0].elemID).toEqual(new ElemID('salesforce', 'anotherType'))
        })
      })
    })

    describe('with fields and annotation values', () => {
      const body = `
        type salesforce.test {
          salesforce.string name {
            label = "Name"
            _required = true
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
      `
      let object: ObjectType

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
        object = elements[0] as ObjectType
      })

      it('should parse object type', () => {
        expect(isObjectType(object)).toBe(true)
      })

      it('should contain all elements in source map', validateSourceMap)

      it('should have no errors', checkNoErrors)

      describe('fields', () => {
        describe('when the type is new', () => {
          it('should exist', () => {
            expect(object.fields).toHaveProperty('name')
          })

          it('should have the correct type', () => {
            expect(object.fields.name.refType.elemID).toEqual(new ElemID('salesforce', 'string'))
          })

          it('should have annotation values', () => {
            expect(object.fields.name.annotations).toHaveProperty('label')
            expect(object.fields.name.annotations.label).toEqual('Name')
            expect(object.fields.name.annotations).toHaveProperty('_required')
            // eslint-disable-next-line no-underscore-dangle
            expect(object.fields.name.annotations._required).toBe(true)
          })
        })

        describe('when the type is a list', () => {
          it('should exist', () => {
            expect(object.fields).toHaveProperty('nicknames')
          })

          it('should have the correct type', () => {
            expect(object.fields.nicknames.refType.elemID).toEqual(new ElemID('', 'List<salesforce.string>'))
          })

          it('should create a list element', () => {
            const listType = elements[1] as ListType
            expect(isListType(listType)).toBe(true)
            expect(listType.refInnerType.elemID).toEqual(new ElemID('salesforce', 'string'))
          })
        })

        describe('when the type is a map', () => {
          it('should exist', () => {
            expect(object.fields).toHaveProperty('numChildren')
          })

          it('should have the correct type', () => {
            expect(object.fields.numChildren.refType.elemID).toEqual(new ElemID('', 'Map<salesforce.number>'))
          })

          it('should create a map element', () => {
            const mapType = elements[2] as MapType
            expect(isMapType(mapType)).toBe(true)
            expect(mapType.refInnerType.elemID).toEqual(new ElemID('salesforce', 'number'))
          })
        })
      })

      describe('field annotations', () => {
        it('should exist', () => {
          expect(object.fields).toHaveProperty('fax')
        })

        it('should have the correct value', () => {
          expect(object.fields.fax.annotations).toEqual({
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

      describe('annotations', () => {
        it('should exist', () => {
          expect(object.annotations).toHaveProperty('LeadConvertSettings')
        })

        it('should have the correct value', () => {
          expect(object.annotations.LeadConvertSettings).toEqual({
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
          expect(object.annotationRefTypes).toHaveProperty('convertSettings')
        })

        it('should have the correct type', () => {
          expect(object.annotationRefTypes.convertSettings.elemID.adapter).toEqual('salesforce')
          expect(object.annotationRefTypes.convertSettings.elemID.name).toEqual('LeadConvertSettings')
        })
      })

      describe('source map', () => {
        it('should have correct start and end positions', () => {
          const modelSource = sourceMap.get(object.elemID.getFullName()) as SourceRange[]
          expect(modelSource).toBeDefined()
          expect(modelSource).toHaveLength(1)
          expect(modelSource[0].start.line).toBe(2)
          expect(modelSource[0].end.line).toBe(35)
        })

        it('should contain fields', () => {
          Object.values(object.fields).forEach(field =>
            expect(sourceMap.get(field.elemID.getFullName())).not.toHaveLength(0),
          )
        })

        it('should contain nested attribute values', () => {
          const nestedAttrId = object.elemID
            .createNestedID('attr')
            .createNestedID('LeadConvertSettings')
            .createNestedID('account')
            .createNestedID('0')
            .createNestedID('input')
          const nestedAttrSource = sourceMap.get(nestedAttrId.getFullName())
          expect(nestedAttrSource).toHaveLength(1)
        })

        it('should contain annotation types', () => {
          const annotationTypesId = object.elemID.createNestedID('annotation')
          const annotationTypesSource = sourceMap.get(annotationTypesId.getFullName())
          expect(annotationTypesSource).toHaveLength(1)
        })

        it('should contain a single annotation type', () => {
          const annotationTypeId = object.elemID.createNestedID('annotation').createNestedID('convertSettings')
          const annotationTypeSource = sourceMap.get(annotationTypeId.getFullName())
          expect(annotationTypeSource).toHaveLength(1)
        })
      })
    })
  })

  describe('with a settings definition', () => {
    describe('labels', () => {
      describe('when the definition is valid', () => {
        const body = `
          settings salesforce.global {
          }
        `

        beforeEach(async () => {
          ;({ elements, sourceMap, errors } = await parseBody(body))
        })

        it('should parse settings', () => {
          expect(elements).toHaveLength(1)
          const settings = elements[0] as ObjectType
          expect(isObjectType(settings)).toBe(true)
          expect(settings.isSettings).toBe(true)
          expect(settings.elemID).toEqual(new ElemID('salesforce', 'global'))
        })

        it('should contain all elements in source map', validateSourceMap)

        it('should have no errors', checkNoErrors)
      })

      describe("with 'is' keyword", () => {
        const body = `
          settings salesforce.global is {
          }
        `

        beforeEach(async () => {
          ;({ elements, sourceMap, errors } = await parseBody(body))
        })

        it('should have an error', () => {
          expect(errors).toHaveLength(1)
          const error = errors[0]
          expect(error.summary).toEqual('Invalid settings type definition')
          expect(elements).toHaveLength(0)
        })
      })

      describe('with primitive type', () => {
        const body = `
          settings salesforce.global is string {
          }
        `

        beforeEach(async () => {
          ;({ elements, sourceMap, errors } = await parseBody(body))
        })

        it('should have an error', () => {
          expect(errors).toHaveLength(1)
          const error = errors[0]
          expect(error.summary).toEqual('Invalid settings type definition')
          expect(elements).toHaveLength(0)
        })
      })
    })

    describe('with fields and annotation values', () => {
      const body = `
        settings salesforce.path_assistant_settings {
          metadataType = "PathAssistantSettings"
          string full_name {
            _required = false
          }
          boolean path_assistant_enabled {
            _required = false
          }
        }
      `
      let settings: ObjectType

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
        settings = elements[0] as ObjectType
      })

      it('should have annotation values', () => {
        expect(settings.annotations.metadataType).toEqual('PathAssistantSettings')
      })

      it('should contain all elements in source map', validateSourceMap)

      it('should have no errors', checkNoErrors)

      describe('string field', () => {
        it('should exist', () => {
          expect(settings.fields).toHaveProperty('full_name')
        })

        it('should have the correct type', () => {
          expect(settings.fields.full_name.refType.elemID).toEqual(BuiltinTypes.STRING.elemID)
        })

        it('should have annotation values', () => {
          // eslint-disable-next-line no-underscore-dangle
          expect(settings.fields.full_name.annotations._required).toBe(false)
        })
      })

      describe('boolean field', () => {
        it('should exist', () => {
          expect(settings.fields).toHaveProperty('path_assistant_enabled')
        })

        it('should have the correct type', () => {
          expect(settings.fields.path_assistant_enabled.refType.elemID).toEqual(BuiltinTypes.BOOLEAN.elemID)
        })

        it('should have annotation values', () => {
          // eslint-disable-next-line no-underscore-dangle
          expect(settings.fields.path_assistant_enabled.annotations._required).toBe(false)
        })
      })
    })
  })

  describe('with an instance', () => {
    describe('with simple definition', () => {
      const body = `
      salesforce.test inst {
        _depends_on = "fake1"
        name = "me"
      }
    `
      let instance: InstanceElement

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
        instance = elements[0] as InstanceElement
      })

      it('should be an instance', () => {
        expect(isInstanceElement(instance)).toBe(true)
      })

      it('should have the right id', () => {
        expect(instance.elemID).toEqual(new ElemID('salesforce', 'test', 'instance', 'inst'))
      })

      it('should have the right type', () => {
        expect(instance.refType.elemID).toEqual(new ElemID('salesforce', 'test'))
      })

      it('should have values', () => {
        expect(instance.value).toHaveProperty('name')
        expect(instance.value.name).toEqual('me')
      })

      it('should have annotations', () => {
        expect(instance.annotations).toHaveProperty('_depends_on')
        // eslint-disable-next-line no-underscore-dangle
        expect(instance.annotations._depends_on).toEqual('fake1')
      })

      it('should contain all elements in source map', validateSourceMap)

      it('should have no errors', checkNoErrors)
    })

    describe('labels', () => {
      describe('with a name that starts with boolean', () => {
        const body = `
          salesforce.someType false_string {}
        `

        beforeEach(async () => {
          ;({ elements, sourceMap, errors } = await parseBody(body))
        })

        it('should parse', () => {
          const instance = elements[0] as InstanceElement
          expect(instance.elemID).toEqual(new ElemID('salesforce', 'someType', 'instance', 'false_string'))
        })

        it('should contain all elements in source map', validateSourceMap)

        it('should have no errors', checkNoErrors)
      })

      describe('with an invalid ID type', () => {
        const body = `
          salesforce.someType.a false_string {}
        `

        beforeEach(async () => {
          ;({ elements, sourceMap, errors } = await parseBody(body))
        })

        it('should have an error', () => {
          expect(errors).toHaveLength(1)
          expect(errors[0].summary).toEqual('Invalid type name')
          expect(elements).toHaveLength(0)
        })
      })

      describe('with extra labels', () => {
        const body = `
          salesforce.test inst with extra labels {
          }
        `

        beforeEach(async () => {
          ;({ elements, sourceMap, errors } = await parseBody(body))
        })

        it('should have an error', () => {
          expect(errors).toHaveLength(1)
          expect(errors[0].summary).toEqual('Invalid instance definition')
          expect(elements).toHaveLength(0)
        })
      })
    })
  })

  describe('with a config instance', () => {
    const body = `
      salesforce {
        username = "foo"
      }
    `
    const configTypeID = new ElemID('salesforce')
    let config: InstanceElement

    beforeEach(async () => {
      ;({ elements, sourceMap, errors } = await parseBody(body))
      config = elements[0] as InstanceElement
    })

    it('should have the correct ID', () => {
      expect(config.elemID).toEqual(configTypeID.createNestedID('instance', ElemID.CONFIG_NAME))
    })

    it('should have the correct type ID', () => {
      expect(config.refType.elemID).toEqual(configTypeID)
    })

    it('should have values', () => {
      expect(config.value).toHaveProperty('username')
      expect(config.value.username).toEqual('foo')
    })

    it('should contain all elements in source map', validateSourceMap)

    it('should have no errors', () => {
      expect(errors).toHaveLength(0)
    })
  })

  describe('with a settings instance', () => {
    const body = `
      salesforce.path_assistant_settings {
        full_name              = "PathAssistant"
        path_assistant_enabled = false
      }
    `
    const settingsTypeID = new ElemID('salesforce', 'path_assistant_settings')
    let settingsInstance: InstanceElement

    beforeEach(async () => {
      ;({ elements, sourceMap, errors } = await parseBody(body))
      settingsInstance = elements[0] as InstanceElement
    })

    it('should have the correct ID', () => {
      expect(settingsInstance.elemID).toEqual(settingsTypeID.createNestedID('instance', ElemID.CONFIG_NAME))
    })

    it('should have the correct type ID', () => {
      expect(settingsInstance.refType.elemID).toEqual(settingsTypeID)
    })

    it('should have values', () => {
      expect(settingsInstance.value).toHaveProperty('full_name')
      expect(settingsInstance.value.full_name).toEqual('PathAssistant')

      expect(settingsInstance.value).toHaveProperty('path_assistant_enabled')
      expect(settingsInstance.value.path_assistant_enabled).toBe(false)
    })

    it('should contain all elements in source map', validateSourceMap)

    it('should have no errors', () => {
      expect(errors).toHaveLength(0)
    })
  })

  describe('with element updates', () => {
    const body = `
      type salesforce.type {
        salesforce.number num {}
      }

      type salesforce.type {
        update num {
          label = "Name"
          _required = true
        }
      }
    `
    let original: ObjectType
    let update: ObjectType

    beforeEach(async () => {
      ;({ elements, sourceMap, errors } = await parseBody(body))
      original = elements[0] as ObjectType
      update = elements[1] as ObjectType
    })

    it('should parse update fields', async () => {
      expect(original.elemID).toEqual(update.elemID)
      expect(update.fields.num.refType.elemID.name).toBe('update')
    })

    it('should have all source map definitions for a fields', () => {
      const updatedField = Object.values(update.fields)[0]
      const fieldSource = sourceMap.get(updatedField.elemID.getFullName())
      expect(fieldSource).toHaveLength(2)
    })

    it('should contain all elements in source map', validateSourceMap)

    it('should have no errors', () => {
      expect(errors).toHaveLength(0)
    })
  })

  describe('with function calls', () => {
    const body = `
      adapter_id.some_asset {
        content                                 = myFunc("some.png")
        contentWithNumber                       = myFunc(1)
        contentWithBoolean                      = myFunc(true)
        contentWithList                         = myFunc(["yes", "dad", true])
        contentWithSeveralParams                = myFunc(false, 3, "WAT")
        contentWithMixed                        = myFunc(false, [3, 3], "WAT")
        contentWithNested                       = myFunc(false, [3, [
          1,
          2
        ]], "WAT")
        contentWithMultilineArraysAndParameters = myFunc("regular", [
          "aa",
          2,
          false
        ], 321)
        contentWithNestedFunction               = {
          nested                                = myFunc("yeah")
        }
      }
    `
    let instanceWithFunctions: InstanceElement

    beforeEach(async () => {
      ;({ elements, sourceMap, errors } = await parseBody(body))
      instanceWithFunctions = elements[0] as InstanceElement
    })

    it('should contain all elements in source map', validateSourceMap)

    it('should have no errors', () => {
      expect(errors).toHaveLength(0)
    })

    describe('when parameter', () => {
      it('is a number', () => {
        expect(instanceWithFunctions.value.contentWithNumber).toHaveProperty('funcName', funcName)
        expect(instanceWithFunctions.value.contentWithNumber).toHaveProperty('parameters', [1])
      })

      it('is a string', () => {
        expect(instanceWithFunctions.value.content).toHaveProperty('funcName', funcName)
        expect(instanceWithFunctions.value.content).toHaveProperty('parameters', ['some.png'])
      })

      it('is a boolean', () => {
        expect(instanceWithFunctions.value.contentWithBoolean).toHaveProperty('funcName', funcName)
        expect(instanceWithFunctions.value.contentWithBoolean).toHaveProperty('parameters', [true])
      })

      it('is a list', () => {
        expect(instanceWithFunctions.value.contentWithList).toHaveProperty('funcName', funcName)
        expect(instanceWithFunctions.value.contentWithList).toHaveProperty('parameters', [['yes', 'dad', true]])
      })

      it('is a several parameters', () => {
        expect(instanceWithFunctions.value.contentWithSeveralParams).toHaveProperty('funcName', funcName)
        expect(instanceWithFunctions.value.contentWithSeveralParams).toHaveProperty('parameters', [false, 3, 'WAT'])
      })

      it('is mixed', () => {
        expect(instanceWithFunctions.value.contentWithMixed).toHaveProperty('funcName', funcName)
        expect(instanceWithFunctions.value.contentWithMixed.parameters).toEqual([false, [3, 3], 'WAT'])
      })

      it('is nested', () => {
        expect(instanceWithFunctions.value.contentWithNested).toHaveProperty('funcName', funcName)
        expect(instanceWithFunctions.value.contentWithNested).toHaveProperty('parameters', [false, [3, [1, 2]], 'WAT'])
      })

      it('is multiline', () => {
        expect(instanceWithFunctions.value.contentWithMultilineArraysAndParameters).toHaveProperty('funcName', funcName)
        expect(instanceWithFunctions.value.contentWithMultilineArraysAndParameters).toHaveProperty('parameters', [
          'regular',
          ['aa', 2, false],
          321,
        ])
      })
    })

    describe('when the call is nested in an object', () => {
      it('should receive the parameters', () => {
        expect(instanceWithFunctions.value.contentWithNestedFunction).toHaveProperty('nested')
        const func = instanceWithFunctions.value.contentWithNestedFunction.nested
        expect(func).toHaveProperty('parameters')
        expect(func.parameters).toEqual(['yeah'])
      })
    })
  })

  describe('with variables', () => {
    const body = `
      vars {
        name = 7
        name2 = "some string"
      }
    `

    beforeEach(async () => {
      ;({ elements, sourceMap, errors } = await parseBody(body))
    })

    it('should have the correct values', () => {
      const [variable1, variable2] = elements as Variable[]

      expect(isVariable(variable1)).toBe(true)
      expect(isVariable(variable2)).toBe(true)

      expect(variable1.elemID).toEqual(new ElemID('var', 'name', 'var'))
      expect(variable2.elemID).toEqual(new ElemID('var', 'name2', 'var'))

      expect(variable1.value).toBe(7)
      expect(variable2.value).toBe('some string')
    })

    it('should contain all elements in source map', validateSourceMap)

    it('should have no errors', () => {
      expect(errors).toHaveLength(0)
    })
  })

  describe('with special string values', () => {
    describe('with multiline values', () => {
      const body = `
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
      `
      let multilineObject: ObjectType

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
        multilineObject = elements[0] as ObjectType
      })

      it('should have a multiline string field', () => {
        expect(multilineObject.annotations).toHaveProperty('data')
        expect(multilineObject.annotations.data).toEqual('          This\n          is\n          Multiline')
      })

      it('should preserve end of line spaces without inserting a newline', () => {
        expect(multilineObject.annotations).toHaveProperty('withSpaces')
        expect(multilineObject.annotations.withSpaces).toEqual('          Give me some \n          OK?')
      })

      it('should preserve end of line spaces on new line', () => {
        expect(multilineObject.annotations).toHaveProperty('withTrailingNewline')
        expect(multilineObject.annotations.withTrailingNewline).toEqual(
          '          This has \n          a trailing line with spaces\n  ',
        )
      })

      it('should handle quotation marks inside the multiline string', () => {
        expect(multilineObject.annotations).toHaveProperty('withQuotes')
        expect(multilineObject.annotations.withQuotes).toEqual('            "I can see Russia from my house!"')
      })

      it('should contain all elements in source map', validateSourceMap)

      it('should have no errors', checkNoErrors)
    })

    describe('with an empty string', () => {
      const body = `
        type salesforce.emptyString {
          str = ""
        }
      `

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
      })

      it('should parse', () => {
        expect(elements[0].annotations.str).toEqual('')
      })

      it('should contain all elements in source map', validateSourceMap)

      it('should have no errors', checkNoErrors)
    })

    describe('with escaped quotes', () => {
      const body = `
        type salesforce.escapedQuotes {
          str = "Is this \\"escaped\\"?"
        }
      `

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
      })

      it('should parse', () => {
        expect(elements[0].annotations.str).toEqual('Is this "escaped"?')
      })

      it('should contain all elements in source map', validateSourceMap)

      it('should have no errors', checkNoErrors)
    })

    describe('with double escaped quotes', () => {
      const body = `
        type salesforce.escapedDashBeforeQuote {
          str = "you can't run away \\\\"
        }
      `

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
      })

      it('should parse', () => {
        expect(elements[0].annotations.str).toEqual("you can't run away \\")
      })

      it('should contain all elements in source map', validateSourceMap)

      it('should have no errors', checkNoErrors)
    })

    describe('with a unicode string', () => {
      const body = `
        type salesforce.unicode {
          unicodeStr = "this is \\u0061 basic thing"
        }
      `

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
      })

      it('should parse', () => {
        expect(elements[0].annotations.unicodeStr).toEqual('this is a basic thing')
      })

      it('should contain all elements in source map', validateSourceMap)

      it('should have no errors', checkNoErrors)
    })

    describe('with a long string', () => {
      const stringLength = 8498737
      const body = `
        type salesforce.longString {
          str = "${'a'.repeat(stringLength)}"
        }
      `

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
      })

      it('should parse', () => {
        expect(elements[0].annotations.str.length).toEqual(stringLength)
      })

      it('should contain all elements in source map', validateSourceMap)

      it('should have no errors', checkNoErrors)
    })

    describe('with a multiline string with a U+200D unicode before a \\n', () => {
      // we have this test as this unicode character joins characters together. in our case, the problem is when this
      // joiner is the last character in the string - because we add a \n before the closing ''', parsing that unicode
      // character “correctly” means joining the \n with whatever came before the \u+200D, which makes it not a \n anymore
      // This test makes sure that we parse it correctly.
      const body = `
        type salesforce.multilineUnicode {
          str = '''

            this is a unicode test ‍
          '''
        }
      `

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
      })

      it('should parse', () => {
        expect(elements[0].annotations.str).toEqual('\n            this is a unicode test ‍')
      })

      it('should contain all elements in source map', validateSourceMap)

      it('should have no errors', checkNoErrors)
    })
  })

  describe('with string attribute keys', () => {
    const body = `
      type salesforce.stringAttr {
        "#strAttr" = "attr"
      }
    `

    beforeEach(async () => {
      ;({ elements, sourceMap, errors } = await parseBody(body))
    })

    it('should parse', () => {
      const stringAttrObject = elements[0]
      expect(stringAttrObject.annotations['#strAttr']).toEqual('attr')
    })

    it('should contain all elements in source map', validateSourceMap)

    it('should have no errors', () => {
      expect(errors).toHaveLength(0)
    })
  })

  describe('with references', () => {
    const body = `
      type salesforce.references {
        toVar = var.name3
        toVal = salesforce.test.instance.inst.name
      }       
    `
    let refObj: ObjectType

    beforeEach(async () => {
      ;({ elements, sourceMap, errors } = await parseBody(body))
      refObj = elements[0] as ObjectType
    })

    it('should parse references to values as ReferenceExpressions', () => {
      expect(refObj.annotations.toVal).toBeInstanceOf(ReferenceExpression)
    })

    it('should parse references to variables as VariableExpressions', () => {
      expect(refObj.annotations.toVar).toBeInstanceOf(VariableExpression)
    })

    it('should contain all elements in source map', validateSourceMap)

    it('should have no errors', () => {
      expect(errors).toHaveLength(0)
    })
  })

  describe('with templates', () => {
    describe('with a simple value', () => {
      const body = `
        type salesforce.templates {
          tmpl = "hello {{$\{temp.la@te.instance.stuff@us}}}"
        }
      `

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
      })

      it('should parse references to template as TemplateExpression', () => {
        const refObj = elements[0] as ObjectType
        expect(refObj.annotations.tmpl).toBeInstanceOf(TemplateExpression)
        expect(refObj.annotations.tmpl.parts).toEqual([
          'hello {{',
          expect.objectContaining({
            elemID: new ElemID('temp', 'la@te', 'instance', 'stuff@us'),
          }),
          '}}',
        ])
      })

      it('should contain all elements in source map', validateSourceMap)

      it('should have no errors', checkNoErrors)
    })

    describe('with a multiline template value', () => {
      const body = `
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
      `
      let multilineRefObj: ObjectType

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
        multilineRefObj = elements[0] as ObjectType
      })

      it('should parse references to template as TemplateExpression', () => {
        expect(multilineRefObj.annotations.tmpl).toBeInstanceOf(TemplateExpression)
        expect(multilineRefObj.annotations.tmpl.parts).toEqual([
          'multiline\ntemplate {{',
          expect.objectContaining({
            elemID: new ElemID('te@mp', 'late', 'instance', 'multiline_stuff@us'),
          }),
          '}}\nvalue',
        ])
      })

      it('should parse references that exist on the same line as an escaped template marker as TemplateExpression', () => {
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

      it('should contain all elements in source map', validateSourceMap)

      it('should have no errors', checkNoErrors)
    })

    describe('with an escaped template value', () => {
      const body = `
        type salesforce.escaped_templates {
          tmpl = ">>>\\\${a.b}<<<"
        }
      `

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
      })

      it('should parse references to template as TemplateExpression', () => {
        const escapedTemplateObj = elements[0] as ObjectType
        // eslint-disable-next-line no-template-curly-in-string
        expect(escapedTemplateObj.annotations.tmpl).toEqual('>>>${a.b}<<<')
      })

      it('should contain all elements in source map', validateSourceMap)

      it('should have no errors', checkNoErrors)
    })
  })

  describe('with comments', () => {
    const body = `
      // Comment at top of file.
      type salesforce.boolean is boolean {
      }
      // comment between top level blocks
      type salesforce.test {
        // comments inside a block with invalid ending characters ?
        salesforce.string name { // comment after block def line end with question mark?
          // comment inside a field
          label = "Name"
          _required = true //comment after attribute
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
    `

    beforeEach(async () => {
      ;({ elements, sourceMap, errors } = await parseBody(body))
    })

    it('should parse all elements', () => {
      expect(elements).toHaveLength(2)
    })

    it('should contain all elements in source map', validateSourceMap)

    it('should have no errors', checkNoErrors)
  })

  describe('when calcSourceMap is false', () => {
    const body = `
        type salesforce.string is string {
        }
    `
    let maybeSourceMap: SourceMap | undefined

    beforeEach(async () => {
      const parsed = await parse(Buffer.from(body), 'none', functions, false)
      elements = await awu(parsed.elements).toArray()
      maybeSourceMap = parsed.sourceMap
      errors = parsed.errors
    })

    it('should not return a source map', () => {
      expect(maybeSourceMap).toBeUndefined()
    })

    it('should have no errors', checkNoErrors)
  })

  describe('with invalid top level syntax', () => {
    const body = 'bla'

    beforeEach(async () => {
      ;({ elements, sourceMap, errors } = await parseBody(body))
    })

    it('should have an error', () => {
      expect(errors).toHaveLength(1)
    })
  })

  describe('with unicode line terminators', () => {
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
    let element: InstanceElement

    beforeEach(async () => {
      ;({ elements, sourceMap, errors } = await parseBody(body))
      element = elements[0] as InstanceElement
    })

    it('should contain all elements in source map', validateSourceMap)

    it('should have no errors', checkNoErrors)

    describe('multiline strings', () => {
      it('should parse unicode line separators', () => {
        expect(element.annotations.multi).toContain('end with unicode line separator')
      })

      it('should parse unicode paragraph separators', () => {
        expect(element.annotations.multi).toContain('end with unicode paragraph separator')
      })
    })

    describe('single line strings', () => {
      it('should parse unicode line separators', () => {
        expect(element.annotations.single).toContain('end single with unicode')
      })

      it('should support unicode newlines inside the string', () => {
        expect(element.annotations.terminatorInString).toEqual('have \u2029 in the string')
      })
    })
  })

  describe('with syntax errors', () => {
    describe('with invalid syntax', () => {
      const body = `
        salto {
          test: "Test"
        }
      `

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
      })

      it('should have an error', () => {
        expect(errors).toHaveLength(1)
        expect(errors[0].summary).toEqual('Invalid block item')
      })
    })

    describe('with a missing list opening bracket in an object', () => {
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

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
      })

      it('should have errors', () => {
        expect(errors).toHaveLength(4)
        errors.forEach(error => expect(error.summary).toEqual('Invalid block item'))
      })
    })

    describe('with a missing list opening bracket in an object item', () => {
      const body = `
        salto {
          a = {
              "abc"
            ]
          }
        }
      `

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
      })

      it('should have errors', () => {
        expect(errors).toHaveLength(2)
        expect(errors[0].summary).toEqual('Invalid attribute definition')
        expect(errors[1].summary).toEqual('Invalid attribute key')
      })
    })

    describe('with unexpected parsing failures', () => {
      const body = `
        adapter_id.some_asset {
          content = myFunc("some.png")
      `

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

    describe('with an object item with an unexpected EOF', () => {
      const body = `
        salto {
          a = {
            {
      `

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
      })

      it('should have errors', () => {
        expect(errors).toHaveLength(2)
        errors.forEach(error => expect(error.summary).toEqual('Invalid attribute key'))
      })
    })

    describe('with an invalid character', () => {
      const body = `
        salesforce.Type inst {
          val = 'aaa"
        }
      `

      beforeEach(async () => {
        ;({ elements, sourceMap, errors } = await parseBody(body))
      })

      it('should have errors', () => {
        expect(errors).toHaveLength(1)
        expect(errors[0].summary).toEqual('Invalid string character')
      })
    })
  })

  describe('tokenizeContent', () => {
    it('should separate and token each part of a line correctly', () => {
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
