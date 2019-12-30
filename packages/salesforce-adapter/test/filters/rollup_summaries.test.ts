import {
  Element, ElemID, Field, ObjectType, InstanceElement,
} from 'adapter-api'
import filterCreator, { INSTANCE_TYPE_FIELD } from '../../src/filters/custom_objects'
import mockClient from '../client'
import { FilterWith } from '../../src/filter'
import {
  CUSTOM_OBJECT,
  FIELD_ANNOTATIONS,
  FILTER_ITEM_FIELDS,
  SALESFORCE,
  INSTANCE_FULL_NAME_FIELD,
  LABEL,
} from '../../src/constants'

describe('roll up summary filter', () => {
  const rollupSummaryInstanceElement = new InstanceElement('account', new ObjectType(
    { elemID: new ElemID(SALESFORCE, CUSTOM_OBJECT) }
  ),
  { fields: [{
    [INSTANCE_FULL_NAME_FIELD]: 'rollup',
    [LABEL]: 'My Summary',
    [FIELD_ANNOTATIONS.SUMMARIZED_FIELD]: 'Opportunity.Amount',
    [FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS]: {
      [FILTER_ITEM_FIELDS.FIELD]: 'Opportunity.Amount',
      [FILTER_ITEM_FIELDS.OPERATION]: 'greaterThan',
      [FILTER_ITEM_FIELDS.VALUE]: '1',
    },
    [FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY]: 'Opportunity.AccountId',
    [FIELD_ANNOTATIONS.SUMMARY_OPERATION]: 'sum',
    [INSTANCE_TYPE_FIELD]: 'Summary',
  },
  ],
  [INSTANCE_FULL_NAME_FIELD]: 'Account' })

  describe('on fetch', () => {
    let testElements: Element[]
    const { client } = mockClient()
    let filter: FilterWith<'onFetch'>

    beforeEach(() => {
      testElements = [rollupSummaryInstanceElement.clone()]
    })

    const initFilter = async (): Promise<void> => {
      filter = filterCreator({ client }) as FilterWith<'onFetch'>
      await filter.onFetch(testElements)
    }

    const assertRollupSummaryFieldTransformation = (rollupSummaryField: Field): void => {
      const expectedRollupSummaryField = rollupSummaryInstanceElement.value.fields[0]
      expect(rollupSummaryField).toBeDefined()
      expect(rollupSummaryField.annotations[FIELD_ANNOTATIONS.SUMMARIZED_FIELD])
        .toEqual(expectedRollupSummaryField[FIELD_ANNOTATIONS.SUMMARIZED_FIELD])
      expect(rollupSummaryField.annotations[FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY])
        .toEqual(expectedRollupSummaryField[FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY])
      expect(rollupSummaryField.annotations[FIELD_ANNOTATIONS.SUMMARY_OPERATION])
        .toEqual(expectedRollupSummaryField[FIELD_ANNOTATIONS.SUMMARY_OPERATION])
      const filterItems = rollupSummaryField.annotations[FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS]
      expect(filterItems).toBeDefined()
      expect(filterItems).toHaveLength(1)
      expect(filterItems[0][FILTER_ITEM_FIELDS.FIELD])
        .toEqual(expectedRollupSummaryField[FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS].field)
      expect(filterItems[0][FILTER_ITEM_FIELDS.OPERATION])
        .toEqual(expectedRollupSummaryField[FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS].operation)
      expect(filterItems[0][FILTER_ITEM_FIELDS.VALUE])
        .toEqual(expectedRollupSummaryField[FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS].value)
      expect(filterItems[0][FILTER_ITEM_FIELDS.VALUE_FIELD]).toBeUndefined()
    }

    it('should add rollup summary data to rollup summary field', async () => {
      await initFilter()
      const testElement = testElements[0] as ObjectType
      const rollupSummaryField = testElement.fields.rollup
      assertRollupSummaryFieldTransformation(rollupSummaryField)
    })
  })
})
