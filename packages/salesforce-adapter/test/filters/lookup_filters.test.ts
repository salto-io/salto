import {
  Element, ElemID, Field, InstanceElement, ObjectType, PrimitiveType, PrimitiveTypes, Type,
} from 'adapter-api'
import { MetadataInfo } from 'jsforce'
import mockClient from '../client'
import filterCreator from '../../src/filters/lookup_filters'
import { FilterWith } from '../../src/filter'
import * as constants from '../../src/constants'

describe('Test lookup filters filter', () => {
  const lookupType = new PrimitiveType({
    elemID: new ElemID(constants.SALESFORCE, constants.FIELD_TYPE_NAMES.LOOKUP),
    primitive: PrimitiveTypes.STRING,
  })
  const objectTypeElemId = new ElemID(constants.SALESFORCE, 'test')
  const lookupFieldApiName = 'LookupField__c'
  const mockObjectApiName = 'Test__c'

  const createLookupFilterCustomField = (isFilterOptional: boolean): MetadataInfo[] =>
    ([{
      fullName: `${mockObjectApiName}.${lookupFieldApiName}`,
      lookupFilter: {
        active: true,
        booleanFilter: 'myBooleanFilter',
        errorMessage: 'myErrorMessage',
        infoMessage: 'myInfoMessage',
        isOptional: isFilterOptional,
        filterItems: [
          {
            field: 'myField1',
            operation: 'myOperation1',
            valueField: 'myValueField1',
          },
          {
            field: 'myField2',
            operation: 'myOperation2',
            valueField: 'myValueField2',
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
        lookup_field:
          new Field(objectTypeElemId, 'lookup_field', lookupType,
            {
              [Type.SERVICE_ID]: lookupFieldApiName,
              [constants.FIELD_ANNOTATIONS.LOOKUP_FILTER]: {},
            }),
      },
      annotations: {
        label: 'test label',
        [Type.SERVICE_ID]: mockObjectApiName,
        [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
      },
    })
    let testElements: Element[]
    const { client } = mockClient()
    let filter: FilterWith<'onFetch'>

    beforeEach(() => {
      testElements = [mockObject]
    })

    const mockClientReadMetadata = (isLookupFilterOptional = true): void => {
      client.readMetadata = jest.fn().mockImplementation(() =>
        createLookupFilterCustomField(isLookupFilterOptional))
    }

    const initFilter = async (): Promise<void> => {
      filter = filterCreator({ client }) as FilterWith<'onFetch'>
      await filter.onFetch(testElements)
    }

    it('should add lookupFilter data to a field with lookupFilter when lookupFilter is optional', async () => {
      mockClientReadMetadata()
      await initFilter()
      const lookupFilterAnnotation = mockObject.fields.lookup_field
        .annotations[constants.FIELD_ANNOTATIONS.LOOKUP_FILTER]
      expect(lookupFilterAnnotation).toBeDefined()
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.ACTIVE]).toBe(true)
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER]).toEqual('myBooleanFilter')
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]).toBeUndefined()
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.INFO_MESSAGE]).toEqual('myInfoMessage')
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.IS_OPTIONAL]).toBe(true)
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS]).toBeDefined()
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS]).toHaveLength(2)
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS][0][constants.LOOKUP_FILTER_FIELDS.FIELD]).toEqual('myField1')
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS][0][constants.LOOKUP_FILTER_FIELDS.OPERATION]).toEqual('myOperation1')
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS][0][constants.LOOKUP_FILTER_FIELDS.VALUE_FIELD]).toEqual('myValueField1')
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS][1][constants.LOOKUP_FILTER_FIELDS.FIELD]).toEqual('myField2')
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS][1][constants.LOOKUP_FILTER_FIELDS.OPERATION]).toEqual('myOperation2')
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS][1][constants.LOOKUP_FILTER_FIELDS.VALUE_FIELD]).toEqual('myValueField2')
    })

    it('should add lookupFilter data to a field with lookupFilter when lookupFilter is not optional', async () => {
      mockClientReadMetadata(false)
      await initFilter()
      const lookupFilterAnnotation = mockObject.fields.lookup_field
        .annotations[constants.FIELD_ANNOTATIONS.LOOKUP_FILTER]
      expect(lookupFilterAnnotation).toBeDefined()
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.ACTIVE]).toBe(true)
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER]).toEqual('myBooleanFilter')
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]).toEqual('myErrorMessage')
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.INFO_MESSAGE]).toEqual('myInfoMessage')
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.IS_OPTIONAL]).toBe(false)
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS]).toBeDefined()
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS]).toHaveLength(2)
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS][0][constants.LOOKUP_FILTER_FIELDS.FIELD]).toEqual('myField1')
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS][0][constants.LOOKUP_FILTER_FIELDS.OPERATION]).toEqual('myOperation1')
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS][0][constants.LOOKUP_FILTER_FIELDS.VALUE_FIELD]).toEqual('myValueField1')
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS][1][constants.LOOKUP_FILTER_FIELDS.FIELD]).toEqual('myField2')
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS][1][constants.LOOKUP_FILTER_FIELDS.OPERATION]).toEqual('myOperation2')
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS][1][constants.LOOKUP_FILTER_FIELDS.VALUE_FIELD]).toEqual('myValueField2')
    })

    it('should do nothing if a field doesnt have a lookupFilter', async () => {
      mockClientReadMetadata()
      await initFilter()
      delete mockObject.fields.lookup_field
        .annotations[constants.FIELD_ANNOTATIONS.LOOKUP_FILTER]
      await filter.onFetch(testElements)
      expect(mockObject.fields.lookup_field
        .annotations[constants.FIELD_ANNOTATIONS.LOOKUP_FILTER]).toBeUndefined()
    })

    it('should add element types for LookupFilter & FilterItem', async () => {
      testElements = []
      await initFilter()
      expect(testElements).toHaveLength(1)
      expect(testElements[0]).toEqual(expect.objectContaining({ path: ['types', 'subtypes', 'lookup_filter'] }))
    })
  })

  describe('on add', () => {
    let mockObject: ObjectType
    const lookupField = new Field(objectTypeElemId, 'lookup_field', lookupType,
      {
        [Type.SERVICE_ID]: lookupFieldApiName,
        [constants.FIELD_ANNOTATIONS.LOOKUP_FILTER]: {
          [constants.LOOKUP_FILTER_FIELDS.ACTIVE]: true,
          [constants.LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER]: '1 OR 2',
          [constants.LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]: 'This is the Error message',
          [constants.LOOKUP_FILTER_FIELDS.INFO_MESSAGE]: 'This is the Info message',
          [constants.LOOKUP_FILTER_FIELDS.IS_OPTIONAL]: false,
          [constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS]: [{
            [constants.LOOKUP_FILTER_FIELDS.FIELD]: 'Case.OwnerId',
            [constants.LOOKUP_FILTER_FIELDS.OPERATION]: 'equals',
            [constants.LOOKUP_FILTER_FIELDS.VALUE_FIELD]: '$User.Id',
          },
          {
            [constants.LOOKUP_FILTER_FIELDS.FIELD]: 'Case.ParentId',
            [constants.LOOKUP_FILTER_FIELDS.OPERATION]: 'equals',
            [constants.LOOKUP_FILTER_FIELDS.VALUE_FIELD]: '$User.Id',
          }],
        },
      })

    const origMockObject = new ObjectType({
      elemID: objectTypeElemId,
      fields: {
        lookup: lookupField,
      },
      annotations: {
        label: 'test label',
        [Type.SERVICE_ID]: mockObjectApiName,
        [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
      },
    })
    const { client } = mockClient()
    const filter = filterCreator({ client }) as FilterWith<'onAdd'>

    const updateSpy = jest.spyOn(client, 'update').mockImplementation(() => [])
    beforeEach(() => {
      mockObject = origMockObject.clone()
      updateSpy.mockReset()
    })

    it('should add lookupFilter data to a customField with lookupFilter upon the customObject creation', () => {
      filter.onAdd(mockObject)
      expect(updateSpy).toHaveBeenCalled()
      expect(updateSpy).toHaveBeenCalledWith(constants.CUSTOM_FIELD, [expect.objectContaining(
        {
          lookupFilter: {
            active: true,
            booleanFilter: '1 OR 2',
            errorMessage: 'This is the Error message',
            infoMessage: 'This is the Info message',
            isOptional: false,
            filterItems: [
              {
                field: 'Case.OwnerId',
                operation: 'equals',
                valueField: '$User.Id',
              },
              {
                field: 'Case.ParentId',
                operation: 'equals',
                valueField: '$User.Id',
              },
            ],
          },
        }
      )])
    })

    it('should ignore lookupFilter for fields with no lookupFilter upon the customObject creation', () => {
      delete mockObject.fields.lookup.annotations[constants.FIELD_ANNOTATIONS.LOOKUP_FILTER]
      filter.onAdd(mockObject)
      expect(updateSpy).not.toHaveBeenCalled()
    })

    it('should ignore lookupFilter for non objectType', () => {
      filter.onAdd(new InstanceElement(objectTypeElemId, mockObject, {}))
      expect(updateSpy).not.toHaveBeenCalled()
    })
  })

  describe('on update', () => {
    let beforeObject: ObjectType
    let afterObject: ObjectType
    const lookupFilter = {
      [constants.LOOKUP_FILTER_FIELDS.ACTIVE]: true,
      [constants.LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER]: '1 OR 2',
      [constants.LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]: 'This is the Error message',
      [constants.LOOKUP_FILTER_FIELDS.INFO_MESSAGE]: 'This is the Info message',
      [constants.LOOKUP_FILTER_FIELDS.IS_OPTIONAL]: false,
      [constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS]: [{
        [constants.LOOKUP_FILTER_FIELDS.FIELD]: 'Case.OwnerId',
        [constants.LOOKUP_FILTER_FIELDS.OPERATION]: 'equals',
        [constants.LOOKUP_FILTER_FIELDS.VALUE_FIELD]: '$User.Id',
      },
      {
        [constants.LOOKUP_FILTER_FIELDS.FIELD]: 'Case.ParentId',
        [constants.LOOKUP_FILTER_FIELDS.OPERATION]: 'equals',
        [constants.LOOKUP_FILTER_FIELDS.VALUE_FIELD]: '$User.Id',
      }],
    }

    const lookupField = new Field(objectTypeElemId, 'lookup_field', lookupType,
      {
        [Type.SERVICE_ID]: lookupFieldApiName,
      })

    const origBeforeObject = new ObjectType({
      elemID: objectTypeElemId,
      fields: {
        lookup: lookupField,
      },
      annotations: {
        label: 'test label',
        [Type.SERVICE_ID]: mockObjectApiName,
        [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
      },
    })
    const origAfterObject = origBeforeObject.clone()
    origAfterObject.fields.lookup
      .annotations[constants.FIELD_ANNOTATIONS.LOOKUP_FILTER] = lookupFilter

    const { client } = mockClient()
    const filter = filterCreator({ client }) as FilterWith<'onUpdate'>
    const updateSpy = jest.spyOn(client, 'update').mockImplementation(() => [])
    beforeEach(() => {
      beforeObject = origBeforeObject.clone()
      afterObject = origAfterObject.clone()
      updateSpy.mockReset()
    })

    it('should add lookupFilter data to a customField with lookupFilter upon the lookup customField creation', () => {
      delete beforeObject.fields.lookup
      filter.onUpdate(beforeObject, afterObject,
        [{ action: 'add', data: { after: afterObject.fields.lookup } }])
      expect(updateSpy).toHaveBeenCalledWith(constants.CUSTOM_FIELD, [expect.objectContaining(
        {
          lookupFilter: {
            active: true,
            booleanFilter: '1 OR 2',
            errorMessage: 'This is the Error message',
            infoMessage: 'This is the Info message',
            isOptional: false,
            filterItems: [
              {
                field: 'Case.OwnerId',
                operation: 'equals',
                valueField: '$User.Id',
              },
              {
                field: 'Case.ParentId',
                operation: 'equals',
                valueField: '$User.Id',
              },
            ],
          },
        }
      )])
    })

    it('should add lookupFilter data to a customField with lookupFilter upon the lookup customField update', () => {
      filter.onUpdate(beforeObject, afterObject, [{ action: 'modify',
        data: { before: beforeObject.fields.lookup, after: afterObject.fields.lookup } }])
      expect(updateSpy).toHaveBeenCalledWith(constants.CUSTOM_FIELD, [expect.objectContaining(
        {
          lookupFilter: {
            active: true,
            booleanFilter: '1 OR 2',
            errorMessage: 'This is the Error message',
            infoMessage: 'This is the Info message',
            isOptional: false,
            filterItems: [
              {
                field: 'Case.OwnerId',
                operation: 'equals',
                valueField: '$User.Id',
              },
              {
                field: 'Case.ParentId',
                operation: 'equals',
                valueField: '$User.Id',
              },
            ],
          },
        }
      )])
    })

    it('should ignore lookupFilter for fields with no lookupFilter upon the customField update', () => {
      delete beforeObject.fields.lookup.annotations[constants.FIELD_ANNOTATIONS.LOOKUP_FILTER]
      delete afterObject.fields.lookup.annotations[constants.FIELD_ANNOTATIONS.LOOKUP_FILTER]
      filter.onUpdate(beforeObject, afterObject, [{ action: 'modify',
        data: { before: beforeObject.fields.lookup, after: afterObject.fields.lookup } }])
      expect(updateSpy).not.toHaveBeenCalled()
    })

    it('should ignore lookupFilter for non objectType', () => {
      filter.onUpdate(new InstanceElement(objectTypeElemId, beforeObject, {}),
        new InstanceElement(objectTypeElemId, afterObject, {}), [])
      expect(updateSpy).not.toHaveBeenCalled()
    })
  })
})
