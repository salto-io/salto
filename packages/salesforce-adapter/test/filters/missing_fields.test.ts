import {
  ObjectType, ElemID, Field, BuiltinTypes,
} from 'adapter-api'
import { makeFilter } from '../../src/filters/missing_fields'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'

describe('Test layout filter', () => {
  const { client } = mockClient()
  const filter = makeFilter({
    test: [
      {
        name: 'lst',
        type: BuiltinTypes.STRING,
        annotationValues: { dummy: true },
        isList: true,
      },
      {
        name: 'complex',
        type: 'complex_type',
      },
    ],
  })({ client }) as FilterWith<'onDiscover'>

  const mockObjId = new ElemID(constants.SALESFORCE, 'test')
  const mockType = new ObjectType({
    elemID: mockObjId,
    fields: {
      existing: new Field(mockObjId, 'existing', BuiltinTypes.STRING),
    },
  })
  const complexType = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'complex_type'),
    annotationValues: { marker: 'here' },
  })

  let testElements: ObjectType[]

  beforeEach(() => {
    testElements = [
      mockType.clone(),
      complexType,
    ]
  })

  describe('on discover', () => {
    beforeEach(() => filter.onDiscover(testElements))

    it('should add primitive list fields', async () => {
      const [testType] = testElements
      expect(testType.fields.lst).toBeDefined()
      expect(testType.fields.lst.isList).toBe(true)
      expect(testType.fields.lst.annotationValues).toEqual({ dummy: true })
      expect(testType.fields.lst.type).toEqual(BuiltinTypes.STRING)
    })

    it('should add fields by type name', async () => {
      const [testType] = testElements
      expect(testType.fields.complex).toBeDefined()
      expect(testType.fields.complex.isList).toBe(false)
      expect(testType.fields.complex.annotationValues).toEqual({})
      expect(testType.fields.complex.type).toEqual(complexType)
    })

    it('should keep existing fields unchanged', async () => {
      const [testType] = testElements
      expect(testType.fields.existing).toEqual(mockType.fields.existing)
    })
  })
})
