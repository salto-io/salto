import {
  Element, ElemID, Field, InstanceElement, ObjectType, PrimitiveType, PrimitiveTypes, Values,
} from 'adapter-api'
import mockClient from '../client'
import filterCreator from '../../src/filters/lookup_filters'
import filterCreatorCustomObject, { INSTANCE_TYPE_FIELD } from '../../src/filters/custom_objects'
import { FilterWith } from '../../src/filter'
import * as constants from '../../src/constants'

describe('lookup filters filter', () => {
  const lookupType = new PrimitiveType({
    elemID: new ElemID(constants.SALESFORCE, constants.FIELD_TYPE_NAMES.LOOKUP),
    primitive: PrimitiveTypes.STRING,
  })
  const objectTypeElemId = new ElemID(constants.SALESFORCE, 'test')
  const lookupFieldApiName = 'LookupField__c'
  const mockObjectApiName = 'Test__c'

  describe('on fetch', () => {
    const lookupFilterInstanceElement = new InstanceElement('account', new ObjectType(
      { elemID: new ElemID(constants.SALESFORCE, constants.CUSTOM_OBJECT) }
    ),
    { fields: [{
      [constants.INSTANCE_FULL_NAME_FIELD]: 'lookup_field',
      [constants.LABEL]: 'My Lookup',
      [constants.FIELD_ANNOTATIONS.LOOKUP_FILTER]: {
        [constants.LOOKUP_FILTER_FIELDS.ACTIVE]: 'true',
        [constants.LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER]: 'myBooleanFilter',
        [constants.LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]: 'myErrorMessage',
        [constants.LOOKUP_FILTER_FIELDS.INFO_MESSAGE]: 'myInfoMessage',
        [constants.LOOKUP_FILTER_FIELDS.IS_OPTIONAL]: 'true',
        [constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS]: {
          [constants.FILTER_ITEM_FIELDS.FIELD]: 'myField1',
          [constants.FILTER_ITEM_FIELDS.OPERATION]: 'myOperation1',
          [constants.FILTER_ITEM_FIELDS.VALUE_FIELD]: 'myValueField1',
        },
      },
      [INSTANCE_TYPE_FIELD]: 'Lookup',
    }],
    [constants.INSTANCE_FULL_NAME_FIELD]: 'Account' })

    let testElements: Element[]
    const { client } = mockClient()
    let filter: FilterWith<'onFetch'>

    beforeEach(() => {
      testElements = [lookupFilterInstanceElement.clone()]
    })

    const initFilter = async (): Promise<void> => {
      filter = filterCreatorCustomObject({ client }) as FilterWith<'onFetch'>
      await filter.onFetch(testElements)
    }

    const verifyFilterItemsTransformation = (lookupFilterAnnotation: Values): void => {
      const { FILTER_ITEMS } = constants.LOOKUP_FILTER_FIELDS
      expect(lookupFilterAnnotation[FILTER_ITEMS]).toBeDefined()
      expect(lookupFilterAnnotation[FILTER_ITEMS]).toHaveLength(1)
      expect(lookupFilterAnnotation[FILTER_ITEMS][0][constants.FILTER_ITEM_FIELDS.FIELD])
        .toEqual('myField1')
      expect(lookupFilterAnnotation[FILTER_ITEMS][0][constants.FILTER_ITEM_FIELDS.OPERATION])
        .toEqual('myOperation1')
      expect(lookupFilterAnnotation[FILTER_ITEMS][0][constants.FILTER_ITEM_FIELDS.VALUE_FIELD])
        .toEqual('myValueField1')
      expect(lookupFilterAnnotation[FILTER_ITEMS][0][constants.FILTER_ITEM_FIELDS.VALUE])
        .toBeUndefined()
    }

    it('should add lookupFilter data to a field with lookupFilter when lookupFilter is optional', async () => {
      await initFilter()
      const lookupFilterAnnotation = (testElements[0] as ObjectType).fields.lookup_field
        .annotations[constants.FIELD_ANNOTATIONS.LOOKUP_FILTER]
      expect(lookupFilterAnnotation).toBeDefined()
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.ACTIVE]).toBe(true)
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER]).toEqual('myBooleanFilter')
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]).toBeUndefined()
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.INFO_MESSAGE]).toEqual('myInfoMessage')
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.IS_OPTIONAL]).toBe(true)
      verifyFilterItemsTransformation(lookupFilterAnnotation)
    })

    it('should add lookupFilter data to a field with lookupFilter when lookupFilter is not optional', async () => {
      (testElements[0] as InstanceElement).value
        .fields[0][constants
          .FIELD_ANNOTATIONS.LOOKUP_FILTER][constants.LOOKUP_FILTER_FIELDS.IS_OPTIONAL] = 'false'
      await initFilter()
      const lookupFilterAnnotation = (testElements[0] as ObjectType).fields.lookup_field
        .annotations[constants.FIELD_ANNOTATIONS.LOOKUP_FILTER]
      expect(lookupFilterAnnotation).toBeDefined()
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.ACTIVE]).toBe(true)
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER]).toEqual('myBooleanFilter')
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]).toEqual('myErrorMessage')
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.INFO_MESSAGE]).toEqual('myInfoMessage')
      expect(lookupFilterAnnotation[constants.LOOKUP_FILTER_FIELDS.IS_OPTIONAL]).toBe(false)
      verifyFilterItemsTransformation(lookupFilterAnnotation)
    })
  })

  describe('on add', () => {
    let mockObject: ObjectType
    const lookupField = new Field(objectTypeElemId, 'lookup_field', lookupType,
      {
        [constants.API_NAME]: lookupFieldApiName,
        [constants.FIELD_ANNOTATIONS.LOOKUP_FILTER]: {
          [constants.LOOKUP_FILTER_FIELDS.ACTIVE]: true,
          [constants.LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER]: '1 OR 2',
          [constants.LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]: 'This is the Error message',
          [constants.LOOKUP_FILTER_FIELDS.INFO_MESSAGE]: 'This is the Info message',
          [constants.LOOKUP_FILTER_FIELDS.IS_OPTIONAL]: false,
          [constants.LOOKUP_FILTER_FIELDS.FILTER_ITEMS]: [{
            [constants.FILTER_ITEM_FIELDS.FIELD]: 'Case.OwnerId',
            [constants.FILTER_ITEM_FIELDS.OPERATION]: 'equals',
            [constants.FILTER_ITEM_FIELDS.VALUE_FIELD]: '$User.Id',
          },
          {
            [constants.FILTER_ITEM_FIELDS.FIELD]: 'Case.ParentId',
            [constants.FILTER_ITEM_FIELDS.OPERATION]: 'equals',
            [constants.FILTER_ITEM_FIELDS.VALUE]: 'ParentIdValue',
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
        [constants.API_NAME]: mockObjectApiName,
        [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
      },
    })
    const { client } = mockClient()
    const filter = filterCreator({ client }) as FilterWith<'onAdd'>

    const updateSpy = jest.spyOn(client, 'update').mockImplementation(() => Promise.resolve([]))
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
                value: 'ParentIdValue',
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
      filter.onAdd(new InstanceElement('test', mockObject, {}))
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
        [constants.FILTER_ITEM_FIELDS.FIELD]: 'Case.OwnerId',
        [constants.FILTER_ITEM_FIELDS.OPERATION]: 'equals',
        [constants.FILTER_ITEM_FIELDS.VALUE_FIELD]: '$User.Id',
      },
      {
        [constants.FILTER_ITEM_FIELDS.FIELD]: 'Case.ParentId',
        [constants.FILTER_ITEM_FIELDS.OPERATION]: 'equals',
        [constants.FILTER_ITEM_FIELDS.VALUE]: 'ParentIdValue',
      }],
    }

    const lookupField = new Field(objectTypeElemId, 'lookup_field', lookupType,
      {
        [constants.API_NAME]: lookupFieldApiName,
      })

    const origBeforeObject = new ObjectType({
      elemID: objectTypeElemId,
      fields: {
        lookup: lookupField,
      },
      annotations: {
        label: 'test label',
        [constants.API_NAME]: mockObjectApiName,
        [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
      },
    })
    const origAfterObject = origBeforeObject.clone()
    origAfterObject.fields.lookup
      .annotations[constants.FIELD_ANNOTATIONS.LOOKUP_FILTER] = lookupFilter

    const { client } = mockClient()
    const filter = filterCreator({ client }) as FilterWith<'onUpdate'>
    const updateSpy = jest.spyOn(client, 'update').mockImplementation(() => Promise.resolve([]))
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
                value: 'ParentIdValue',
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
                value: 'ParentIdValue',
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
      filter.onUpdate(new InstanceElement('test', beforeObject, {}),
        new InstanceElement('test', afterObject, {}), [])
      expect(updateSpy).not.toHaveBeenCalled()
    })
  })
})
