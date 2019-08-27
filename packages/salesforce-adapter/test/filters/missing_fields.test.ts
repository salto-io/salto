import {
  ObjectType, ElemID, Field, BuiltinTypes,
} from 'adapter-api'
import { MissingFieldsFilter } from '../../src/filters/missing_fields'
import SalesforceClient from '../../src/client/client'
import * as constants from '../../src/constants'

jest.mock('../../src/client/client')

describe('Test layout filter', () => {
  const client = new SalesforceClient('', '', false)
  const filter = new MissingFieldsFilter({
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
  })

  const mockObjId = new ElemID(constants.SALESFORCE, 'test')
  const mockType = new ObjectType({
    elemID: mockObjId,
    fields: {
      existing: new Field(mockObjId, 'existing', BuiltinTypes.STRING),
    },
  })
  const complexType = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'complex_type'),
    annotationsValues: { marker: 'here' },
  })

  let testElements: ObjectType[]

  beforeEach(() => {
    testElements = [
      mockType.clone(),
      complexType,
    ]
  })

  describe('on discover', () => {
    beforeEach(() => filter.onDiscover(client, testElements))

    it('should add primitive list fields', async () => {
      const [testType] = testElements
      expect(testType.fields.lst).toBeDefined()
      expect(testType.fields.lst.isList).toBe(true)
      expect(testType.fields.lst.getAnnotationsValues()).toEqual({ dummy: true })
      expect(testType.fields.lst.type).toEqual(BuiltinTypes.STRING)
    })

    it('should add fields by type name', async () => {
      const [testType] = testElements
      expect(testType.fields.complex).toBeDefined()
      expect(testType.fields.complex.isList).toBe(false)
      expect(testType.fields.complex.getAnnotationsValues()).toEqual({})
      expect(testType.fields.complex.type).toEqual(complexType)
    })

    it('should keep existing fields unchanged', async () => {
      const [testType] = testElements
      expect(testType.fields.existing).toEqual(mockType.fields.existing)
    })
  })

  describe('on add', () => {
    it('should have no effect', async () => {
      expect(await filter.onAdd(client, mockType)).toHaveLength(0)
    })
  })

  describe('on update', () => {
    it('should have no effect', async () => {
      expect(await filter.onUpdate(client, mockType, mockType)).toHaveLength(0)
    })
  })

  describe('on remove', () => {
    it('should have no effect', async () => {
      expect(await filter.onRemove(client, mockType)).toHaveLength(0)
    })
  })
})
