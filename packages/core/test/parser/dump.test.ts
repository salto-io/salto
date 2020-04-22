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
  Field, BuiltinTypes, INSTANCE_ANNOTATIONS, ListType,
} from '@salto-io/adapter-api'
import * as TestHelpers from '../common/helpers'
import { parse } from '../../src/parser/parse'
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
import { StaticFileNaclValue } from '../../src/workspace/static_files/common'

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
    annotationTypes: {
      ServiceId: BuiltinTypes.SERVICE_ID,
    },
  })
  model.fields.name = new Field(model.elemID, 'name', strType, { label: 'Name' })
  model.fields.num = new Field(model.elemID, 'num', numType)
  model.fields.list = new Field(model.elemID, 'list', new ListType(strType), {})
  model.fields.field = new Field(model.elemID, 'field', fieldType, {
    alice: 1,
    bob: 2,
    tom: true,
    jerry: 'mouse',
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
    multiLineString: 'This\nis\nmultilinestring',
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
      func1: new StaticFileNaclValue('some/path.ext'),
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

  describe('dump elements', () => {
    let body: string

    beforeAll(() => {
      body = dumpElements([
        strType, numType, boolType,
        fieldType, model, instance, config,
        instanceStartsWithNumber, instanceWithFunctions,
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
      it('static file', () => {
        expect(body).toMatch(/func1\s=\sfile\("some\/path.ext"\)/)
      })
      it('custom function', () => {
        expect(body).toMatch(/func2\s=\sZOMG\("aaa"\)/)
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
          /multiLineString = '''\n\s*This\s*\nis\s*\nmultilinestring\s*\n'''/,
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
    it('dumped instance with name that starts with number', () => {
      expect(body).toMatch(/salesforce.test "3me"/)
    })

    it('can be parsed back', () => {
      const { elements, errors } = parse(Buffer.from(body), 'none', functions)
      expect(errors).toHaveLength(0)
      expect(elements).toHaveLength(10)
      expect(elements[0]).toEqual(strType)
      expect(elements[1]).toEqual(numType)
      expect(elements[2]).toEqual(boolType)
      TestHelpers.expectTypesToMatch(elements[3] as TypeElement, fieldType)
      TestHelpers.expectTypesToMatch(elements[4] as TypeElement, model)
      TestHelpers.expectInstancesToMatch(elements[5] as InstanceElement, instance)
      TestHelpers.expectInstancesToMatch(elements[6] as InstanceElement, config)
      TestHelpers.expectInstancesToMatch(elements[7] as InstanceElement, instanceStartsWithNumber)
      TestHelpers.expectInstancesToMatch(elements[8] as InstanceElement, instanceWithFunctions)
      TestHelpers.expectTypesToMatch(elements[9] as ListType, model.fields.list.type)
    })
  })
  describe('dump field', () => {
    let body: string

    beforeAll(() => {
      body = dumpElements([model.fields.name])
    })

    it('should contain only field', () => {
      expect(body).toMatch(/^salesforce.string name {\s+label = "Name"\s+}$/m)
    })
  })

  describe('dump function', () => {
    it('static file', () => {
      const body = dumpValues({ asset: new StaticFileNaclValue('some/path.ext') })

      expect(body).toMatch(/^asset\s+=\s+file\("some\/path.ext"\)$/m)
    })

    it('should dump custom function a single parameter', () => {
      const body = dumpValues({ attrush: new TestFuncImpl(funcName, [false]) }, functions)

      expect(body).toMatch(/attrush = ZOMG\(false\)/)
    })
    it('should dump custom function that is nested', () => {
      const body = dumpValues({ nestalicous: { nestFunc: new TestFuncImpl(funcName, ['yes']) } }, functions)

      expect(body).toMatch(/nestFunc = ZOMG\("yes"\)/)
    })
    it('should dump custom function that is nested with other properties', () => {
      const body = dumpValues({
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

    beforeAll(() => {
      body = dumpValues({ attr: 'value' })
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
      expect(dumpValues(123)).toEqual('123')
    })
    it('should serialize strings', async () => {
      expect(dumpValues('aaa')).toEqual('"aaa"')
    })
    it('should serialize booleans', async () => {
      expect(dumpValues(false)).toEqual('false')
    })
    it('should dump list', async () => {
      expect(dumpValues([1, 'asd', true, { complex: 'value' }])).toMatch(
        /\[\s+1,\s+"asd",\s+true,\s+\{\s+complex = "value"\s+\}\s+]/s
      )
    })
  })
})
