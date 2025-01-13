/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeGroupId,
  ChangeId,
  ElemID,
  InstanceElement,
  ObjectType,
  toChange,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  Change,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import {
  SALESFORCE,
  CUSTOM_OBJECT,
  API_NAME,
  METADATA_TYPE,
  LABEL,
  OBJECTS_PATH,
  SBAA_APPROVAL_RULE,
  SBAA_CONDITIONS_MET,
  CPQ_PRICE_RULE,
  CPQ_CONDITIONS_MET,
  CPQ_PRICE_CONDITION,
  CPQ_PRICE_CONDITION_RULE_FIELD,
  CPQ_PRODUCT_RULE,
  CPQ_ERROR_CONDITION,
  CPQ_ERROR_CONDITION_RULE_FIELD,
  CPQ_QUOTE_TERM,
  CPQ_TERM_CONDITION,
  CUSTOM_APPROVAL_RULE_AND_CONDITION,
  CUSTOM_PRICE_RULE_AND_CONDITION,
  CUSTOM_PRODUCT_RULE_AND_CONDITION,
  CUSTOM_QUOTE_TERM_AND_CONDITION,
  SBAA_APPROVAL_CONDITION,
  groupIdForInstanceChangeGroup,
} from '../src/constants'
import { getChangeGroupIds } from '../src/group_changes'
import { createInstanceElement } from '../src/transformers/transformer'
import { mockDefaultValues, mockTypes } from './mock_elements'

