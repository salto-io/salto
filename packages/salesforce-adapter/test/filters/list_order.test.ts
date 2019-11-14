import {
  ObjectType, ElemID, InstanceElement, Field, BuiltinTypes, Type,
} from 'adapter-api'
import filterCreator, { CLEAN_DATA_SERVICE_TYPE_NAME, CLEAN_RULES_FIELD_NAME,
  FIELD_MAPPINGS_FIELD_NAME, FIELD_MAPPINGS_FIELD_TO_SORT_BY, FIELD_PERMISSIONS_TYPE_NAME,
  FIELD_FIELD_NAME }
  from '../../src/filters/list_order'
import { SALESFORCE } from '../../src/constants'
import { FilterWith } from '../../src/filter'

describe('list order filter', () => {
  const filter = filterCreator() as FilterWith<'onFetch'>

  describe('on fetch', () => {
    it('should properly sort an object instance field by its sort property', async () => {
      const typeElemID = new ElemID(SALESFORCE, CLEAN_DATA_SERVICE_TYPE_NAME)
      const testType = new ObjectType({ elemID: typeElemID })

      const testInstance = new InstanceElement('test', testType, {
        [CLEAN_RULES_FIELD_NAME]: [
          {
            name: 'Test',
            [FIELD_MAPPINGS_FIELD_NAME]: [
              {
                name: 'Charlie',
                [FIELD_MAPPINGS_FIELD_TO_SORT_BY]: 'c',
              },
              {
                name: 'Alpha',
                [FIELD_MAPPINGS_FIELD_TO_SORT_BY]: 'a',
              },
              {
                name: 'Bravo',
                [FIELD_MAPPINGS_FIELD_TO_SORT_BY]: 'b',
              },
            ],
          },
        ],
      })
      const testEmpty = new InstanceElement('test2', testType, {})
      await filter.onFetch([testInstance, testEmpty])
      expect(
        testInstance.value[CLEAN_RULES_FIELD_NAME][0][FIELD_MAPPINGS_FIELD_NAME].map(
          (e: { name: string }) => e.name
        )
      ).toEqual(['Alpha', 'Bravo', 'Charlie'])
    })

    const typeElemID = new ElemID(SALESFORCE, FIELD_PERMISSIONS_TYPE_NAME)
    it('should properly sort values in a field in an ObjectType', async () => {
      const testType = new ObjectType(
        {
          elemID: typeElemID,
          fields: {
            [FIELD_FIELD_NAME]: new Field(typeElemID, 'FIELD_FIELD_NAME', BuiltinTypes.STRING,
              { [Type.VALUES]: ['c', 'a', 'b'] }),
          },
        }
      )
      await filter.onFetch([testType])
      expect(testType.fields[FIELD_FIELD_NAME].annotations[Type.VALUES])
        .toEqual(['a', 'b', 'c'])
    })
    it('should not fail if target field does not exist', async () => {
      const testType = new ObjectType({ elemID: typeElemID })
      await expect(filter.onFetch([testType])).resolves.not.toThrow()
    })
  })
})
