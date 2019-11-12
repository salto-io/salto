import {
  ObjectType, PrimitiveType, PrimitiveTypes, ElemID, Type, InstanceElement,
  Field,
  BuiltinTypes,
} from 'adapter-api'
import * as TestHelpers from '../common/helpers'
import { parse } from '../../src/parser/parse'
import { dump } from '../../src/parser/dump'

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
  })
  model.fields.name = new Field(model.elemID, 'name', strType, { label: 'Name' })
  model.fields.num = new Field(model.elemID, 'num', numType)
  model.fields.list = new Field(model.elemID, 'list', strType, {}, true)
  model.fields.field = new Field(model.elemID, 'field', fieldType, {
    alice: 1,
    bob: 2,
    tom: true,
    jerry: 'mouse',
  })

  model.annotate({
    // eslint-disable-next-line @typescript-eslint/camelcase
    lead_convert_settings: {
      account: [
        {
          input: 'bla',
          output: 'foo',
        },
      ],
    },
  })

  const instance = new InstanceElement(
    'me',
    model,
    { name: 'me', num: 7 },
  )

  const config = new InstanceElement(
    ElemID.CONFIG_NAME,
    new ObjectType({ elemID: new ElemID('salesforce') }),
    { name: 'other', num: 5 },
  )

  describe('dump elements', () => {
    let body: string

    beforeAll(async () => {
      body = await dump([strType, numType, boolType, fieldType, model, instance, config])
    })

    it('dumps primitive types', () => {
      expect(body).toMatch(/type salesforce_string is string {/)
      expect(body).toMatch(/type salesforce_number is number {/)
      expect(body).toMatch(/type salesforce_bool is boolean {/)
    })

    it('dumps primitive field type annotations', () => {
      expect(body).toMatch(/type salesforce_field is number {.*?annotations {.*?number alice {/s)
      expect(body).toMatch(/type salesforce_field is number {.*?annotations {.*?number bob {/s)
      expect(body).toMatch(/type salesforce_field is number {.*?annotations {.*?boolean tom {/s)
      expect(body).toMatch(/type salesforce_field is number {.*?annotations {.*?string jerry {/s)
    })

    it('dumps instance elements', () => {
      expect(body).toMatch(/salesforce_test me {/)
    })

    it('dumps config elements', () => {
      expect(body).toMatch(/salesforce_test {/)
    })

    describe('dumped model', () => {
      it('has correct block type and label', () => {
        expect(body).toMatch(/type salesforce_test {/)
      })
      it('has complex attributes', () => {
        expect(body).toMatch(
          /lead_convert_settings = {\s*account = \[\s*{\s*input\s*=\s*"bla",\s*output\s*=\s*"foo"\s*}\s*\]\s*}/m,
        )
      })
      it('has fields', () => {
        expect(body).toMatch(
          /salesforce_string name {\s+label = "Name"\s+}/m,
        )
        expect(body).toMatch(
          /salesforce_number num {/m,
        )
        expect(body).toMatch(
          /list salesforce_string list {/m
        )
      })
      it('can be parsed back', async () => {
        const { elements, errors } = await parse(Buffer.from(body), 'none')
        expect(errors.length).toEqual(0)
        expect(elements.length).toEqual(7)
        expect(elements[0]).toEqual(strType)
        expect(elements[1]).toEqual(numType)
        expect(elements[2]).toEqual(boolType)
        TestHelpers.expectTypesToMatch(elements[3] as Type, fieldType)
        TestHelpers.expectTypesToMatch(elements[4] as Type, model)
        TestHelpers.expectInstancesToMatch(elements[5] as InstanceElement, instance)
        TestHelpers.expectInstancesToMatch(elements[6] as InstanceElement, config)
      })
    })
  })
  describe('dump field', () => {
    let body: string

    beforeAll(async () => {
      body = await dump(model.fields.name)
    })

    it('should contain only field', () => {
      expect(body).toMatch(/^salesforce_string name {\s+label = "Name"\s+}$/m)
    })
  })
  describe('dump attribute', () => {
    let body: string

    beforeAll(async () => {
      body = await dump({ attr: 'value' })
    })

    it('should contain only attribute', () => {
      expect(body).toMatch(/^attr\s+=\s+"value"$/m)
    })
  })
  describe('dump primitive', () => {
    it('should serialize numbers', async () => {
      expect(await dump(123)).toEqual('123')
    })
    it('should serialize strings', async () => {
      expect(await dump('aaa')).toEqual('"aaa"')
    })
    it('should serialize booleans', async () => {
      expect(await dump(false)).toEqual('false')
    })
    it('should dump list', async () => {
      expect(await dump([1, 'asd', true, { complex: 'value' }])).toMatch(
        /\[\s+1,\s+"asd",\s+true,\s+\{\s+complex = "value"\s+\}\s+]/s
      )
    })
  })
})