describe('Group changes function', () => {
  describe('when changes are not additions or removals of sbaa__ApprovalRule__c and sbaa__ApprovalCondition__c', () => {
    const customObjectName = 'objectName'
    const customObject = new ObjectType({
      elemID: new ElemID(SALESFORCE, customObjectName),
      annotations: {
        [API_NAME]: customObjectName,
        [METADATA_TYPE]: CUSTOM_OBJECT,
      },
      fields: {
        Name: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [LABEL]: 'groupName label',
            [API_NAME]: 'Name',
          },
        },
        TestField: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [LABEL]: 'Test field',
            [API_NAME]: 'TestField',
          },
        },
      },
      path: [SALESFORCE, OBJECTS_PATH, customObjectName],
    })
    const differentCustomObjectName = 'differentCustomObject'
    const differentCustomObject = new ObjectType({
      elemID: new ElemID(SALESFORCE, differentCustomObjectName),
      annotations: {
        [API_NAME]: differentCustomObjectName,
        [METADATA_TYPE]: CUSTOM_OBJECT,
      },
      fields: {
        Name: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [LABEL]: 'groupName label',
            [API_NAME]: 'Name',
          },
        },
        TestField: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [LABEL]: 'Test field',
            [API_NAME]: 'TestField',
          },
        },
      },
      path: [SALESFORCE, OBJECTS_PATH, differentCustomObjectName],
    })
    const metadataInstance = createInstanceElement(mockDefaultValues.StaticResource, mockTypes.StaticResource)
    let changeGroupIds: Map<ChangeId, ChangeGroupId>

    const addInstance = new InstanceElement('addInstance', customObject)
    const anotherAddInstance = new InstanceElement('anotherAddInstance', customObject)
    const differentAddInstance = new InstanceElement('differentAddInstance', differentCustomObject)

    const removeInstance = new InstanceElement('removeInstance', customObject)
    const anotherRemoveInstance = new InstanceElement('anotherRemoveInstance', customObject)
    const differentRemoveInstance = new InstanceElement('differentRemoveInstance', differentCustomObject)

    const modifyInstance = new InstanceElement('modifyInstance', customObject)
    const anotherModifyInstance = new InstanceElement('anotherModifyInstance', customObject)
    const differentModifyInstance = new InstanceElement('differentModifyInstance', differentCustomObject)

    beforeAll(async () => {
      changeGroupIds = (
        await getChangeGroupIds(
          new Map<string, Change>([
            [customObject.elemID.getFullName(), toChange({ after: customObject })],
            [metadataInstance.elemID.getFullName(), toChange({ before: metadataInstance })],
            [addInstance.elemID.getFullName(), toChange({ after: addInstance })],
            [anotherAddInstance.elemID.getFullName(), toChange({ after: anotherAddInstance })],
            [differentAddInstance.elemID.getFullName(), toChange({ after: differentAddInstance })],
            [removeInstance.elemID.getFullName(), toChange({ before: removeInstance })],
            [anotherRemoveInstance.elemID.getFullName(), toChange({ before: anotherRemoveInstance })],
            [differentRemoveInstance.elemID.getFullName(), toChange({ before: differentRemoveInstance })],
            [modifyInstance.elemID.getFullName(), toChange({ before: modifyInstance, after: modifyInstance })],
            [
              anotherModifyInstance.elemID.getFullName(),
              toChange({
                before: anotherModifyInstance,
                after: anotherModifyInstance,
              }),
            ],
            [
              differentModifyInstance.elemID.getFullName(),
              toChange({
                before: differentModifyInstance,
                after: differentModifyInstance,
              }),
            ],
          ]),
        )
      ).changeGroupIdMap
    })

    describe('groups of metadata', () => {
      it('should have one group for all metadata related changes', () => {
        expect(changeGroupIds.get(customObject.elemID.getFullName())).toEqual(
          changeGroupIds.get(metadataInstance.elemID.getFullName()),
        )
        expect(changeGroupIds.get(customObject.elemID.getFullName())).toEqual('Salesforce Metadata')
      })
    })

    describe('groups of add changes', () => {
      it('should have same group id for all adds of same custom object', () => {
        expect(changeGroupIds.get(addInstance.elemID.getFullName())).toEqual(
          changeGroupIds.get(anotherAddInstance.elemID.getFullName()),
        )
        expect(changeGroupIds.get(addInstance.elemID.getFullName())).toEqual(
          `Addition of data instances of type '${customObjectName}'`,
        )
      })

      it('should have a separate group for diff type', () => {
        expect(changeGroupIds.get(differentAddInstance.elemID.getFullName())).toEqual(
          `Addition of data instances of type '${differentCustomObjectName}'`,
        )
      })
    })

    describe('groups of remove changes', () => {
      it('should have same group id for all remove of same custom object', () => {
        expect(changeGroupIds.get(removeInstance.elemID.getFullName())).toEqual(
          changeGroupIds.get(anotherRemoveInstance.elemID.getFullName()),
        )
        expect(changeGroupIds.get(removeInstance.elemID.getFullName())).toEqual(
          `Removal of data instances of type '${customObjectName}'`,
        )
      })

      it('should have a separate group for diff type', () => {
        expect(changeGroupIds.get(differentRemoveInstance.elemID.getFullName())).toEqual(
          `Removal of data instances of type '${differentCustomObjectName}'`,
        )
      })
    })

    describe('groups of modify changes', () => {
      it('should have same group id for all modify of same custom object', () => {
        expect(changeGroupIds.get(modifyInstance.elemID.getFullName())).toEqual(
          changeGroupIds.get(anotherModifyInstance.elemID.getFullName()),
        )
        expect(changeGroupIds.get(modifyInstance.elemID.getFullName())).toEqual(
          `Modification of data instances of type '${customObjectName}'`,
        )
      })

      it('should have a separate group for diff type', () => {
        expect(changeGroupIds.get(differentModifyInstance.elemID.getFullName())).toEqual(
          `Modification of data instances of type '${differentCustomObjectName}'`,
        )
      })
    })
  })
  describe('Custom Rules And Condition Groups', () => {
    const createChangeMap = (instances: InstanceElement[], action: 'add' | 'remove'): Map<string, Change> => {
      const changeMap = new Map<string, Change>()
      instances.forEach(instance => {
        changeMap.set(instance.elemID.name, toChange(action === 'add' ? { after: instance } : { before: instance }))
      })
      return changeMap
    }

    const testCases = [
      {
        groupName: CUSTOM_APPROVAL_RULE_AND_CONDITION,
        ruleType: mockTypes.ApprovalRule,
        conditionType: mockTypes.ApprovalCondition,
        typeName: SBAA_APPROVAL_RULE,
        conditionName: SBAA_APPROVAL_CONDITION,
        customRuleField: SBAA_CONDITIONS_MET,
        customConditionField: SBAA_APPROVAL_RULE,
      },
      {
        groupName: CUSTOM_PRICE_RULE_AND_CONDITION,
        ruleType: mockTypes[CPQ_PRICE_RULE],
        conditionType: mockTypes[CPQ_PRICE_CONDITION],
        typeName: CPQ_PRICE_RULE,
        conditionName: CPQ_PRICE_CONDITION,
        customRuleField: CPQ_CONDITIONS_MET,
        customConditionField: CPQ_PRICE_CONDITION_RULE_FIELD,
      },
      {
        groupName: CUSTOM_PRODUCT_RULE_AND_CONDITION,
        ruleType: mockTypes[CPQ_PRODUCT_RULE],
        conditionType: mockTypes[CPQ_ERROR_CONDITION],
        typeName: CPQ_PRODUCT_RULE,
        conditionName: CPQ_ERROR_CONDITION,
        customRuleField: CPQ_CONDITIONS_MET,
        customConditionField: CPQ_ERROR_CONDITION_RULE_FIELD,
      },
      {
        groupName: CUSTOM_QUOTE_TERM_AND_CONDITION,
        ruleType: mockTypes[CPQ_QUOTE_TERM],
        conditionType: mockTypes[CPQ_TERM_CONDITION],
        typeName: CPQ_QUOTE_TERM,
        conditionName: CPQ_TERM_CONDITION,
        customRuleField: CPQ_CONDITIONS_MET,
        customConditionField: CPQ_QUOTE_TERM,
      },
    ]

    describe.each(testCases)(
      '$groupName',
      ({ groupName, ruleType, conditionType, typeName, conditionName, customRuleField, customConditionField }) => {
        let instances: InstanceElement[]
        let exptectedRemovalGroupName: string
        let expectedAdditionGroupName: string
        beforeEach(() => {
          const customRule = new InstanceElement('CustomRule', ruleType, {
            [customRuleField]: 'Custom',
          })
          const rule = new InstanceElement('Rule', ruleType, {
            [customRuleField]: 'All',
          })
          const customCondition = new InstanceElement('CustomCondition', conditionType, {
            [customConditionField]: new ReferenceExpression(customRule.elemID, customRule),
          })
          const condition = new InstanceElement('Condition', conditionType, {
            [customConditionField]: new ReferenceExpression(rule.elemID, rule),
          })
          instances = [customRule, rule, customCondition, condition]
          exptectedRemovalGroupName = groupIdForInstanceChangeGroup('remove', groupName)
          expectedAdditionGroupName = groupIdForInstanceChangeGroup('add', groupName)
        })
        describe('additions', () => {
          it('should create correct groups for additions', async () => {
            const result = await getChangeGroupIds(createChangeMap(instances, 'add'))
            expect(result.changeGroupIdMap.get('CustomRule')).toEqual(expectedAdditionGroupName)
            expect(result.changeGroupIdMap.get('CustomCondition')).toEqual(expectedAdditionGroupName)
            expect(result.changeGroupIdMap.get('Rule')).toEqual(`Addition of data instances of type '${typeName}'`)
            expect(result.changeGroupIdMap.get('Condition')).toEqual(
              `Addition of data instances of type '${conditionName}'`,
            )
          })
        })

        describe('removals', () => {
          it('should create correct groups for removals', async () => {
            const result = await getChangeGroupIds(createChangeMap(instances, 'remove'))
            expect(result.changeGroupIdMap.get('CustomRule')).toEqual(exptectedRemovalGroupName)
            expect(result.changeGroupIdMap.get('CustomCondition')).toEqual(exptectedRemovalGroupName)
            expect(result.changeGroupIdMap.get('Rule')).toEqual(`Removal of data instances of type '${typeName}'`)
            expect(result.changeGroupIdMap.get('Condition')).toEqual(
              `Removal of data instances of type '${conditionName}'`,
            )
          })
        })
      },
    )
  })
})
