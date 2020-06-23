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
  ObjectType, PrimitiveType, PrimitiveTypes, ElemID, TypeElement, InstanceElement,
  BuiltinTypes, INSTANCE_ANNOTATIONS, ListType, ReferenceExpression,
} from '@salto-io/adapter-api'
import * as TestHelpers from '../common/helpers'
import { parse } from '../../src/parser'
import {
  dumpAnnotationTypes, dumpElements, dumpSingleAnnotationType, dumpValues,
} from '../../src/parser/dump'
import {
  Functions,
} from '../../src/parser/functions'
import {
  registerTestFunction,
  TestFuncImpl,
} from './functions.test'

const funcName = 'ZOMG'
let functions: Functions

describe('Salto Dump', () => {
  beforeAll(() => {
    functions = registerTestFunction(funcName)
  })

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
    annotationTypes: {
      alice: BuiltinTypes.NUMBER,
      bob: BuiltinTypes.NUMBER,
      tom: BuiltinTypes.BOOLEAN,
      jerry: BuiltinTypes.STRING,
    },
  })

  const model = new ObjectType({
    elemID: new ElemID('salesforce', 'test'),
    fields: {
      name: { type: strType, annotations: { label: 'Name' } },
      num: { type: numType },
      list: { type: new ListType(strType) },
      field: {
        type: fieldType,
        annotations: {
          alice: 1,
          bob: 2,
          tom: true,
          jerry: 'mouse',
        },
      },
    },
    annotationTypes: {
      ServiceId: BuiltinTypes.SERVICE_ID,
    },
  })

  model.annotate({
    LeadConvertSettings: {
      account: [
        {
          input: 'bla',
          output: 'foo',
        },
      ],
    },
    // eslint-disable-next-line no-template-curly-in-string
    multiLineString: 'This\nis\nmultilinestring\n${foo} needs Escaping',
    // eslint-disable-next-line no-template-curly-in-string
    stringNeedsEscaping: 'This string ${needs} escaping',
  })

  const instance = new InstanceElement(
    'me',
    model,
    { name: 'me', num: 7 },
    undefined,
    { [INSTANCE_ANNOTATIONS.DEPENDS_ON]: 'test' },
  )

  const config = new InstanceElement(
    ElemID.CONFIG_NAME,
    new ObjectType({ elemID: new ElemID('salesforce') }),
    { name: 'other', num: 5 },
  )

  const instanceStartsWithNumber = new InstanceElement(
    '3me',
    model,
    { name: '3me', num: 7 },
  )

  const instanceWithFunctions = new InstanceElement(
    'functions',
    model,
    {
      func2: new TestFuncImpl(funcName, ['aaa']),
      inarr: [1, 2, 3, 4, new TestFuncImpl(funcName, ['bbb'])],
      nested: {
        before: 'something',
        func3: new TestFuncImpl(funcName, ['well', [1, 2, [false, 'soo']]]),
        deeper: {
          befdep: 321,
          func4: new TestFuncImpl(funcName, ['lanternfish']),
        },
        after: 'else',
      },
    }
  )

  const instanceWithArray = new InstanceElement(
    'arr_inst',
    model,
    {
      arr: [
        'only',
        1,
        true,
        { priate: 'can say' },
        [],
        new ReferenceExpression(new ElemID('salto', 'ref')),
        'Hello I am multiline\nstring.',
        new TestFuncImpl(funcName, ['foo']),
      ],
    }
  )

  describe('dump elements', () => {
    let body: string

    beforeAll(async () => {
      body = await dumpElements([
        strType, numType, boolType,
        fieldType, model, instance, config,
        instanceStartsWithNumber, instanceWithFunctions, instanceWithArray,
      ], functions)
    })

    it('dumps primitive types', () => {
      expect(body).toMatch(/type salesforce.string is string {/)
      expect(body).toMatch(/type salesforce.number is number {/)
      expect(body).toMatch(/type salesforce.bool is boolean {/)
    })

    it('dumps primitive field type annotations', () => {
      expect(body).toMatch(/type salesforce.field is number {.*?annotations {.*?number alice {/s)
      expect(body).toMatch(/type salesforce.field is number {.*?annotations {.*?number bob {/s)
      expect(body).toMatch(/type salesforce.field is number {.*?annotations {.*?boolean tom {/s)
      expect(body).toMatch(/type salesforce.field is number {.*?annotations {.*?string jerry {/s)
    })

    describe('dumps functions', () => {
      it('custom function', () => {
        expect(body).toMatch(/func2\s=\sZOMG\("aaa"\)/)
      })
      it('in array', () => {
        expect(body).toMatch(/ZOMG\("bbb"\)/)
      })
      it('deep as duck', () => {
        expect(body).toMatch(/func4\s=\sZOMG\("lanternfish"\)/)
      })
    })

    describe('dumped instance elements', () => {
      it('has instance block', () => {
        expect(body).toMatch(/salesforce.test me {/)
      })
      it('has annotation values', () => {
        expect(body).toMatch(new RegExp(`${INSTANCE_ANNOTATIONS.DEPENDS_ON}\\s+=\\s+"test"`))
      })
    })

    it('dumps config elements', () => {
      expect(body).toMatch(/salesforce.test {/)
    })

    describe('dumped model', () => {
      it('has correct block type and label', () => {
        expect(body).toMatch(/type salesforce.test {/)
      })
      it('has annotations block', () => {
        expect(body).toMatch(/annotations {/)
        expect(body).toMatch(/serviceid ServiceId {/)
      })
      it('has complex attributes', () => {
        expect(body).toMatch(
          /LeadConvertSettings = {\s*account = \[\s*{\s*input\s*=\s*"bla"\s*output\s*=\s*"foo"*\s*},*\s*\],*\s*}/m,
        )
      })
      it('has multiline string', () => {
        expect(body).toMatch(
          /multiLineString = '''\n\s*This\s*\nis\s*\nmultilinestring\s*\n\s*\\\$\{foo\} needs Escaping\s*\n'''/m,
        )
      })
      it('Has escaped string', () => {
        expect(body).toMatch(
          /stringNeedsEscaping = "This string \\\$\{needs\} escaping"/m,
        )
      })
      it('has fields', () => {
        expect(body).toMatch(
          /salesforce.string name {\s+label = "Name"\s+}/m,
        )
        expect(body).toMatch(
          /salesforce.number num {/m,
        )
        expect(body).toMatch(
          /"List<salesforce.string>" list {/m
        )
      })
    })

    describe('indentation', () => {
      it('should indent attributes', () => {
        expect(body).toMatch(
          /LeadConvertSettings = {\s*\n {4}account = \[\s*\n {6}{\s*\n {8}input/m,
        )
      })
      it('shoud indent annotation blocks', () => {
        expect(body).toMatch(/type salesforce.field is number {.*?\n {2}annotations/s)
      })
      it('should indent field type annontations', () => {
        expect(body).toMatch(/type salesforce.field is number {.*?annotations {.*?\n {4}string jerry {/s)
      })
      it('should indent type annontations', () => {
        expect(body).toMatch(/type salesforce.test {.*?\n {2}annotations/s)
      })
      it('should indent primitive types', () => {
        expect(body).toMatch(/^type salesforce.string/m)
      })
      it('should indent instances', () => {
        expect(body).toMatch(/^salesforce.test functions/m)
      })
      it('should indent model types', () => {
        expect(body).toMatch(/^type salesforce.test/m)
      })
      it('should indent fields', () => {
        expect(body).toMatch(/\n {2}salesforce.string name/m)
      })
      it('should indent all types in array', () => {
        // number
        expect(body).toMatch(/arr.*?=.*?\[.*?\n {4}1/ms)
        // string
        expect(body).toMatch(/arr.*?=.*?\[.*?\n {4}"only"/ms)
        // boolean
        expect(body).toMatch(/arr.*?=.*?\[.*?\n {4}true/ms)
        // object
        expect(body).toMatch(/arr.*?=.*?\[.*?\n {4}{/ms)
        // array
        expect(body).toMatch(/arr.*?=.*?\[.*?\n'''/ms)
        // reference
        expect(body).toMatch(/arr.*?=.*?\[.*?\n {4}salto\.ref/ms)
        // multilinestring
        expect(body).toMatch(/arr.*?=.*?\[.*?\n {4}'''/ms)
        expect(body).toMatch(/arr.*?=.*?\[.*?\nHello/ms)
        expect(body).toMatch(/arr.*?=.*?\[.*?\nstring/ms)
        expect(body).toMatch(/arr.*?=.*?\[.*?\n'''/ms)
        // function
        expect(body).toMatch(/arr.*?=.*?\[.*?\n {4}ZOMG/ms)
      })
    })
    it('dumped instance with name that starts with number', () => {
      expect(body).toMatch(/salesforce.test "3me"/)
    })
    it('can be parsed back', async () => {
      const result = await parse(Buffer.from(body), 'none', functions)
      const { elements, errors } = result
      expect(errors).toHaveLength(0)
      expect(elements).toHaveLength(11)
      expect(elements[0]).toEqual(strType)
      expect(elements[1]).toEqual(numType)
      expect(elements[2]).toEqual(boolType)
      TestHelpers.expectTypesToMatch(elements[3] as TypeElement, fieldType)
      TestHelpers.expectTypesToMatch(elements[4] as TypeElement, model)
      TestHelpers.expectTypesToMatch(elements[5] as ListType, model.fields.list.type)
      TestHelpers.expectInstancesToMatch(elements[6] as InstanceElement, instance)
      TestHelpers.expectInstancesToMatch(elements[7] as InstanceElement, config)
      TestHelpers.expectInstancesToMatch(elements[8] as InstanceElement, instanceStartsWithNumber)
      TestHelpers.expectInstancesToMatch(elements[9] as InstanceElement, instanceWithFunctions)
    })
  })
  describe('dump field', () => {
    let body: string

    beforeAll(async () => {
      body = await dumpElements([model.fields.name], functions)
    })

    it('should contain only field', () => {
      expect(body).toMatch(/^salesforce.string name {\s+label = "Name"\s+}$/m)
    })
  })

  describe('dump function', () => {
    it('should dump custom function a single parameter', async () => {
      const body = await dumpValues({ attrush: new TestFuncImpl(funcName, [false]) }, functions)

      expect(body).toMatch(/attrush = ZOMG\(false\)/)
    })
    it('should dump custom function that is nested', async () => {
      const body = await dumpValues({ nestalicous: { nestFunc: new TestFuncImpl(funcName, ['yes']) } }, functions)

      expect(body).toMatch(/nestFunc = ZOMG\("yes"\)/)
    })
    it('should dump custom function that is nested with other properties', async () => {
      const body = await dumpValues({
        nestalicous: {
          ss: 321,
          nestFunc: new TestFuncImpl(funcName, ['yes']),
          cc: 321,
        },
        bb: 123,
        nestFunc2: new TestFuncImpl(funcName, ['maybe']),
        deep: {
          very: {
            nestFunc3: new TestFuncImpl(funcName, ['definitely']),
          },
        },
      }, functions)

      expect(body).toEqual(`nestalicous = {
  ss = 321
  nestFunc = ZOMG("yes")
  cc = 321
}
bb = 123
nestFunc2 = ZOMG("maybe")
deep = {
  very = {
    nestFunc3 = ZOMG("definitely")
  }
}
`)
    })
  })
  describe('dump attribute', () => {
    let body: string

    beforeAll(async () => {
      body = await dumpValues({ attr: 'value' }, functions)
    })

    it('should contain only attribute', () => {
      expect(body).toMatch(/^attr\s+=\s+"value"$/m)
    })
  })
  describe('dump annotations', () => {
    describe('single annotation type', () => {
      let body: string

      beforeAll(() => {
        body = dumpSingleAnnotationType('ServiceId', BuiltinTypes.SERVICE_ID)
      })

      it('should contain only the annotation type definition', () => {
        expect(body).toMatch(/^serviceid ServiceId {\s}\s$/gm)
      })
    })
    describe('annotations block', () => {
      let body: string

      beforeAll(() => {
        body = dumpAnnotationTypes({ ServiceId: BuiltinTypes.SERVICE_ID })
      })

      it('should contain only the annotations block definition', () => {
        expect(body).toMatch(/^annotations {\s*serviceid ServiceId {\s*}\s}\s/gm)
      })
    })
  })
  describe('dump primitive', () => {
    it('should serialize numbers', async () => {
      expect(await dumpValues(123, functions)).toEqual('123')
    })
    it('should serialize strings', async () => {
      expect(await dumpValues('aaa', functions)).toEqual('"aaa"')
    })
    it('should serialize booleans', async () => {
      expect(await dumpValues(false, functions)).toEqual('false')
    })
    it('should dump list', async () => {
      expect(await dumpValues([1, 'asd', true, { complex: 'value' }], functions)).toMatch(
        /\[\s+1,\s+"asd",\s+true,\s+\{\s+complex = "value"\s+\}\s+]/s
      )
    })
  })
})
