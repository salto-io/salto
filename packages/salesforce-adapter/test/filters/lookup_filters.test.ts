import {
  ElemID, Field, InstanceElement, ObjectType, PrimitiveType, PrimitiveTypes,
} from 'adapter-api'
import mockClient from '../client'
import filterCreator from '../../src/filters/lookup_filters'
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
