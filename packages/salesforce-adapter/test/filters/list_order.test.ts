import {
  ObjectType, ElemID, InstanceElement, Field, BuiltinTypes, Type, Value,
} from 'adapter-api'
import _ from 'lodash'
import filterCreator, { CLEAN_DATA_SERVICE_TYPE_NAME, CLEAN_RULES_FIELD_NAME,
  FIELD_MAPPINGS_FIELD_NAME, FIELD_MAPPINGS_FIELD_TO_SORT_BY, FIELD_PERMISSIONS_TYPE_NAME,
  FIELD_FIELD_NAME }
  from '../../src/filters/list_order'
import { SALESFORCE, INSTANCE_FULL_NAME_FIELD } from '../../src/constants'
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

    it('should properly sort an object instance field by its sort property and a sort callback', async () => {
      const opportunityStageElemId = new ElemID(SALESFORCE, 'standard_value_set')
      const STANDARD_VALUE = 'standard_value'
      const mockOpportunityStageInstance = new InstanceElement(
        'opportunity_stage',
        new ObjectType({
          elemID: opportunityStageElemId,
        }),
        {
          [STANDARD_VALUE]: [
            {
              [INSTANCE_FULL_NAME_FIELD]: 'd',
            },
            {
              [INSTANCE_FULL_NAME_FIELD]: 'c',
            },
            {
              [INSTANCE_FULL_NAME_FIELD]: 'b',
            },
            {
              [INSTANCE_FULL_NAME_FIELD]: 'a',
            },
          ],
        }
      )
      const businessProcessElemId = new ElemID(SALESFORCE, 'business_process')
      const mockbusinessProcessInstance = new InstanceElement(
        'OpportunityStage',
        new ObjectType({
          elemID: businessProcessElemId,
        }),
        {
          values: [
            {
              test: 'super',
              [INSTANCE_FULL_NAME_FIELD]: 'a',
            },
            {
              test: 'califragilistic',
              [INSTANCE_FULL_NAME_FIELD]: 'd',
            },
            {
              test: 'expiali',
              [INSTANCE_FULL_NAME_FIELD]: 'b',
            },
            {
              test: 'docious',
              [INSTANCE_FULL_NAME_FIELD]: 'c',
            },
          ],
        }
      )
      const testElements = [mockOpportunityStageInstance, mockbusinessProcessInstance]
      // Run filter
      await filter.onFetch(testElements)
      // Get results
      const [resultOpportunityStage, resultBusinessProcess] = testElements
      // Opportunity stage should not change
      expect(_.isEqual(mockOpportunityStageInstance, resultOpportunityStage)).toBeTruthy()
      // Verify that the order of the values of the Business Process mock is the same as the
      // Opportunity stage standard value
      expect((resultBusinessProcess as InstanceElement).value.values.map((val: { [x: string]: Value }) => val[INSTANCE_FULL_NAME_FIELD])).toEqual(['d', 'c', 'b', 'a'])
    })
  })
})
