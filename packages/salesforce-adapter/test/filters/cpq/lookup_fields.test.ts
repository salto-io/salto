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
  ObjectType,
  ElemID,
  Element,
  ReferenceExpression,
  isObjectType,
  ChangeDataType,
  Change,
  toChange,
  AdditionChange,
  ModificationChange,
  getChangeData,
  Field,
} from '@salto-io/adapter-api'
import filterCreator from '../../../src/filters/cpq/lookup_fields'
import {
  SALESFORCE,
  CPQ_PRODUCT_RULE,
  CPQ_LOOKUP_OBJECT_NAME,
  API_NAME,
  METADATA_TYPE,
  CUSTOM_OBJECT,
  FIELD_ANNOTATIONS,
  CPQ_CONFIGURATION_ATTRIBUTE,
  CPQ_DEFAULT_OBJECT_FIELD,
  CPQ_QUOTE_NO_PRE,
  CPQ_QUOTE,
  CPQ_ACCOUNT,
  CPQ_PRICE_SCHEDULE,
  CPQ_CONSTRAINT_FIELD,
  CPQ_ACCOUNT_NO_PRE,
} from '../../../src/constants'
import { Types } from '../../../src/transformers/transformer'
import { defaultFilterContext } from '../../utils'
import { FilterWith } from '../mocks'

