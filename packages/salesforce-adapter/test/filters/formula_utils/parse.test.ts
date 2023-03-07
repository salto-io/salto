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
  IdentifierType, parseCustomLabel, parseCustomMetadata, parseCustomSetting,
  parseField, parseObject, parseObjectType, parseFormulaIdentifier,
} from '../../../src/filters/formula_utils/parse'

describe('Formula identifier parsing', () => {
  it('Should parse custom fields correctly', () => {
    const value = parseField('My_text_field__c', 'Account')

    expect(value).toHaveProperty('instance', 'Account.My_text_field__c')
    expect(value).toHaveProperty('type', IdentifierType.CUSTOM_FIELD)
  })

  it('Should parse standard fields correctly', () => {
    const value = parseField('Industry', 'Account')

    expect(value).toHaveProperty('instance', 'Account.Industry')
    expect(value).toHaveProperty('type', IdentifierType.STANDARD_FIELD)
  })

  it('Should parse custom metadata correctly', () => {
    const field = '$CustomMetadata.Trigger_Context_Status__mdt.SRM_Metadata_c.Enable_After_Insert__c'
    const value = parseCustomMetadata(field)

    expect(value.length).toBe(3)

    value.forEach(val => {
      if (val.type === IdentifierType.CUSTOM_FIELD) {
        expect(val.instance).toBe('Trigger_Context_Status__mdt.Enable_After_Insert__c')
      }

      if (val.type === IdentifierType.CUSTOM_METADATA_TYPE_RECORD) {
        expect(val.instance).toBe('Trigger_Context_Status__mdt.SRM_Metadata_c')
      }

      if (val.type === IdentifierType.CUSTOM_METADATA_TYPE) {
        expect(val.instance).toBe('Trigger_Context_Status__mdt')
      }
    })
  })

  it('Should parse custom labels correctly', () => {
    const value = parseCustomLabel('$Label.SomeName')

    expect(value).toHaveProperty('instance', 'SomeName')
    expect(value).toHaveProperty('type', IdentifierType.CUSTOM_LABEL)
  })

  it('Should parse custom settings correctly', () => {
    const types = parseCustomSetting('$Setup.My_Setting__c.my_field__c')

    const expected = [
      {
        type: IdentifierType.CUSTOM_FIELD,
        instance: 'My_Setting__c.my_field__c',
      },
      {
        type: IdentifierType.CUSTOM_SETTING,
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
        type: IdentifierType.CUSTOM_FIELD,
      },
      {
        instance: 'Center__c',
        type: IdentifierType.CUSTOM_OBJECT,
      },
    ]

    expect(types).toEqual(expect.arrayContaining(expected))
  })

  describe('Objects', () => {
    it('Should parse standard objects correctly', () => {
      const result = parseObject('Account')

      const expected = {
        instance: 'Account',
        type: IdentifierType.STANDARD_OBJECT,
      }

      expect(result).toEqual(expected)
    })

    it('Should parse custom objects correctly', () => {
      const result = parseObject('Account__c')

      const expected = {
        instance: 'Account__c',
        type: IdentifierType.CUSTOM_OBJECT,
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
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Account.Name',
        },
        {
          type: IdentifierType.STANDARD_OBJECT,
          instance: 'Account',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))
    })

    test('Passing a single CUSTOM field name should return the same field, but with the original object as a prefix', () => {
      const types = parseFormulaIdentifier('custom__C', 'lead__c')

      const expected = [
        {
          type: IdentifierType.CUSTOM_FIELD,
          instance: 'lead__c.custom__C',
        },
        {
          type: IdentifierType.CUSTOM_OBJECT,
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
          type: IdentifierType.STANDARD_FIELD,
          instance: 'OpportunityLineItem.OpportunityId',
        },
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Opportunity.AccountId',
        },
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Account.ParentId',
        },
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Account.AccountNumber',
        },
        {
          type: IdentifierType.STANDARD_OBJECT,
          instance: 'OpportunityLineItem',
        },
        {
          type: IdentifierType.STANDARD_OBJECT,
          instance: 'Opportunity',
        },
        {
          type: IdentifierType.STANDARD_OBJECT,
          instance: 'Account',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))
    })

    test('STANDARD relationships should be converted to their original field name', () => {
      const types = parseFormulaIdentifier('Account.Opportunity.Custom__c', 'Contact')

      const expected = [
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Contact.AccountId',
        },
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Account.OpportunityId',
        },
        {
          type: IdentifierType.CUSTOM_FIELD,
          instance: 'Opportunity.Custom__c',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))
    })

    test('CUSTOM relationships should be converted to their original field name', () => {
      const types = parseFormulaIdentifier('Account.Opportunity__r.Name', 'Contact')

      const expected = [
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Contact.AccountId',
        },
        {
          type: IdentifierType.CUSTOM_FIELD,
          instance: 'Account.Opportunity__c',
        },
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Opportunity__r.Name',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))
    })

    test('A mix of custom and standard relationships should result in the same conversation seen in the previous 2 tests', () => {
      const types = parseFormulaIdentifier('Account.Opportunity__r.Asset.Contact.FirstName', 'Lead')

      const expected = [
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Lead.AccountId',
        },
        {
          type: IdentifierType.CUSTOM_FIELD,
          instance: 'Account.Opportunity__c',
        },
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Opportunity__r.AssetId',
        },
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Asset.ContactId',
        },
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Contact.FirstName',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))
    })

    test('A chain of custom relationships should be supported', () => {
      const types = parseFormulaIdentifier('Account.first__r.second__r.third__r.fourth__r.FirstName', 'Order')

      const expected = [
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Order.AccountId',
        },
        {
          type: IdentifierType.CUSTOM_FIELD,
          instance: 'Account.first__c',
        },
        {
          type: IdentifierType.CUSTOM_FIELD,
          instance: 'first__r.second__c',
        },
        {
          type: IdentifierType.CUSTOM_FIELD,
          instance: 'second__r.third__c',
        },
        {
          type: IdentifierType.CUSTOM_FIELD,
          instance: 'third__r.fourth__c',
        },
        {
          type: IdentifierType.CUSTOM_FIELD,
          instance: 'third__r.fourth__c',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))
    })

    test('User-related fields should be transformed to User.[field]', () => {
      const types = parseFormulaIdentifier('Account.Owner.Contact.Account.LastModifiedBy.Department', 'Order')

      const expected = [
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Order.AccountId',
        },
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Account.OwnerId',
        },
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'User.ContactId',
        },
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Contact.AccountId',
        },
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Account.LastModifiedById',
        },
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'User.Department',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))
    })

    test('Custom metadata fields should be parsed to both types and fields (custom fields)', () => {
      const types = parseFormulaIdentifier('$CustomMetadata.Trigger_Context_Status__mdt.SRM_Metadata_c.Enable_After_Insert__c', 'Case')

      const expected = [
        {
          type: IdentifierType.CUSTOM_FIELD,
          instance: 'Trigger_Context_Status__mdt.Enable_After_Insert__c',
        },
        {
          type: IdentifierType.CUSTOM_METADATA_TYPE_RECORD,
          instance: 'Trigger_Context_Status__mdt.SRM_Metadata_c',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))
    })

    test('Custom metadata fields should be parsed to both types and fields (standard fields)', () => {
      const types = parseFormulaIdentifier('$CustomMetadata.Trigger_Context_Status__mdt.SRM_Metadata_c.QualifiedApiName', 'Case')

      const expected = [
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Trigger_Context_Status__mdt.QualifiedApiName',
        },
        {
          type: IdentifierType.CUSTOM_METADATA_TYPE_RECORD,
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
            type: IdentifierType.CUSTOM_FIELD,
            instance: 'Customer_Support_Setting__c.Email_Address__c',
          },
          {
            type: IdentifierType.CUSTOM_SETTING,
            instance: 'Customer_Support_Setting__c',
          },
        ]

        expect(types).toEqual(expect.arrayContaining(expected))
      })

      test('Standard fields in custom settings', () => {
        const types = parseFormulaIdentifier('$Setup.Customer_Support_Setting__c.DeveloperName', 'Case')

        const expected = [
          {
            type: IdentifierType.STANDARD_FIELD,
            instance: 'Customer_Support_Setting__c.DeveloperName',
          },
          {
            type: IdentifierType.CUSTOM_SETTING,
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
          type: IdentifierType.CUSTOM_LABEL,
          instance: 'AWS_Access_Key',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))

      const notExpected = [
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Case.LabelId',
        },
      ]

      expect(types).not.toEqual(expect.arrayContaining(notExpected))
    })

    test('Object Types should be parsed to their API name (standard fields)', () => {
      const types = parseFormulaIdentifier('$ObjectType.Center__c.Fields.CreatedDate', 'Case')

      const expected = [
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Center__c.CreatedDate',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))

      const notExpected = [
        {
          type: IdentifierType.STANDARD_FIELD,
          instance: 'Case.ObjectTypeId',
        },
      ]

      expect(types).not.toEqual(expect.arrayContaining(notExpected))
    })

    test('Object Types should be parsed to their API name (custom fields)', () => {
      const types = parseFormulaIdentifier('$ObjectType.Center__c.Fields.Custom__c', 'Case')

      const expected = [
        {
          type: IdentifierType.CUSTOM_FIELD,
          instance: 'Center__c.Custom__c',
        },
      ]

      expect(types).toEqual(expect.arrayContaining(expected))

      const notExpected = [
        {
          type: IdentifierType.STANDARD_FIELD,
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
            type: IdentifierType.STANDARD_FIELD,
            instance: 'User.ManagerId',
          },
          {
            type: IdentifierType.CUSTOM_FIELD,
            instance: 'User.Employee_Id__c',
          },
        ]

        expect(types).toEqual(expect.arrayContaining(expected))

        const notExpected = [
          {
            type: IdentifierType.STANDARD_FIELD,
            instance: 'Case.UserId',
          },
        ]

        expect(types).not.toEqual(expect.arrayContaining(notExpected))
      })
      test('$Organization type', () => {
        const types = parseFormulaIdentifier('$Organization.TimeZone', 'Case')

        const expected = [
          {
            type: IdentifierType.STANDARD_FIELD,
            instance: 'Organization.TimeZone',
          },
        ]

        expect(types).toEqual(expect.arrayContaining(expected))

        const notExpected = [
          {
            type: IdentifierType.STANDARD_FIELD,
            instance: 'Case.OrganizationId',
          },
        ]

        expect(types).not.toEqual(expect.arrayContaining(notExpected))
      })
    })
  })
})
