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
      const instanceElemID = new ElemID(SALESFORCE, ...[CLEAN_DATA_SERVICE_TYPE_NAME, 'test'])
      const typeElemID = new ElemID(SALESFORCE, CLEAN_DATA_SERVICE_TYPE_NAME)

      const testInstance = new InstanceElement(instanceElemID, new ObjectType({
        elemID: typeElemID,
      }),
      {
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
      await filter.onFetch([testInstance])
      expect(
        testInstance.value[CLEAN_RULES_FIELD_NAME][0][FIELD_MAPPINGS_FIELD_NAME].map(
          (e: { name: string }) => e.name
        )
      ).toEqual(['Alpha', 'Bravo', 'Charlie'])
    })

    it('should properly sort values in a field in an ObjectType', async () => {
      const typeElemID = new ElemID(SALESFORCE, FIELD_PERMISSIONS_TYPE_NAME)
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
  })
})