describe('lookup_object filter', () => {
  type FilterType = FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
  let filter: FilterType
  let elements: Element[]
  const existingObjectName = 'existingObject'
  const existingFieldName = 'existingField'
  const mockObjectElemID = new ElemID(SALESFORCE, existingObjectName)
  const mockObject = new ObjectType({
    elemID: mockObjectElemID,
    annotations: {
      [API_NAME]: existingObjectName,
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
  })
  const mockQuoteElemID = new ElemID(SALESFORCE, CPQ_QUOTE)
  const mockQuote = new ObjectType({
    elemID: mockQuoteElemID,
    fields: {
      [CPQ_ACCOUNT]: {
        refType: Types.primitiveDataTypes.Text,
        annotations: {
          [API_NAME]: `${CPQ_QUOTE}.${CPQ_ACCOUNT}`,
        },
      },
      [existingFieldName]: {
        refType: Types.primitiveDataTypes.Text,
        annotations: {
          [API_NAME]: `${CPQ_QUOTE}.${existingFieldName}`,
        },
      },
    },
    annotations: {
      [API_NAME]: CPQ_QUOTE,
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
  })
  const mockProductRuleElemID = new ElemID(SALESFORCE, CPQ_PRODUCT_RULE)
  const mockProductRuleObject = new ObjectType({
    elemID: mockProductRuleElemID,
    fields: {
      [CPQ_LOOKUP_OBJECT_NAME]: {
        refType: Types.primitiveDataTypes.Picklist,
        annotations: {
          [API_NAME]: `${CPQ_PRODUCT_RULE}.${CPQ_LOOKUP_OBJECT_NAME}`,
          valueSet: [
            {
              fullName: existingObjectName,
            },
            {
              fullName: 'nonExistingObject',
            },
          ],
        },
      },
    },
    annotations: {
      [API_NAME]: CPQ_PRODUCT_RULE,
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
  })
  const mockConfigurationAttributeElemID = new ElemID(
    SALESFORCE,
    CPQ_CONFIGURATION_ATTRIBUTE,
  )
  const mockConfigurationAttribute = new ObjectType({
    elemID: mockConfigurationAttributeElemID,
    fields: {
      [CPQ_DEFAULT_OBJECT_FIELD]: {
        refType: Types.primitiveDataTypes.Picklist,
        annotations: {
          [API_NAME]: `${CPQ_CONFIGURATION_ATTRIBUTE}.${CPQ_DEFAULT_OBJECT_FIELD}`,
          valueSet: [
            {
              fullName: CPQ_QUOTE_NO_PRE,
            },
            {
              fullName: existingObjectName,
            },
            {
              fullName: 'nonExistingObject',
            },
          ],
        },
      },
    },
    annotations: {
      [API_NAME]: CPQ_CONFIGURATION_ATTRIBUTE,
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
  })

  const mockPriceScheduleElemID = new ElemID(SALESFORCE, CPQ_PRICE_SCHEDULE)
  const mockPriceSchedule = new ObjectType({
    elemID: mockPriceScheduleElemID,
    fields: {
      [CPQ_CONSTRAINT_FIELD]: {
        refType: Types.primitiveDataTypes.Picklist,
        annotations: {
          [API_NAME]: `${CPQ_PRICE_SCHEDULE}.${CPQ_CONSTRAINT_FIELD}`,
          valueSet: [
            {
              fullName: CPQ_ACCOUNT_NO_PRE,
            },
            {
              fullName: existingFieldName,
            },
            {
              fullName: 'nonExistingField',
            },
          ],
        },
      },
    },
    annotations: {
      [API_NAME]: CPQ_PRICE_SCHEDULE,
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
  })

  describe('onFetch', () => {
    beforeAll(async () => {
      filter = filterCreator({ config: defaultFilterContext }) as FilterType
      elements = [
        mockObject.clone(),
        mockProductRuleObject.clone(),
        mockConfigurationAttribute.clone(),
        mockPriceSchedule.clone(),
        mockQuote.clone(),
      ]
      await filter.onFetch(elements)
    })

    it('Should not add or remove elements', () => {
      expect(elements).toHaveLength(5)
      expect(
        elements.find((e) => e.elemID.isEqual(mockObjectElemID)),
      ).toBeDefined()
      expect(
        elements.find((e) => e.elemID.isEqual(mockProductRuleElemID)),
      ).toBeDefined()
      expect(
        elements.find((e) =>
          e.elemID.isEqual(mockConfigurationAttributeElemID),
        ),
      ).toBeDefined()
      expect(
        elements.find((e) => e.elemID.isEqual(mockPriceScheduleElemID)),
      ).toBeDefined()
      expect(
        elements.find((e) => e.elemID.isEqual(mockQuoteElemID)),
      ).toBeDefined()
    })

    it('Should not change elements not defined as ones with lookup', () => {
      expect(
        elements.find((e) => e.elemID.isEqual(mockObjectElemID)),
      ).toStrictEqual(mockObject)
      expect(
        elements.find((e) => e.elemID.isEqual(mockQuoteElemID)),
      ).toStrictEqual(mockQuote)
    })

    describe('Object looking with no valuesMapping defined', () => {
      it('Should change lookup field value set fullName value to a ref if custom object exists and keep string if not', () => {
        const mockProductElm = elements.find((e) =>
          e.elemID.isEqual(mockProductRuleElemID),
        )
        expect(mockProductElm).toBeDefined()
        expect(isObjectType(mockProductElm)).toBeTruthy()
        const lookupObjetField = (mockProductElm as ObjectType).fields[
          CPQ_LOOKUP_OBJECT_NAME
        ]
        expect(lookupObjetField).toBeDefined()
        expect(
          lookupObjetField.annotations[FIELD_ANNOTATIONS.VALUE_SET][0].fullName,
        ).toEqual(new ReferenceExpression(mockObjectElemID))
        expect(
          lookupObjetField.annotations[FIELD_ANNOTATIONS.VALUE_SET][1].fullName,
        ).toEqual('nonExistingObject')
      })
    })

    describe('Object lookup with valuesMapping defined', () => {
      it('Should change lookup field value set fullName value to a ref if custom object exists (mapped and not) and keep string if not', () => {
        const mockConfigurationAttr = elements.find((e) =>
          e.elemID.isEqual(mockConfigurationAttributeElemID),
        )
        expect(mockConfigurationAttr).toBeDefined()
        expect(isObjectType(mockConfigurationAttr)).toBeTruthy()
        const defaultObjectField = (mockConfigurationAttr as ObjectType).fields[
          CPQ_DEFAULT_OBJECT_FIELD
        ]
        expect(defaultObjectField).toBeDefined()
        expect(
          defaultObjectField.annotations[FIELD_ANNOTATIONS.VALUE_SET][0]
            .fullName,
        ).toEqual(new ReferenceExpression(mockQuoteElemID))
        expect(
          defaultObjectField.annotations[FIELD_ANNOTATIONS.VALUE_SET][1]
            .fullName,
        ).toEqual(new ReferenceExpression(mockObjectElemID))
        expect(
          defaultObjectField.annotations[FIELD_ANNOTATIONS.VALUE_SET][2]
            .fullName,
        ).toEqual('nonExistingObject')
      })
    })

    describe('Field lookup with valuesMapping defined', () => {
      it('Should change lookup field value set fullName value to a ref if custom field exists (mapped and not) and keep string if not', () => {
        const priceScheduling = elements.find((e) =>
          e.elemID.isEqual(mockPriceScheduleElemID),
        )
        expect(priceScheduling).toBeDefined()
        expect(isObjectType(priceScheduling)).toBeTruthy()
        const constraintFieldField = (priceScheduling as ObjectType).fields[
          CPQ_CONSTRAINT_FIELD
        ]
        expect(constraintFieldField).toBeDefined()
        expect(
          constraintFieldField.annotations[FIELD_ANNOTATIONS.VALUE_SET][0]
            .fullName,
        ).toEqual(new ReferenceExpression(mockQuote.fields[CPQ_ACCOUNT].elemID))
        expect(
          constraintFieldField.annotations[FIELD_ANNOTATIONS.VALUE_SET][1]
            .fullName,
        ).toEqual(
          new ReferenceExpression(mockQuote.fields[existingFieldName].elemID),
        )
        expect(
          constraintFieldField.annotations[FIELD_ANNOTATIONS.VALUE_SET][2]
            .fullName,
        ).toEqual('nonExistingField')
      })
    })
  })

  describe('preDeploy', () => {
    let changes: Change<ChangeDataType>[]
    const mockAfterResolveConfigurationAttribute = new ObjectType({
      elemID: mockConfigurationAttributeElemID,
      fields: {
        [CPQ_DEFAULT_OBJECT_FIELD]: {
          refType: Types.primitiveDataTypes.Picklist,
          annotations: {
            [API_NAME]: `${CPQ_CONFIGURATION_ATTRIBUTE}.${CPQ_DEFAULT_OBJECT_FIELD}`,
            valueSet: [
              {
                fullName: CPQ_QUOTE,
              },
              {
                fullName: existingObjectName,
              },
              {
                fullName: 'nonExistingObject',
              },
            ],
          },
        },
      },
      annotations: {
        [API_NAME]: CPQ_CONFIGURATION_ATTRIBUTE,
        [METADATA_TYPE]: CUSTOM_OBJECT,
      },
    })
    const mockAfterResolvePriceSchedule = new ObjectType({
      elemID: mockPriceScheduleElemID,
      fields: {
        [CPQ_CONSTRAINT_FIELD]: {
          refType: Types.primitiveDataTypes.Picklist,
          annotations: {
            [API_NAME]: `${CPQ_PRICE_SCHEDULE}.${CPQ_CONSTRAINT_FIELD}`,
            valueSet: [
              {
                fullName: CPQ_ACCOUNT,
              },
              {
                fullName: existingFieldName,
              },
              {
                fullName: 'nonExistingField',
              },
            ],
          },
        },
      },
      annotations: {
        [API_NAME]: CPQ_PRICE_SCHEDULE,
        [METADATA_TYPE]: CUSTOM_OBJECT,
      },
    })
    describe('Modification changes', () => {
      beforeAll(async () => {
        changes = [
          toChange({
            before: mockAfterResolveConfigurationAttribute.clone(),
            after: mockAfterResolveConfigurationAttribute.clone(),
          }),
          toChange({
            before:
              mockAfterResolveConfigurationAttribute.clone().fields[
                CPQ_DEFAULT_OBJECT_FIELD
              ],
            after:
              mockAfterResolveConfigurationAttribute.clone().fields[
                CPQ_DEFAULT_OBJECT_FIELD
              ],
          }),
          toChange({
            before: mockAfterResolvePriceSchedule.clone(),
            after: mockAfterResolvePriceSchedule.clone(),
          }),
          toChange({
            before:
              mockAfterResolvePriceSchedule.clone().fields[
                CPQ_CONSTRAINT_FIELD
              ],
            after:
              mockAfterResolvePriceSchedule.clone().fields[
                CPQ_CONSTRAINT_FIELD
              ],
          }),
        ]
        await filter.preDeploy(changes)
      })
      describe('Object lookup', () => {
        it('Should not change in object modifications', () => {
          const configAttrChange = changes.find((change) =>
            getChangeData(change).elemID.isEqual(
              mockConfigurationAttributeElemID,
            ),
          )
          expect(configAttrChange).toBeDefined()
          const afterData = (configAttrChange as ModificationChange<ObjectType>)
            .data.after
          expect(
            afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[0]
              .fullName,
          ).toEqual(
            mockAfterResolveConfigurationAttribute.fields[
              CPQ_DEFAULT_OBJECT_FIELD
            ].annotations.valueSet[0].fullName,
          )
          expect(
            afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[1]
              .fullName,
          ).toEqual(
            mockAfterResolveConfigurationAttribute.fields[
              CPQ_DEFAULT_OBJECT_FIELD
            ].annotations.valueSet[1].fullName,
          )
          expect(
            afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[2]
              .fullName,
          ).toEqual(
            mockAfterResolveConfigurationAttribute.fields[
              CPQ_DEFAULT_OBJECT_FIELD
            ].annotations.valueSet[2].fullName,
          )
        })
        it('Should in fields modifications map back to the service name instead of api if theres mapping and keep same if not', () => {
          const configAttrFieldChange = changes.find((change) =>
            getChangeData(change).elemID.isEqual(
              mockConfigurationAttribute.fields[CPQ_DEFAULT_OBJECT_FIELD]
                .elemID,
            ),
          )
          expect(configAttrFieldChange).toBeDefined()
          const afterData = (configAttrFieldChange as ModificationChange<Field>)
            .data.after
          expect(afterData.annotations.valueSet[0].fullName).toEqual(
            CPQ_QUOTE_NO_PRE,
          )
          expect(afterData.annotations.valueSet[1].fullName).toEqual(
            existingObjectName,
          )
          expect(afterData.annotations.valueSet[2].fullName).toEqual(
            'nonExistingObject',
          )
        })
      })
      describe('Field lookup', () => {
        it('Should not change in object modifications', () => {
          const priceSchedulingChange = changes.find((change) =>
            getChangeData(change).elemID.isEqual(mockPriceScheduleElemID),
          )
          expect(priceSchedulingChange).toBeDefined()
          const afterData = (
            priceSchedulingChange as ModificationChange<ObjectType>
          ).data.after
          expect(
            afterData.fields[CPQ_CONSTRAINT_FIELD].annotations.valueSet[0]
              .fullName,
          ).toEqual(
            mockAfterResolvePriceSchedule.fields[CPQ_CONSTRAINT_FIELD]
              .annotations.valueSet[0].fullName,
          )
          expect(
            afterData.fields[CPQ_CONSTRAINT_FIELD].annotations.valueSet[1]
              .fullName,
          ).toEqual(
            mockAfterResolvePriceSchedule.fields[CPQ_CONSTRAINT_FIELD]
              .annotations.valueSet[1].fullName,
          )
          expect(
            afterData.fields[CPQ_CONSTRAINT_FIELD].annotations.valueSet[2]
              .fullName,
          ).toEqual(
            mockAfterResolvePriceSchedule.fields[CPQ_CONSTRAINT_FIELD]
              .annotations.valueSet[2].fullName,
          )
        })
        it('Should in field modigication map back to the service name instead of api if theres mapping and keep same if not', () => {
          const priceSchedulingFieldChange = changes.find((change) =>
            getChangeData(change).elemID.isEqual(
              mockPriceSchedule.fields[CPQ_CONSTRAINT_FIELD].elemID,
            ),
          )
          expect(priceSchedulingFieldChange).toBeDefined()
          const afterData = (
            priceSchedulingFieldChange as ModificationChange<Field>
          ).data.after
          expect(afterData.annotations.valueSet[0].fullName).toEqual(
            CPQ_ACCOUNT_NO_PRE,
          )
          expect(afterData.annotations.valueSet[1].fullName).toEqual(
            existingFieldName,
          )
          expect(afterData.annotations.valueSet[2].fullName).toEqual(
            'nonExistingField',
          )
        })
      })
    })
    describe('Addition changes', () => {
      beforeAll(async () => {
        changes = [
          toChange({
            after: mockAfterResolveConfigurationAttribute.clone(),
          }),
          toChange({
            after: mockAfterResolvePriceSchedule.clone(),
          }),
        ]
        await filter.preDeploy(changes)
      })
      describe('Object lookup', () => {
        it('Should map back to the service name instead of api if theres mapping and keep same if not', () => {
          const configAttrChange = changes.find((change) =>
            getChangeData(change).elemID.isEqual(
              mockConfigurationAttributeElemID,
            ),
          )
          const afterData = (configAttrChange as AdditionChange<ObjectType>)
            .data.after
          expect(
            afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[0]
              .fullName,
          ).toEqual(CPQ_QUOTE_NO_PRE)
          expect(
            afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[1]
              .fullName,
          ).toEqual(existingObjectName)
          expect(
            afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[2]
              .fullName,
          ).toEqual('nonExistingObject')
        })
      })
      describe('Field lookup', () => {
        it('Should map back to the service name instead of api if theres mapping and keep same if not', () => {
          const priceSchedulingChange = changes.find((change) =>
            getChangeData(change).elemID.isEqual(mockPriceScheduleElemID),
          )
          expect(priceSchedulingChange).toBeDefined()
          const afterData = (
            priceSchedulingChange as AdditionChange<ObjectType>
          ).data.after
          expect(
            afterData.fields[CPQ_CONSTRAINT_FIELD].annotations.valueSet[0]
              .fullName,
          ).toEqual(CPQ_ACCOUNT_NO_PRE)
          expect(
            afterData.fields[CPQ_CONSTRAINT_FIELD].annotations.valueSet[1]
              .fullName,
          ).toEqual(existingFieldName)
          expect(
            afterData.fields[CPQ_CONSTRAINT_FIELD].annotations.valueSet[2]
              .fullName,
          ).toEqual('nonExistingField')
        })
      })
    })
  })

  describe('onDeploy', () => {
    let changes: Change<ChangeDataType>[]
    describe('Modification changes', () => {
      beforeAll(async () => {
        changes = [
          toChange({
            before: mockConfigurationAttribute.clone(),
            after: mockConfigurationAttribute.clone(),
          }),
          toChange({
            before:
              mockConfigurationAttribute.clone().fields[
                CPQ_DEFAULT_OBJECT_FIELD
              ],
            after:
              mockConfigurationAttribute.clone().fields[
                CPQ_DEFAULT_OBJECT_FIELD
              ],
          }),
          toChange({
            before: mockPriceSchedule.clone(),
            after: mockPriceSchedule.clone(),
          }),
          toChange({
            before: mockPriceSchedule.clone().fields[CPQ_CONSTRAINT_FIELD],
            after: mockPriceSchedule.clone().fields[CPQ_CONSTRAINT_FIELD],
          }),
        ]
        await filter.onDeploy(changes)
      })
      describe('Object lookup', () => {
        it('Should not change on object modifications', () => {
          const configAttrChange = changes.find((change) =>
            getChangeData(change).elemID.isEqual(
              mockConfigurationAttributeElemID,
            ),
          )
          expect(configAttrChange).toBeDefined()
          const afterData = (configAttrChange as ModificationChange<ObjectType>)
            .data.after
          expect(
            afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[0]
              .fullName,
          ).toEqual(
            mockConfigurationAttribute.fields[CPQ_DEFAULT_OBJECT_FIELD]
              .annotations.valueSet[0].fullName,
          )
          expect(
            afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[1]
              .fullName,
          ).toEqual(
            mockConfigurationAttribute.fields[CPQ_DEFAULT_OBJECT_FIELD]
              .annotations.valueSet[1].fullName,
          )
          expect(
            afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[2]
              .fullName,
          ).toEqual(
            mockConfigurationAttribute.fields[CPQ_DEFAULT_OBJECT_FIELD]
              .annotations.valueSet[2].fullName,
          )
        })

        it('Should on field modification map to full path api name if theres mapping and keep same if not', () => {
          const configAttrFieldChange = changes.find((change) =>
            getChangeData(change).elemID.isEqual(
              mockConfigurationAttribute.fields[CPQ_DEFAULT_OBJECT_FIELD]
                .elemID,
            ),
          )
          expect(configAttrFieldChange).toBeDefined()
          const afterData = (configAttrFieldChange as ModificationChange<Field>)
            .data.after
          expect(afterData.annotations.valueSet[0].fullName).toEqual(CPQ_QUOTE)
          expect(afterData.annotations.valueSet[1].fullName).toEqual(
            existingObjectName,
          )
          expect(afterData.annotations.valueSet[2].fullName).toEqual(
            'nonExistingObject',
          )
        })
      })
      describe('Field lookup', () => {
        it('Should not change on object modification', () => {
          const priceSchedulingChange = changes.find((change) =>
            getChangeData(change).elemID.isEqual(mockPriceScheduleElemID),
          )
          expect(priceSchedulingChange).toBeDefined()
          const afterData = (
            priceSchedulingChange as ModificationChange<ObjectType>
          ).data.after
          expect(
            afterData.fields[CPQ_CONSTRAINT_FIELD].annotations.valueSet[0]
              .fullName,
          ).toEqual(
            mockPriceSchedule.fields[CPQ_CONSTRAINT_FIELD].annotations
              .valueSet[0].fullName,
          )
          expect(
            afterData.fields[CPQ_CONSTRAINT_FIELD].annotations.valueSet[1]
              .fullName,
          ).toEqual(
            mockPriceSchedule.fields[CPQ_CONSTRAINT_FIELD].annotations
              .valueSet[1].fullName,
          )
          expect(
            afterData.fields[CPQ_CONSTRAINT_FIELD].annotations.valueSet[2]
              .fullName,
          ).toEqual(
            mockPriceSchedule.fields[CPQ_CONSTRAINT_FIELD].annotations
              .valueSet[2].fullName,
          )
        })

        it('Should on field modificiation map to api name if theres mapping and keep same if not', () => {
          const priceSchedulingChange = changes.find((change) =>
            getChangeData(change).elemID.isEqual(
              mockPriceSchedule.fields[CPQ_CONSTRAINT_FIELD].elemID,
            ),
          )
          expect(priceSchedulingChange).toBeDefined()
          const afterData = (priceSchedulingChange as ModificationChange<Field>)
            .data.after
          expect(afterData.annotations.valueSet[0].fullName).toEqual(
            'SBQQ__Quote__c.SBQQ__Account__c',
          )
          expect(afterData.annotations.valueSet[1].fullName).toEqual(
            `SBQQ__Quote__c.${existingFieldName}`,
          )
          // This is a known issue
          expect(afterData.annotations.valueSet[2].fullName).toEqual(
            'SBQQ__Quote__c.nonExistingField',
          )
        })
      })
    })
    describe('Addition changes', () => {
      beforeAll(async () => {
        changes = [
          toChange({
            after: mockConfigurationAttribute.clone(),
          }),
          toChange({
            after: mockPriceSchedule.clone(),
          }),
        ]
        await filter.onDeploy(changes)
      })
      describe('Object lookup', () => {
        it('Should map to api name if theres mapping and keep same if not', () => {
          const configAttrChange = changes.find((change) =>
            getChangeData(change).elemID.isEqual(
              mockConfigurationAttributeElemID,
            ),
          )
          expect(configAttrChange).toBeDefined()
          const afterData = (configAttrChange as ModificationChange<ObjectType>)
            .data.after
          expect(
            afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[0]
              .fullName,
          ).toEqual(CPQ_QUOTE)
          expect(
            afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[1]
              .fullName,
          ).toEqual(existingObjectName)
          expect(
            afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[2]
              .fullName,
          ).toEqual('nonExistingObject')
        })
      })
      describe('Field lookup', () => {
        it('Should map to api name if theres mapping and keep same if not', () => {
          const priceSchedulingChange = changes.find((change) =>
            getChangeData(change).elemID.isEqual(mockPriceScheduleElemID),
          )
          expect(priceSchedulingChange).toBeDefined()
          const afterData = (
            priceSchedulingChange as ModificationChange<ObjectType>
          ).data.after
          expect(
            afterData.fields[CPQ_CONSTRAINT_FIELD].annotations.valueSet[0]
              .fullName,
          ).toEqual('SBQQ__Quote__c.SBQQ__Account__c')
          expect(
            afterData.fields[CPQ_CONSTRAINT_FIELD].annotations.valueSet[1]
              .fullName,
          ).toEqual(`SBQQ__Quote__c.${existingFieldName}`)
          // This is a known issue
          expect(
            afterData.fields[CPQ_CONSTRAINT_FIELD].annotations.valueSet[2]
              .fullName,
          ).toEqual('SBQQ__Quote__c.nonExistingField')
        })
      })
    })
  })
})
