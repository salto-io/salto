/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

import {
  parseCustomLabel, parseCustomMetadata, parseCustomSetting,
  parseField, parseObject, parseObjectType, parseFormulaIdentifier,
} from '../../../src/filters/formula_utils/parse'

describe('Formula identifier parsing', () => {
  it('Should parse custom fields correctly', () => {
    const value = parseField('My_text_field__c', 'Account')

    expect(value).toHaveProperty('instance', 'Account.My_text_field__c')
    expect(value).toHaveProperty('type', 'customField')
  })

  it('Should parse standard fields correctly', () => {
    const value = parseField('Industry', 'Account')

    expect(value).toHaveProperty('instance', 'Account.Industry')
    expect(value).toHaveProperty('type', 'standardField')
  })

  it('Should parse custom metadata correctly', () => {
    const field = '$CustomMetadata.Trigger_Context_Status__mdt.SRM_Metadata_c.Enable_After_Insert__c'
    const value = parseCustomMetadata(field)

    expect(value.length).toBe(3)

    value.forEach(val => {
      if (val.type === 'customField') {
        expect(val.instance).toBe('Trigger_Context_Status__mdt.Enable_After_Insert__c')
      }

      if (val.type === 'customMetadataTypeRecord') {
        expect(val.instance).toBe('Trigger_Context_Status__mdt.SRM_Metadata_c')
      }

      if (val.type === 'customMetadataType') {
        expect(val.instance).toBe('Trigger_Context_Status__mdt')
      }
    })
  })

  it('Should parse custom labels correctly', () => {
    const value = parseCustomLabel('$Label.SomeName')

    expect(value[0]).toHaveProperty('instance', 'SomeName')
    expect(value[0]).toHaveProperty('type', 'customLabel')
  })

  it('Should parse custom settings correctly', () => {
    const types = parseCustomSetting('$Setup.My_Setting__c.my_field__c')

    const expected = [
      {
        type: 'customField',
        instance: 'My_Setting__c.my_field__c',
      },
      {
        type: 'customSetting',
        instance: 'My_Setting__c',
      },
    ]

    expect(types).toEqual(expect.arrayContaining(expected))
  })


  it('Should parse object types correctly', () => {
    const types = parseObjectType('$ObjectType.Center__c.Fields.My_text_field__c')

    const expected = [
      {
        instance: 'Center__c.My_text_field__c',
        type: 'customField',
      },
      {
        instance: 'Center__c',
        type: 'customObject',
      },
    ]

    expect(types).toEqual(expect.arrayContaining(expected))
  })

  describe('Objects', () => {
    it('Should parse standard objects correctly', () => {
      const result = parseObject('Account')

      const expected = {
        instance: 'Account',
        type: 'standardObject',
      }

      expect(result).toEqual(expected)
    })

    it('Should parse custom objects correctly', () => {
      const result = parseObject('Account__c')

      const expected = {
        instance: 'Account__c',
        type: 'customObject',
      }

      expect(result).toEqual(expected)
    })
  })
  describe('Fields', () => {
    const originalObject = 'Account'

    test('Passing a single STANDARD field name should return the same field, but with the original object as a prefix', () => {
      const types = parseFormulaIdentifier('Name', originalObject)

      const expected = [
        {
          type: 'standardField',
          instance: 'Account.Name',
        },
        {
          type: 'standardObject',
          instance: 'Account',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))
    })

    test('Passing a single CUSTOM field name should return the same field, but with the original object as a prefix', () => {
      const types = parseFormulaIdentifier('custom__C', 'lead__c')

      const expected = [
        {
          type: 'customField',
          instance: 'lead__c.custom__C',
        },
        {
          type: 'customObject',
          instance: 'lead__c',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))
    })

    test('Standard self-referential relationships should be converted back to their original type', () => {
      const types = parseFormulaIdentifier(
        'Opportunity.Account.Parent.Parent.Parent.Parent.pareNt.AccountNumber',
        'OpportunityLineItem'
      )

      const expected = [
        {
          type: 'standardField',
          instance: 'OpportunityLineItem.OpportunityId',
        },
        {
          type: 'standardField',
          instance: 'Opportunity.AccountId',
        },
        {
          type: 'standardField',
          instance: 'Account.ParentId',
        },
        {
          type: 'standardField',
          instance: 'Account.AccountNumber',
        },
        {
          type: 'standardObject',
          instance: 'OpportunityLineItem',
        },
        {
          type: 'standardObject',
          instance: 'Opportunity',
        },
        {
          type: 'standardObject',
          instance: 'Account',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))
    })

    test('STANDARD relationships should be converted to their original field name', () => {
      const types = parseFormulaIdentifier('Account.Opportunity.Custom__c', 'Contact')

      const expected = [
        {
          type: 'standardField',
          instance: 'Contact.AccountId',
        },
        {
          type: 'standardField',
          instance: 'Account.OpportunityId',
        },
        {
          type: 'customField',
          instance: 'Opportunity.Custom__c',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))
    })

    test('CUSTOM relationships should be converted to their original field name', () => {
      const types = parseFormulaIdentifier('Account.Opportunity__r.Name', 'Contact')

      const expected = [
        {
          type: 'standardField',
          instance: 'Contact.AccountId',
        },
        {
          type: 'customField',
          instance: 'Account.Opportunity__c',
        },
        {
          type: 'standardField',
          instance: 'Opportunity__r.Name',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))
    })

    test('A mix of custom and standard relationships should result in the same conversation seen in the previous 2 tests', () => {
      const types = parseFormulaIdentifier('Account.Opportunity__r.Asset.Contact.FirstName', 'Lead')

      const expected = [
        {
          type: 'standardField',
          instance: 'Lead.AccountId',
        },
        {
          type: 'customField',
          instance: 'Account.Opportunity__c',
        },
        {
          type: 'standardField',
          instance: 'Opportunity__r.AssetId',
        },
        {
          type: 'standardField',
          instance: 'Asset.ContactId',
        },
        {
          type: 'standardField',
          instance: 'Contact.FirstName',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))
    })

    test('A chain of custom relationships should be supported', () => {
      const types = parseFormulaIdentifier('Account.first__r.second__r.third__r.fourth__r.FirstName', 'Order')

      const expected = [
        {
          type: 'standardField',
          instance: 'Order.AccountId',
        },
        {
          type: 'customField',
          instance: 'Account.first__c',
        },
        {
          type: 'customField',
          instance: 'first__r.second__c',
        },
        {
          type: 'customField',
          instance: 'second__r.third__c',
        },
        {
          type: 'customField',
          instance: 'third__r.fourth__c',
        },
        {
          type: 'customField',
          instance: 'third__r.fourth__c',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))
    })

    test('User-related fields should be transformed to User.[field]', () => {
      const types = parseFormulaIdentifier('Account.Owner.Contact.Account.LastModifiedBy.Department', 'Order')

      const expected = [
        {
          type: 'standardField',
          instance: 'Order.AccountId',
        },
        {
          type: 'standardField',
          instance: 'Account.OwnerId',
        },
        {
          type: 'standardField',
          instance: 'User.ContactId',
        },
        {
          type: 'standardField',
          instance: 'Contact.AccountId',
        },
        {
          type: 'standardField',
          instance: 'Account.LastModifiedById',
        },
        {
          type: 'standardField',
          instance: 'User.Department',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))
    })

    test('Custom metadata fields should be parsed to both types and fields (custom fields)', () => {
      const types = parseFormulaIdentifier('$CustomMetadata.Trigger_Context_Status__mdt.SRM_Metadata_c.Enable_After_Insert__c', 'Case')

      const expected = [
        {
          type: 'customField',
          instance: 'Trigger_Context_Status__mdt.Enable_After_Insert__c',
        },
        {
          type: 'customMetadataTypeRecord',
          instance: 'Trigger_Context_Status__mdt.SRM_Metadata_c',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))
    })

    test('Custom metadata fields should be parsed to both types and fields (standard fields)', () => {
      const types = parseFormulaIdentifier('$CustomMetadata.Trigger_Context_Status__mdt.SRM_Metadata_c.QualifiedApiName', 'Case')

      const expected = [
        {
          type: 'standardField',
          instance: 'Trigger_Context_Status__mdt.QualifiedApiName',
        },
        {
          type: 'customMetadataTypeRecord',
          instance: 'Trigger_Context_Status__mdt.SRM_Metadata_c',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))
    })

    describe('Custom settings', () => {
      test('Custom Settings should be parsed as both a type and a field instance', () => {
        const types = parseFormulaIdentifier('$Setup.Customer_Support_Setting__c.Email_Address__c', 'Case')

        const expected = [
          {
            type: 'customField',
            instance: 'Customer_Support_Setting__c.Email_Address__c',
          },
          {
            type: 'customSetting',
            instance: 'Customer_Support_Setting__c',
          },
        ]

        expect(types).toEqual(expect.arrayContaining(expected))
      })

      test('Standard fields in custom settings', () => {
        const types = parseFormulaIdentifier('$Setup.Customer_Support_Setting__c.DeveloperName', 'Case')

        const expected = [
          {
            type: 'standardField',
            instance: 'Customer_Support_Setting__c.DeveloperName',
          },
          {
            type: 'customSetting',
            instance: 'Customer_Support_Setting__c',
          },
        ]

        expect(types).toEqual(expect.arrayContaining(expected))
      })
    })

    test('Custom Labels should be parsed to their API name', () => {
      const types = parseFormulaIdentifier('$Label.AWS_Access_Key', 'Case')

      const expected = [
        {
          type: 'customLabel',
          instance: 'AWS_Access_Key',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))

      const notExpected = [
        {
          type: 'standardField',
          instance: 'Case.LabelId',
        },
      ]

      expect(types).not.toEqual(expect.arrayContaining(notExpected))
    })

    test('Object Types should be parsed to their API name (standard fields)', () => {
      const types = parseFormulaIdentifier('$ObjectType.Center__c.Fields.CreatedDate', 'Case')

      const expected = [
        {
          type: 'standardField',
          instance: 'Center__c.CreatedDate',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))

      const notExpected = [
        {
          type: 'standardField',
          instance: 'Case.ObjectTypeId',
        },
      ]

      expect(types).not.toEqual(expect.arrayContaining(notExpected))
    })

    test('Object Types should be parsed to their API name (custom fields)', () => {
      const types = parseFormulaIdentifier('$ObjectType.Center__c.Fields.Custom__c', 'Case')

      const expected = [
        {
          type: 'customField',
          instance: 'Center__c.Custom__c',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))

      const notExpected = [
        {
          type: 'standardField',
          instance: 'Case.ObjectTypeId',
        },
      ]

      expect(types).not.toEqual(expect.arrayContaining(notExpected))
    })

    describe('Special objects', () => {
      test(`The $ prefix should be removed from special objects and  
      the resulting field should not be linked to the original object`, () => {
        const types = parseFormulaIdentifier('$User.Manager.Employee_Id__c', 'Case')

        const expected = [
          {
            type: 'standardField',
            instance: 'User.ManagerId',
          },
          {
            type: 'customField',
            instance: 'User.Employee_Id__c',
          },
        ]

        expect(types).toEqual(expect.arrayContaining(expected))

        const notExpected = [
          {
            type: 'standardField',
            instance: 'Case.UserId',
          },
        ]

        expect(types).not.toEqual(expect.arrayContaining(notExpected))
      })
      test('$Organization type', () => {
        const types = parseFormulaIdentifier('$Organization.TimeZone', 'Case')

        const expected = [
          {
            type: 'standardField',
            instance: 'Organization.TimeZone',
          },
        ]

        expect(types).toEqual(expect.arrayContaining(expected))

        const notExpected = [
          {
            type: 'standardField',
            instance: 'Case.OrganizationId',
          },
        ]

        expect(types).not.toEqual(expect.arrayContaining(notExpected))
      })
    })
  })
})
