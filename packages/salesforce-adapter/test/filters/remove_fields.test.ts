import {
  ObjectType, ElemID, Field, BuiltinTypes,
} from 'adapter-api'
import { makeFilter } from '../../src/filters/remove_fields'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'

describe('missing fields filter', () => {
  const mockObjId = new ElemID(constants.SALESFORCE, 'test')
  const mockType = new ObjectType({
    elemID: mockObjId,
    fields: {
      existing: new Field(mockObjId, 'existing', BuiltinTypes.STRING),
      test: new Field(mockObjId, 'test', BuiltinTypes.STRING),
    },
  })
  const anotherMockObjId = new ElemID(constants.SALESFORCE, 'anotherType')
  const anotherMockType = new ObjectType({
    elemID: anotherMockObjId,
    fields: {
      test: new Field(anotherMockObjId, 'test', BuiltinTypes.STRING),
    },
  })

  const { client } = mockClient()
  const filter = makeFilter({
    [mockObjId.getFullName()]: ['test'],
  })({ client }) as FilterWith<'onFetch'>

  let testElements: ObjectType[]

  beforeEach(() => {
    testElements = [
      mockType.clone(),
      anotherMockType.clone(),
    ]
  })

  describe('on fetch', () => {
    beforeEach(() => filter.onFetch(testElements))

    it('should remove field', () => {
      const [testType] = testElements
      expect(testType.fields.existing).toBeDefined()
      expect(testType.fields.existing).toEqual(mockType.fields.existing)
      expect(testType.fields.test).toBeUndefined()
    })

    it('should not remove field when the ID is not of the right object', () => {
      const testType = testElements[1]
      expect(testType.fields.test).toBeDefined()
      expect(testType.fields.test).toEqual(anotherMockType.fields.test)
    })
  })
})
