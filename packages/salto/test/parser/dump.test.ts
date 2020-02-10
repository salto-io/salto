import {
  ObjectType, PrimitiveType, PrimitiveTypes, ElemID, TypeElement, InstanceElement,
  Field, BuiltinTypes, INSTANCE_ANNOTATIONS,
} from 'adapter-api'
import * as TestHelpers from '../common/helpers'
import { parse } from '../../src/parser/parse'
import {
  dumpAnnotationTypes, dumpElements, dumpSingleAnnotationType, dumpValues,
} from '../../src/parser/dump'

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
    annotationTypes: {
      ServiceId: BuiltinTypes.SERVICE_ID,
    },
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
    LeadConvertSettings: {
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

  describe('dump elements', () => {
    let body: string

    beforeAll(() => {
      body = dumpElements([strType, numType, boolType, fieldType, model, instance, config,
        instanceStartsWithNumber])
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

    describe('dumped instance elements', () => {
      it('has instance block', () => {
        expect(body).toMatch(/salesforce_test me {/)
      })
      it('has annotation values', () => {
        expect(body).toMatch(new RegExp(`${INSTANCE_ANNOTATIONS.DEPENDS_ON}\\s+=\\s+"test"`))
      })
    })

    it('dumps config elements', () => {
      expect(body).toMatch(/salesforce_test {/)
    })

    describe('dumped model', () => {
      it('has correct block type and label', () => {
        expect(body).toMatch(/type salesforce_test {/)
      })
      it('has annotations block', () => {
        expect(body).toMatch(/annotations {/)
        expect(body).toMatch(/serviceid ServiceId {/)
      })
      it('has complex attributes', () => {
        expect(body).toMatch(
          /LeadConvertSettings = {\s*account = \[\s*{\s*input\s*=\s*"bla",\s*output\s*=\s*"foo",*\s*},*\s*\],*\s*}/m,
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
    })
    it('dumped instance with name that starts with number', () => {
      expect(body).toMatch(/salesforce_test "3me"/)
    })

    it('can be parsed back', () => {
      const { elements, errors } = parse(Buffer.from(body), 'none')
      expect(errors.length).toEqual(0)
      expect(elements.length).toEqual(8)
      expect(elements[0]).toEqual(strType)
      expect(elements[1]).toEqual(numType)
      expect(elements[2]).toEqual(boolType)
      TestHelpers.expectTypesToMatch(elements[3] as TypeElement, fieldType)
      TestHelpers.expectTypesToMatch(elements[4] as TypeElement, model)
      TestHelpers.expectInstancesToMatch(elements[5] as InstanceElement, instance)
      TestHelpers.expectInstancesToMatch(elements[6] as InstanceElement, config)
      TestHelpers.expectInstancesToMatch(elements[7] as InstanceElement, instanceStartsWithNumber)
    })
  })
  describe('dump field', () => {
    let body: string

    beforeAll(() => {
      body = dumpElements([model.fields.name])
    })

    it('should contain only field', () => {
      expect(body).toMatch(/^salesforce_string name {\s+label = "Name"\s+}$/m)
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
