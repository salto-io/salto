/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  ChangeGroupIdFunctionReturn,
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
  ADD_SBAA_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP,
  CPQ_PRICE_RULE,
  CPQ_CONDITIONS_MET,
  CPQ_PRICE_CONDITION,
  CPQ_PRICE_CONDITION_RULE_FIELD,
  ADD_CPQ_CUSTOM_PRICE_RULE_AND_CONDITION_GROUP,
  CPQ_PRODUCT_RULE,
  CPQ_ERROR_CONDITION,
  ADD_CPQ_CUSTOM_PRODUCT_RULE_AND_CONDITION_GROUP,
  CPQ_ERROR_CONDITION_RULE_FIELD,
} from '../src/constants'
import { getChangeGroupIds } from '../src/group_changes'
import { createInstanceElement } from '../src/transformers/transformer'
import { mockDefaultValues, mockTypes } from './mock_elements'

describe('Group changes function', () => {
  describe('when changes are not additions of sbaa__ApprovalRule__c and sbaa__ApprovalCondition__c', () => {
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
            [LABEL]: 'description label',
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
            [LABEL]: 'description label',
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
    const metadataInstance = createInstanceElement(
      mockDefaultValues.StaticResource,
      mockTypes.StaticResource,
    )
    let changeGroupIds: Map<ChangeId, ChangeGroupId>

    const addInstance = new InstanceElement('addInstance', customObject)
    const anotherAddInstance = new InstanceElement(
      'anotherAddInstance',
      customObject,
    )
    const differentAddInstance = new InstanceElement(
      'differentAddInstance',
      differentCustomObject,
    )

    const removeInstance = new InstanceElement('removeInstance', customObject)
    const anotherRemoveInstance = new InstanceElement(
      'anotherRemoveInstance',
      customObject,
    )
    const differentRemoveInstance = new InstanceElement(
      'differentRemoveInstance',
      differentCustomObject,
    )

    const modifyInstance = new InstanceElement('modifyInstance', customObject)
    const anotherModifyInstance = new InstanceElement(
      'anotherModifyInstance',
      customObject,
    )
    const differentModifyInstance = new InstanceElement(
      'differentModifyInstance',
      differentCustomObject,
    )

    beforeAll(async () => {
      changeGroupIds = (
        await getChangeGroupIds(
          new Map<string, Change>([
            [
              customObject.elemID.getFullName(),
              toChange({ after: customObject }),
            ],
            [
              metadataInstance.elemID.getFullName(),
              toChange({ before: metadataInstance }),
            ],
            [
              addInstance.elemID.getFullName(),
              toChange({ after: addInstance }),
            ],
            [
              anotherAddInstance.elemID.getFullName(),
              toChange({ after: anotherAddInstance }),
            ],
            [
              differentAddInstance.elemID.getFullName(),
              toChange({ after: differentAddInstance }),
            ],
            [
              removeInstance.elemID.getFullName(),
              toChange({ before: removeInstance }),
            ],
            [
              anotherRemoveInstance.elemID.getFullName(),
              toChange({ before: anotherRemoveInstance }),
            ],
            [
              differentRemoveInstance.elemID.getFullName(),
              toChange({ before: differentRemoveInstance }),
            ],
            [
              modifyInstance.elemID.getFullName(),
              toChange({ before: modifyInstance, after: modifyInstance }),
            ],
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
        expect(changeGroupIds.get(customObject.elemID.getFullName())).toEqual(
          'Salesforce Metadata',
        )
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
        expect(
          changeGroupIds.get(differentAddInstance.elemID.getFullName()),
        ).toEqual(
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
        expect(
          changeGroupIds.get(differentRemoveInstance.elemID.getFullName()),
        ).toEqual(
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
        expect(
          changeGroupIds.get(differentModifyInstance.elemID.getFullName()),
        ).toEqual(
          `Modification of data instances of type '${differentCustomObjectName}'`,
        )
      })
    })
  })
  describe('when changes are additions of sbaa__ApprovalRule__c and sbaa__ApprovalCondition__c', () => {
    let result: ChangeGroupIdFunctionReturn
    beforeEach(async () => {
      const customApprovalRule = new InstanceElement(
        'CustomApprovalRule',
        mockTypes.ApprovalRule,
        {
          [SBAA_CONDITIONS_MET]: 'Custom',
        },
      )
      const approvalRule = new InstanceElement(
        'ApprovalRule',
        mockTypes.ApprovalRule,
        {
          [SBAA_CONDITIONS_MET]: 'All',
        },
      )
      const customApprovalCondition = new InstanceElement(
        'CustomApprovalCondition',
        mockTypes.ApprovalCondition,
        {
          [SBAA_APPROVAL_RULE]: new ReferenceExpression(
            customApprovalRule.elemID,
            customApprovalRule,
          ),
        },
      )
      const approvalCondition = new InstanceElement(
        'ApprovalCondition',
        mockTypes.ApprovalCondition,
        {
          [SBAA_APPROVAL_RULE]: new ReferenceExpression(
            approvalRule.elemID,
            approvalRule,
          ),
        },
      )
      const addedInstances = [
        customApprovalRule,
        approvalRule,
        customApprovalCondition,
        approvalCondition,
      ]
      const changeMap = new Map<string, Change>()
      addedInstances.forEach((instance) => {
        changeMap.set(instance.elemID.name, toChange({ after: instance }))
      })
      result = await getChangeGroupIds(changeMap)
    })
    it('should create correct groups', () => {
      expect(result.changeGroupIdMap.get('CustomApprovalRule')).toEqual(
        ADD_SBAA_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP,
      )
      expect(result.changeGroupIdMap.get('CustomApprovalCondition')).toEqual(
        ADD_SBAA_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP,
      )
      expect(result.changeGroupIdMap.get('ApprovalRule')).toEqual(
        "Addition of data instances of type 'sbaa__ApprovalRule__c'",
      )
      expect(result.changeGroupIdMap.get('ApprovalCondition')).toEqual(
        "Addition of data instances of type 'sbaa__ApprovalCondition__c'",
      )
    })
  })
  describe('when changes are additions of SBQQ__PriceRule__c and SBQQ__PriceCondition__c', () => {
    let result: ChangeGroupIdFunctionReturn
    beforeEach(async () => {
      const customPriceRule = new InstanceElement(
        'CustomPriceRule',
        mockTypes[CPQ_PRICE_RULE],
        {
          [CPQ_CONDITIONS_MET]: 'Custom',
        },
      )
      const priceRule = new InstanceElement(
        'PriceRule',
        mockTypes[CPQ_PRICE_RULE],
        {
          [CPQ_CONDITIONS_MET]: 'All',
        },
      )
      const customPriceCondition = new InstanceElement(
        'CustomPriceCondition',
        mockTypes[CPQ_PRICE_CONDITION],
        {
          [CPQ_PRICE_CONDITION_RULE_FIELD]: new ReferenceExpression(
            customPriceRule.elemID,
            customPriceRule,
          ),
        },
      )
      const priceCondition = new InstanceElement(
        'PriceCondition',
        mockTypes[CPQ_PRICE_CONDITION],
        {
          [CPQ_PRICE_CONDITION_RULE_FIELD]: new ReferenceExpression(
            priceRule.elemID,
            priceRule,
          ),
        },
      )
      const addedInstances = [
        customPriceRule,
        priceRule,
        customPriceCondition,
        priceCondition,
      ]
      const changeMap = new Map<string, Change>()
      addedInstances.forEach((instance) => {
        changeMap.set(instance.elemID.name, toChange({ after: instance }))
      })
      result = await getChangeGroupIds(changeMap)
    })
    it('should create correct groups', () => {
      expect(result.changeGroupIdMap.get('CustomPriceRule')).toEqual(
        ADD_CPQ_CUSTOM_PRICE_RULE_AND_CONDITION_GROUP,
      )
      expect(result.changeGroupIdMap.get('CustomPriceCondition')).toEqual(
        ADD_CPQ_CUSTOM_PRICE_RULE_AND_CONDITION_GROUP,
      )
      expect(result.changeGroupIdMap.get('PriceRule')).toEqual(
        "Addition of data instances of type 'SBQQ__PriceRule__c'",
      )
      expect(result.changeGroupIdMap.get('PriceCondition')).toEqual(
        "Addition of data instances of type 'SBQQ__PriceCondition__c'",
      )
    })
  })
  describe('when changes are additions of SBQQ__ProductRule__c and SBQQ__ProductCondition__c', () => {
    let result: ChangeGroupIdFunctionReturn
    beforeEach(async () => {
      const customProductRule = new InstanceElement(
        'CustomProductRule',
        mockTypes[CPQ_PRODUCT_RULE],
        {
          [CPQ_CONDITIONS_MET]: 'Custom',
        },
      )
      const productRule = new InstanceElement(
        'ProductRule',
        mockTypes[CPQ_PRODUCT_RULE],
        {
          [CPQ_CONDITIONS_MET]: 'All',
        },
      )
      const customProductCondition = new InstanceElement(
        'CustomErrorCondition',
        mockTypes[CPQ_ERROR_CONDITION],
        {
          [CPQ_ERROR_CONDITION_RULE_FIELD]: new ReferenceExpression(
            customProductRule.elemID,
            customProductRule,
          ),
        },
      )
      const productCondition = new InstanceElement(
        'ErrorCondition',
        mockTypes[CPQ_ERROR_CONDITION],
        {
          [CPQ_ERROR_CONDITION_RULE_FIELD]: new ReferenceExpression(
            productRule.elemID,
            productRule,
          ),
        },
      )
      const addedInstances = [
        customProductRule,
        productRule,
        customProductCondition,
        productCondition,
      ]
      const changeMap = new Map<string, Change>()
      addedInstances.forEach((instance) => {
        changeMap.set(instance.elemID.name, toChange({ after: instance }))
      })
      result = await getChangeGroupIds(changeMap)
    })
    it('should create correct groups', () => {
      expect(result.changeGroupIdMap.get('CustomProductRule')).toEqual(
        ADD_CPQ_CUSTOM_PRODUCT_RULE_AND_CONDITION_GROUP,
      )
      expect(result.changeGroupIdMap.get('CustomErrorCondition')).toEqual(
        ADD_CPQ_CUSTOM_PRODUCT_RULE_AND_CONDITION_GROUP,
      )
      expect(result.changeGroupIdMap.get('ProductRule')).toEqual(
        "Addition of data instances of type 'SBQQ__ProductRule__c'",
      )
      expect(result.changeGroupIdMap.get('ErrorCondition')).toEqual(
        "Addition of data instances of type 'SBQQ__ErrorCondition__c'",
      )
    })
  })
})
