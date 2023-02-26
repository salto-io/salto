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

import { isCustom, isStandardRelationship, isUserField, isCustomMetadata,
  isCustomLabel, isCustomSetting, isObjectType, isRelationshipField,
  isSpecialPrefix, isParent, isParentField } from '../../../src/filters/formula_utils/grammar'


describe('Formula grammar', () => {
  it('identify custom fields', () => {
    expect(isCustom('Account__C')).toBeTrue()
    expect(isCustom('AccountId')).toBeFalse()
  })

  it('identify standard relationships', () => {
    expect(isStandardRelationship('Account')).toBeTrue()
    expect(isStandardRelationship('Account__r')).toBeFalse()
    expect(isStandardRelationship('Lead__R')).toBeFalse()
  })

  it('Should identify user fields', () => {
    expect(isUserField('Owner.FirstName')).toBeTrue()
    expect(isUserField('Manager.FirstName')).toBeTrue()
    expect(isUserField('CreatedBy.FirstName')).toBeTrue()
    expect(isUserField('LastModifiedBY.FirstName')).toBeTrue()
    // upper case
    expect(isUserField('OWNER.FirstName')).toBeTrue()
    expect(isUserField('MANAger.FirstName')).toBeTrue()
    expect(isUserField('CREATEDBy.FirstName')).toBeTrue()
    expect(isUserField('lastmodifiEDBY.FirstName')).toBeTrue()
  })

  it('should identify custom metadata', () => {
    expect(isCustomMetadata('$CustomMetadata.Trigger_Context_Status__mdt.SRM_Metadata_c.Enable_After_Insert__c')).toBeTrue()
    // upper case
    expect(isCustomMetadata('$CustomMetadata.Trigger_Context_Status__mDT.SRM_Metadata_c.Enable_After_Insert__c')).toBeTrue()
  })

  it('Should identify custom labels', () => {
    expect(isCustomLabel('$Label.SomeName')).toBeTrue()
    // upper case
    expect(isCustomLabel('$LaBEL.SomeName')).toBeTrue()
  })

  it('Should identify custom settings', () => {
    expect(isCustomSetting('$Setup.SomeName')).toBeTrue()
    // upper case
    expect(isCustomSetting('$SeTUP.SomeName')).toBeTrue()
  })

  it('Should identify object types', () => {
    expect(isObjectType('$ObjectType.Center__c.Fields.My_text_field__c')).toBeTrue()
    // upper case
    expect(isObjectType('$ObjectTYPE.Center__c.Fields.My_text_field__c')).toBeTrue()
  })

  it('Should identify relationship fields', () => {
    expect(isRelationshipField('Account.Name')).toBeTrue()
    expect(isRelationshipField('Name')).toBeFalse()
  })

  it('Should identify special prefixes', () => {
    expect(isSpecialPrefix('$Organization')).toBeTrue()
    expect(isSpecialPrefix('$PROfile')).toBeTrue()
    expect(isSpecialPrefix('$ObjectType')).toBeFalse()
  })

  it('Should identify parent fields', () => {
    expect(isParentField('Account.Parent')).toBeFalse()
    expect(isParentField('Account.parEnTid')).toBeTrue()
  })

  test('Should identify parent relationships', () => {
    expect(isParent('ParentId')).toBeFalse()
    expect(isParent('Parent')).toBeTrue()
  })
})
