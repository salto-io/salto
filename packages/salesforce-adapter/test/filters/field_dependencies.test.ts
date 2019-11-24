import {
  Element, ElemID, Field, ObjectType, Values,
} from 'adapter-api'
import { MetadataInfo } from 'jsforce'
import mockClient from '../client'
import filterCreator from '../../src/filters/field_dependencies'
import { FilterWith } from '../../src/filter'
import {
  API_NAME, CUSTOM_OBJECT, FIELD_ANNOTATIONS, FIELD_DEPENDENCY_FIELDS, METADATA_TYPE, SALESFORCE,
  VALUE_SETTINGS_FIELDS,
} from '../../src/constants'
import { Types } from '../../src/transformer'

describe('Test field dependencies filter', () => {
  const picklistType = Types.primitiveDataTypes.picklist
  const objectTypeElemId = new ElemID(SALESFORCE, 'test')
  const picklistFieldApiName = 'PicklistField__c'
  const mockObjectApiName = 'Test__c'

  const createFieldDependencyCustomField = (): MetadataInfo[] =>
    ([{
      fullName: `${mockObjectApiName}.${picklistFieldApiName}`,
      valueSet: {
        controllingField: 'ControllingFieldName',
        valueSetDefinition: {
          value: [
            {
              fullName: 'Val1',
              default: false,
              label: 'Val1',
            },
            {
              fullName: 'Val2',
              default: false,
              label: 'Val2',
            },
          ],
        },
        valueSettings: [
          {
            controllingFieldValue: [
              'Controlling1',
              'Controlling2',
            ],
            valueName: 'Val1',
          },
          {
            controllingFieldValue: 'Controlling1',
            valueName: 'Val2',
          },
        ],
      },
    } as MetadataInfo,
    ])

  describe('on fetch', () => {
    const mockObject = new ObjectType({
      elemID: objectTypeElemId,
      fields: {
        // eslint-disable-next-line @typescript-eslint/camelcase
        picklist_field:
          new Field(objectTypeElemId, 'picklist_field', picklistType,
            {
              [API_NAME]: picklistFieldApiName,
              [FIELD_ANNOTATIONS.FIELD_DEPENDENCY]: {},
            }),
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
      client.readMetadata = jest.fn().mockImplementation(() => createFieldDependencyCustomField())
    }

    const initFilter = async (): Promise<void> => {
      filter = filterCreator({ client }) as FilterWith<'onFetch'>
      await filter.onFetch(testElements)
    }

    const assertFieldDependencyTransformation = (fieldDependencyAnnotation: Values): void => {
      expect(fieldDependencyAnnotation).toBeDefined()
      expect(fieldDependencyAnnotation[FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD])
        .toEqual('ControllingFieldName')
      const valuesSettings = fieldDependencyAnnotation[FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]
      expect(valuesSettings).toBeDefined()
      expect(valuesSettings).toHaveLength(2)
      expect(valuesSettings[0][VALUE_SETTINGS_FIELDS.VALUE_NAME]).toEqual('Val1')
      expect(valuesSettings[0][VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE])
        .toEqual(['Controlling1', 'Controlling2'])
      expect(valuesSettings[1][VALUE_SETTINGS_FIELDS.VALUE_NAME]).toEqual('Val2')
      expect(valuesSettings[1][VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE])
        .toEqual(['Controlling1'])
    }

    it('should add field dependency data to a field with field dependency annotation', async () => {
      mockClientReadMetadata()
      await initFilter()
      const testElement = testElements[0] as ObjectType
      const fieldDependencyAnnotation = testElement.fields.picklist_field
        .annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
      assertFieldDependencyTransformation(fieldDependencyAnnotation)
    })

    it('should do nothing if a field doesnt have a field dependency annotation', async () => {
      mockClientReadMetadata()
      await initFilter()
      const testElement = testElements[0] as ObjectType
      delete testElement.fields.picklist_field
        .annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
      await filter.onFetch(testElements)
      expect(testElement.fields.picklist_field
        .annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]).toBeUndefined()
    })

    it('should add field dependency data when object is split over few elements', async () => {
      mockClientReadMetadata()
      const testElement = testElements[0] as ObjectType
      delete testElement.annotations[API_NAME]
      testElements = [testElement,
        new ObjectType({ elemID: objectTypeElemId,
          annotations: { [API_NAME]: mockObjectApiName } })]
      await initFilter()
      const fieldDependencyAnnotation = testElement.fields.picklist_field
        .annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
      assertFieldDependencyTransformation(fieldDependencyAnnotation)
    })

    it('should add element types for field dependency and its inner types', async () => {
      testElements = []
      await initFilter()
      expect(testElements).toHaveLength(2)
      expect(testElements[0])
        .toEqual(expect.objectContaining({ path: ['types', 'subtypes', 'field_dependency'] }))
      expect(testElements[1])
        .toEqual(expect.objectContaining({ path: ['types', 'subtypes', 'value_settings'] }))
    })
  })
})
