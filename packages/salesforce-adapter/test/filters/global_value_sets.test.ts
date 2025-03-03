/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  ElemID,
  Element,
  InstanceElement,
  ReferenceExpression,
  CORE_ANNOTATIONS,
  Value,
} from '@salto-io/adapter-api'
import * as constants from '../../src/constants'
import filterCreator, { GLOBAL_VALUE_SET, CUSTOM_VALUE, MASTER_LABEL } from '../../src/filters/global_value_sets'
import { Types } from '../../src/transformers/transformer'
import { defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'

const picklistValueListToMap = (values: Value[]): Value =>
  values.reduce<Record<string, Object>>((acc, element) => {
    acc[element.fullName] = element
    return acc
  }, {})

const createGlobalValueSetInstanceElement = (name: string, values: string[]): InstanceElement =>
  new InstanceElement(
    'global_value_set_test',
    new ObjectType({
      elemID: new ElemID(constants.SALESFORCE, 'global_value_set'),
      annotationRefsOrTypes: {},
      annotations: { [constants.METADATA_TYPE]: GLOBAL_VALUE_SET },
    }),
    {
      [constants.INSTANCE_FULL_NAME_FIELD]: name,
      [MASTER_LABEL]: name,
      [constants.DESCRIPTION]: name,
      sorted: false,
      [CUSTOM_VALUE]: {
        // eslint-disable-next-line no-useless-computed-key
        ['values']: picklistValueListToMap(
          values.map(v => ({
            [constants.CUSTOM_VALUE.FULL_NAME]: v,
            [constants.CUSTOM_VALUE.DEFAULT]: false,
            [constants.CUSTOM_VALUE.LABEL]: v,
            [constants.CUSTOM_VALUE.IS_ACTIVE]: true,
          })),
        ),
      },
    },
  )

const createPicklistObjectType = (
  mockElemID: ElemID,
  apiName: string,
  valueSetName: string,
  secondValueSetName: string,
  includeFieldDependencies = true,
  includeOnlyExistingValue = true,
  useStateFieldAsControlling = true,
  createValueSetNameAtState = true,
): ObjectType =>
  new ObjectType({
    elemID: mockElemID,
    fields: {
      state: {
        refType: Types.primitiveDataTypes[constants.FIELD_TYPE_NAMES.PICKLIST],
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [constants.API_NAME]: apiName,
          label: 'test label',
          ...(createValueSetNameAtState ? { [constants.VALUE_SET_FIELDS.VALUE_SET_NAME]: valueSetName } : {}),
          [constants.FIELD_ANNOTATIONS.RESTRICTED]: true,
        },
      },
      customPicklistField: {
        refType: Types.primitiveDataTypes[constants.FIELD_TYPE_NAMES.PICKLIST],
        annotations: {
          [constants.VALUE_SET_FIELDS.VALUE_SET_NAME]: secondValueSetName,
          ...(includeFieldDependencies && {
            [constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY]: {
              [constants.FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]: useStateFieldAsControlling ? 'state' : 'regular',
              [constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]: [
                {
                  [constants.VALUE_SETTINGS_FIELDS.VALUE_NAME]: 'val3',
                  [constants.VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: [
                    'val1',
                    includeOnlyExistingValue ? 'val2' : 'val',
                  ],
                },
                {
                  [constants.VALUE_SETTINGS_FIELDS.VALUE_NAME]: 'val4',
                  [constants.VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: ['val2'],
                },
              ],
            },
          }),
        },
      },
      regular: {
        refType: Types.primitiveDataTypes.Number,
        annotations: {
          [constants.API_NAME]: 'Test__c.regular__c',
          [constants.VALUE_SET_FIELDS.VALUE_SET_NAME]: valueSetName,
        },
      },
    },
    annotations: {
      [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
      [constants.API_NAME]: 'Test__c',
    },
  })

describe('Global Value Sets filter', () => {
  const filter = filterCreator({
    config: defaultFilterContext,
  }) as FilterWith<'onFetch'>
  const mockElemID = new ElemID(constants.SALESFORCE, 'test')
  let elements: Element[] = []

  beforeEach(() => {
    elements = [
      createGlobalValueSetInstanceElement('test1', ['val1', 'val2']),
      createGlobalValueSetInstanceElement('test2', ['val3', 'val4']),
    ]
  })

  describe('on fetch', () => {
    it('should replace value set, controllingField, valeName and controllingFieldValue with references', async () => {
      elements.push(createPicklistObjectType(mockElemID, 'test', 'test1', 'test2'))
      await filter.onFetch(elements)
      const globalValueSetInstance = elements[0] as InstanceElement
      const customObjectType = elements[2] as ObjectType
      expect(customObjectType.fields.state.annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME]).toEqual(
        new ReferenceExpression(globalValueSetInstance.elemID, globalValueSetInstance),
      )
      expect(
        customObjectType.fields.customPicklistField.annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME],
      ).toEqual(new ReferenceExpression(elements[1].elemID, elements[1]))
      expect(
        customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
          constants.FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD
        ],
      ).toEqual(new ReferenceExpression(customObjectType.fields.state.elemID, customObjectType.fields.state))
      expect(
        customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
          constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS
        ][0].valueName,
      ).toEqual(
        new ReferenceExpression(
          elements[1].elemID.createNestedID('customValue', 'values', 'val3', 'fullName'),
          (elements[1] as Value).value.customValue.values.val3.fullName,
        ),
      )
      expect(
        customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
          constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS
        ][0].controllingFieldValue[0],
      ).toEqual(
        new ReferenceExpression(
          elements[0].elemID.createNestedID('customValue', 'values', 'val1', 'fullName'),
          (elements[0] as Value).value.customValue.values.val1.fullName,
        ),
      )
      expect(
        customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
          constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS
        ][0].controllingFieldValue[1],
      ).toEqual(
        new ReferenceExpression(
          elements[0].elemID.createNestedID('customValue', 'values', 'val2', 'fullName'),
          (elements[0] as Value).value.customValue.values.val2.fullName,
        ),
      )
      expect(
        customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
          constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS
        ][1].valueName,
      ).toEqual(
        new ReferenceExpression(
          elements[1].elemID.createNestedID('customValue', 'values', 'val4', 'fullName'),
          (elements[1] as Value).value.customValue.values.val4.fullName,
        ),
      )
      expect(
        customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
          constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS
        ][1].controllingFieldValue[0],
      ).toEqual(
        new ReferenceExpression(
          elements[0].elemID.createNestedID('customValue', 'values', 'val2', 'fullName'),
          (elements[0] as Value).value.customValue.values.val2.fullName,
        ),
      )
    })
    it('should not replace value set with references if value set name does not exist', async () => {
      elements.push(createPicklistObjectType(mockElemID, 'test', 'not_exist', 'another_fake'))
      await filter.onFetch(elements)
      const customObjectType = elements[2] as ObjectType
      expect(customObjectType.fields.state.annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME]).toEqual('not_exist')
      expect(
        customObjectType.fields.customPicklistField.annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME],
      ).toEqual('another_fake')
      expect(
        customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
          constants.FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD
        ],
      ).toEqual('state')
      expect(
        customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
          constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS
        ][0].valueName,
      ).toEqual('val3')
      expect(
        customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
          constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS
        ][0].controllingFieldValue[0],
      ).toEqual('val1')
      expect(
        customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
          constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS
        ][0].controllingFieldValue[1],
      ).toEqual('val2')
      expect(
        customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
          constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS
        ][1].valueName,
      ).toEqual('val4')
      expect(
        customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
          constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS
        ][1].controllingFieldValue[0],
      ).toEqual('val2')
    })
    describe('when field does not have fieldDependency field', () => {
      it('should still create reference to valueSet', async () => {
        elements.push(createPicklistObjectType(mockElemID, 'test', 'test1', 'test2', false))
        await filter.onFetch(elements)
        expect((elements[2] as ObjectType).fields.customPicklistField.annotations.valueSetName).toBeInstanceOf(
          ReferenceExpression,
        )
      })
    })
    describe('when one of the controllingFieldValues doesnt exist in the controllingField ValueSet', () => {
      it('should keep the string value', async () => {
        elements.push(createPicklistObjectType(mockElemID, 'test', 'test1', 'test2', true, false))
        await filter.onFetch(elements)
        expect(
          (elements[2] as ObjectType).fields.customPicklistField.annotations.fieldDependency.valueSettings[0]
            .controllingFieldValue[1],
        ).toEqual('val')
      })
    })
    describe('when valueSetName of controlling field is string and not reference', () => {
      it('should create references as usual', async () => {
        elements.push(createPicklistObjectType(mockElemID, 'test', 'test1', 'test2', true, true, false))
        await filter.onFetch(elements)
        const globalValueSetInstance = elements[0] as InstanceElement
        const customObjectType = elements[2] as ObjectType
        expect(customObjectType.fields.state.annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME]).toEqual(
          new ReferenceExpression(globalValueSetInstance.elemID, globalValueSetInstance),
        )
        expect(
          customObjectType.fields.customPicklistField.annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME],
        ).toEqual(new ReferenceExpression(elements[1].elemID, elements[1]))
        expect(
          customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
            constants.FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD
          ],
        ).toEqual(new ReferenceExpression(customObjectType.fields.regular.elemID, customObjectType.fields.regular))
        expect(
          customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
            constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS
          ][0].valueName,
        ).toEqual(
          new ReferenceExpression(
            elements[1].elemID.createNestedID('customValue', 'values', 'val3', 'fullName'),
            (elements[1] as Value).value.customValue.values.val3.fullName,
          ),
        )
        expect(
          customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
            constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS
          ][0].controllingFieldValue[0],
        ).toEqual(
          new ReferenceExpression(
            elements[0].elemID.createNestedID('customValue', 'values', 'val1', 'fullName'),
            (elements[0] as Value).value.customValue.values.val1.fullName,
          ),
        )
        expect(
          customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
            constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS
          ][0].controllingFieldValue[1],
        ).toEqual(
          new ReferenceExpression(
            elements[0].elemID.createNestedID('customValue', 'values', 'val2', 'fullName'),
            (elements[0] as Value).value.customValue.values.val2.fullName,
          ),
        )
        expect(
          customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
            constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS
          ][1].valueName,
        ).toEqual(
          new ReferenceExpression(
            elements[1].elemID.createNestedID('customValue', 'values', 'val4', 'fullName'),
            (elements[1] as Value).value.customValue.values.val4.fullName,
          ),
        )
        expect(
          customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
            constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS
          ][1].controllingFieldValue[0],
        ).toEqual(
          new ReferenceExpression(
            elements[0].elemID.createNestedID('customValue', 'values', 'val2', 'fullName'),
            (elements[0] as Value).value.customValue.values.val2.fullName,
          ),
        )
      })
    })
    describe('when valueSetName of unrelated field is not defined', () => {
      it('should create references as usual', async () => {
        elements.push(createPicklistObjectType(mockElemID, 'test', 'test1', 'test2', true, true, false, false))
        await filter.onFetch(elements)
        const customObjectType = elements[2] as ObjectType
        expect(customObjectType.fields.state.annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME]).not.toBeDefined()
        expect(
          customObjectType.fields.customPicklistField.annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME],
        ).toEqual(new ReferenceExpression(elements[1].elemID, elements[1]))
        expect(
          customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
            constants.FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD
          ],
        ).toEqual(new ReferenceExpression(customObjectType.fields.regular.elemID, customObjectType.fields.regular))
        expect(
          customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
            constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS
          ][0].valueName,
        ).toEqual(
          new ReferenceExpression(
            elements[1].elemID.createNestedID('customValue', 'values', 'val3', 'fullName'),
            (elements[1] as Value).value.customValue.values.val3.fullName,
          ),
        )
        expect(
          customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
            constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS
          ][0].controllingFieldValue[0],
        ).toEqual(
          new ReferenceExpression(
            elements[0].elemID.createNestedID('customValue', 'values', 'val1', 'fullName'),
            (elements[0] as Value).value.customValue.values.val1.fullName,
          ),
        )
        expect(
          customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
            constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS
          ][0].controllingFieldValue[1],
        ).toEqual(
          new ReferenceExpression(
            elements[0].elemID.createNestedID('customValue', 'values', 'val2', 'fullName'),
            (elements[0] as Value).value.customValue.values.val2.fullName,
          ),
        )
        expect(
          customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
            constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS
          ][1].valueName,
        ).toEqual(
          new ReferenceExpression(
            elements[1].elemID.createNestedID('customValue', 'values', 'val4', 'fullName'),
            (elements[1] as Value).value.customValue.values.val4.fullName,
          ),
        )
        expect(
          customObjectType.fields.customPicklistField.annotations[constants.FIELD_ANNOTATIONS.FIELD_DEPENDENCY][
            constants.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS
          ][1].controllingFieldValue[0],
        ).toEqual(
          new ReferenceExpression(
            elements[0].elemID.createNestedID('customValue', 'values', 'val2', 'fullName'),
            (elements[0] as Value).value.customValue.values.val2.fullName,
          ),
        )
      })
    })
  })
})
