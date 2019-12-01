import {
  Element, ElemID, Field, ObjectType,
} from 'adapter-api'
import { MetadataInfo } from 'jsforce'
import mockClient from '../client'
import filterCreator from '../../src/filters/rollup_summaries'
import { FilterWith } from '../../src/filter'
import {
  API_NAME,
  CUSTOM_OBJECT,
  FIELD_ANNOTATIONS,
  FILTER_ITEM_FIELDS,
  METADATA_TYPE,
  SALESFORCE,
} from '../../src/constants'
import { Types } from '../../src/transformers/transformer'

describe('Test field dependencies filter', () => {
  const objectTypeElemId = new ElemID(SALESFORCE, 'test')
  const rollupSummaryFieldApiName = 'RollupSummaryField__c'
  const mockObjectApiName = 'Test__c'

  const rollupSummaryCustomField = {
    fullName: `${mockObjectApiName}.${rollupSummaryFieldApiName}`,
    label: 'My Summary',
    summarizedField: 'Opportunity.Amount',
    summaryFilterItems: {
      field: 'Opportunity.Amount',
      operation: 'greaterThan',
      value: '1',
    },
    summaryForeignKey: 'Opportunity.AccountId',
    summaryOperation: 'sum',
    type: 'Summary',
  }

  describe('on fetch', () => {
    const mockObject = new ObjectType({
      elemID: objectTypeElemId,
      fields: {
        // eslint-disable-next-line @typescript-eslint/camelcase
        rollup_summary_field:
          new Field(objectTypeElemId, 'rollup_summary_field',
            Types.primitiveDataTypes.rollupsummary, { [API_NAME]: rollupSummaryFieldApiName }),
      },
      annotations: {
        label: 'test label',
        [API_NAME]: mockObjectApiName,
        [METADATA_TYPE]: CUSTOM_OBJECT,
      },
    })
    let testElements: Element[]
    const { client } = mockClient()
    let filter: FilterWith<'onFetch'>

    beforeEach(() => {
      testElements = [mockObject.clone()]
    })

    const mockClientReadMetadata = (): void => {
      client.readMetadata = jest.fn().mockImplementation(() =>
        [rollupSummaryCustomField as MetadataInfo])
    }

    const initFilter = async (): Promise<void> => {
      filter = filterCreator({ client }) as FilterWith<'onFetch'>
      await filter.onFetch(testElements)
    }

    const assertRollupSummaryFieldTransformation = (rollupSummaryField: Field): void => {
      expect(rollupSummaryField).toBeDefined()
      expect(rollupSummaryField.annotations[FIELD_ANNOTATIONS.SUMMARIZED_FIELD])
        .toEqual(rollupSummaryCustomField.summarizedField)
      expect(rollupSummaryField.annotations[FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY])
        .toEqual(rollupSummaryCustomField.summaryForeignKey)
      expect(rollupSummaryField.annotations[FIELD_ANNOTATIONS.SUMMARY_OPERATION])
        .toEqual(rollupSummaryCustomField.summaryOperation)
      const filterItems = rollupSummaryField.annotations[FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS]
      expect(filterItems).toBeDefined()
      expect(filterItems).toHaveLength(1)
      expect(filterItems[0][FILTER_ITEM_FIELDS.FIELD])
        .toEqual(rollupSummaryCustomField.summaryFilterItems.field)
      expect(filterItems[0][FILTER_ITEM_FIELDS.OPERATION])
        .toEqual(rollupSummaryCustomField.summaryFilterItems.operation)
      expect(filterItems[0][FILTER_ITEM_FIELDS.VALUE])
        .toEqual(rollupSummaryCustomField.summaryFilterItems.value)
      expect(filterItems[0][FILTER_ITEM_FIELDS.VALUE_FIELD]).toBeUndefined()
    }

    it('should add rollup summary data to rollup summary field', async () => {
      mockClientReadMetadata()
      await initFilter()
      const testElement = testElements[0] as ObjectType
      const rollupSummaryField = testElement.fields.rollup_summary_field
      assertRollupSummaryFieldTransformation(rollupSummaryField)
    })

    it('should do nothing for non rollup_summary field types', async () => {
      mockClientReadMetadata()
      const testElement = testElements[0] as ObjectType
      testElement.fields.rollup_summary_field.type = Types.primitiveDataTypes.text
      await initFilter()
      const { annotations } = testElement.fields.rollup_summary_field
      expect(annotations[FIELD_ANNOTATIONS.SUMMARIZED_FIELD]).toBeUndefined()
      expect(annotations[FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY]).toBeUndefined()
      expect(annotations[FIELD_ANNOTATIONS.SUMMARY_OPERATION]).toBeUndefined()
      expect(annotations[FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS]).toBeUndefined()
    })

    it('should add rollup summary data when object is split over few elements', async () => {
      mockClientReadMetadata()
      const testElement = testElements[0] as ObjectType
      delete testElement.annotations[API_NAME]
      testElements = [testElement,
        new ObjectType({ elemID: objectTypeElemId,
          annotations: { [API_NAME]: mockObjectApiName } })]
      await initFilter()
      const rollupSummaryField = testElement.fields.rollup_summary_field
      assertRollupSummaryFieldTransformation(rollupSummaryField)
    })
  })
})
