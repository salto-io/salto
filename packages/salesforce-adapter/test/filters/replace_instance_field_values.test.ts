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
  Element,
  ElemID,
  ObjectType,
  InstanceElement,
  isInstanceElement,
  Change,
  ChangeDataType,
  BuiltinTypes,
  ListType,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import filterCreator from '../../src/filters/replace_instance_field_values'
import {
  SALESFORCE,
  METADATA_TYPE,
  INSTANCE_FULL_NAME_FIELD,
  CUSTOM_OBJECT,
  INTERNAL_ID_FIELD,
  CUSTOM_FIELD,
  API_NAME,
} from '../../src/constants'
import { metadataType } from '../../src/transformers/transformer'
import { defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'

const { awu } = collections.asynciterable

const FORECASTING_METADATA_TYPE = 'ForecastingSettings'
const BEFORE_ID_1 = '00N4K000004woj7'
const AFTER_ID_1 = 'Opportunity.CurrentGenerators__c'
const BEFORE_ID_2 = '00N4K000004woj8'
const AFTER_ID_2 = 'Opportunity.DeliveryInstallationStatus__c'

const NON_ID_NAME_1 = 'OPPORTUNITY.LAST_UPDATE'
const NON_ID_NAME_2 = 'OPPORTUNITY.CREATED_DATE'

interface ForecastingTypeSettings {
  opportunityListFieldsSelectedSettings: {
    field: string[]
  }
  opportunityListFieldsUnselectedSettings: {
    field: string[]
  }
  opportunityListFieldsLabelMappings: Array<{
    field: string
    label: string
  }>
}

interface ForecastingSettingsValue {
  forecastingTypeSettings: ForecastingTypeSettings[]
}

const opportunityListFieldsSelectedSettingsType = new ObjectType({
  annotations: { [METADATA_TYPE]: 'OpportunityListFieldsSelectedSettings' },
  elemID: new ElemID(SALESFORCE, 'OpportunityListFieldsSelectedSettings'),
  fields: {
    field: {
      refType: new ListType(BuiltinTypes.STRING),
    },
  },
})

const opportunityListFieldsUnselectedSettingsType = new ObjectType({
  annotations: { [METADATA_TYPE]: 'OpportunityListFieldsUnselectedSettings' },
  elemID: new ElemID(SALESFORCE, 'OpportunityListFieldsUnselectedSettings'),
  fields: {
    field: {
      refType: new ListType(BuiltinTypes.STRING),
    },
  },
})

const opportunityListFieldsLabelMappingType = new ObjectType({
  annotations: { [METADATA_TYPE]: 'OpportunityListFieldsLabelMapping' },
  elemID: new ElemID(SALESFORCE, 'OpportunityListFieldsLabelMapping'),
  fields: {
    field: {
      refType: BuiltinTypes.STRING,
    },
    label: {
      refType: BuiltinTypes.STRING,
    },
  },
})

const forecastingTypeSettingsType = new ListType(
  new ObjectType({
    annotations: { [METADATA_TYPE]: 'ForecastingTypeSettings' },
    elemID: new ElemID(SALESFORCE, 'ForecastingTypeSettings'),
    fields: {
      opportunityListFieldsSelectedSettings: {
        refType: opportunityListFieldsSelectedSettingsType,
      },
      opportunityListFieldsUnselectedSettings: {
        refType: opportunityListFieldsUnselectedSettingsType,
      },
      opportunityListFieldsLabelMappings: {
        refType: new ListType(opportunityListFieldsLabelMappingType),
      },
    },
  }),
)

const types: Record<string, ObjectType> = {
  [FORECASTING_METADATA_TYPE]: new ObjectType({
    annotations: { [METADATA_TYPE]: FORECASTING_METADATA_TYPE },
    elemID: new ElemID(SALESFORCE, FORECASTING_METADATA_TYPE),
    fields: {
      forecastingTypeSettings: {
        refType: forecastingTypeSettingsType,
      },
    },
  }),
  [CUSTOM_OBJECT]: new ObjectType({
    annotations: { [METADATA_TYPE]: CUSTOM_OBJECT },
    elemID: new ElemID(SALESFORCE, CUSTOM_OBJECT),
    fields: {},
  }),
  [CUSTOM_FIELD]: new ObjectType({
    annotations: { [METADATA_TYPE]: CUSTOM_FIELD },
    elemID: new ElemID(SALESFORCE, CUSTOM_FIELD),
    fields: {},
  }),
}

describe('replace instance field values filter', () => {
  let elements: Element[]
  let orjNumElements: number
  let nonForecastingInstance: Element
  let forecastingElementWithIDs: InstanceElement
  let forecastingElementWithNames: InstanceElement

  const createForecastingElement = (withIDs: boolean): InstanceElement =>
    new InstanceElement('Forecasting', types[FORECASTING_METADATA_TYPE], {
      [INSTANCE_FULL_NAME_FIELD]: 'Forecasting',
      forecastingTypeSettings: [
        {
          opportunityListFieldsSelectedSettings: {
            field: [NON_ID_NAME_1],
          },
          opportunityListFieldsUnselectedSettings: {
            field: [NON_ID_NAME_2],
          },
          opportunityListFieldsLabelMappings: [
            {
              field: NON_ID_NAME_1,
              label: '',
            },
            {
              field: NON_ID_NAME_2,
              label: '',
            },
          ],
        },
        {
          opportunityListFieldsSelectedSettings: {
            field: [withIDs ? BEFORE_ID_1 : AFTER_ID_1],
          },
          opportunityListFieldsUnselectedSettings: {
            field: [withIDs ? BEFORE_ID_2 : AFTER_ID_2],
          },
          opportunityListFieldsLabelMappings: [
            {
              field: withIDs ? BEFORE_ID_1 : AFTER_ID_1,
              label: '',
            },
            {
              field: withIDs ? BEFORE_ID_2 : AFTER_ID_2,
              label: '',
            },
          ],
        },
      ],
    })

  const getAllNamesFromForecastingValue = (
    forecastValue: ForecastingSettingsValue,
  ): string[] => {
    const res: string[] = []
    forecastValue.forecastingTypeSettings.forEach((t) => {
      const additionalNames = [
        ...t.opportunityListFieldsSelectedSettings.field,
        // opportunityListFieldsUnselectedSettings might be undefined due to value modification
        ...(t.opportunityListFieldsUnselectedSettings?.field ?? []),
      ]
      additionalNames.forEach((name) => res.push(name))
      t.opportunityListFieldsLabelMappings.forEach((map) => {
        res.push(map.field)
      })
    })
    return res
  }

  const generateElements = (): Element[] => {
    const opportunityType = new ObjectType({
      elemID: new ElemID(SALESFORCE, CUSTOM_OBJECT),
      fields: {
        [AFTER_ID_2]: {
          refType: types[CUSTOM_FIELD],
          annotations: {
            [INTERNAL_ID_FIELD]: `${BEFORE_ID_2}UAA`,
            [API_NAME]: AFTER_ID_2,
          },
        },
        [AFTER_ID_1]: {
          refType: types[CUSTOM_FIELD],
          annotations: {
            [INTERNAL_ID_FIELD]: `${BEFORE_ID_1}UAA`,
            [API_NAME]: AFTER_ID_1,
          },
        },
      },
      annotations: {
        [METADATA_TYPE]: CUSTOM_OBJECT,
        [API_NAME]: 'Opportunity',
      },
    })

    const instances = [
      forecastingElementWithIDs,
      new InstanceElement('notForecasting', types[CUSTOM_OBJECT], {
        standard: 'aaa',
        custom: 'bbb',
        [INSTANCE_FULL_NAME_FIELD]: 'unknownInst',
      }),
      opportunityType,
    ]
    return [
      types[FORECASTING_METADATA_TYPE],
      types[CUSTOM_OBJECT],
      ...instances,
    ]
  }

  beforeAll(() => {
    forecastingElementWithIDs = createForecastingElement(true)
    forecastingElementWithNames = createForecastingElement(false)
  })

  describe('onFetch', () => {
    type FilterType = FilterWith<'onFetch'>
    let filter: FilterType
    let beforeNonForecastingInstance: Element
    let namesAfterFilter: string[]
    beforeAll(async () => {
      elements = generateElements()
      nonForecastingInstance = elements[elements.length - 1]
      orjNumElements = elements.length
      beforeNonForecastingInstance = nonForecastingInstance.clone()
      filter = filterCreator({ config: defaultFilterContext }) as FilterType
      await filter.onFetch(elements)

      namesAfterFilter = []
      await awu(elements)
        .filter(isInstanceElement)
        .filter(
          async (e) => (await metadataType(e)) === FORECASTING_METADATA_TYPE,
        )
        .map((e) => e.value)
        .forEach((val) => {
          const names = getAllNamesFromForecastingValue(
            val as ForecastingSettingsValue,
          )
          names.forEach((name) => namesAfterFilter.push(name))
        })
    })

    describe('replace ids of forecasting settings', () => {
      it('should replace ids to names', () => {
        expect(namesAfterFilter).not.toContain(BEFORE_ID_1)
        expect(namesAfterFilter).not.toContain(BEFORE_ID_2)
        expect(namesAfterFilter).toContain(AFTER_ID_1)
        expect(namesAfterFilter).toContain(AFTER_ID_2)
      })

      it('should not replace non-id names', () => {
        expect(namesAfterFilter).toContain(NON_ID_NAME_2)
        expect(namesAfterFilter).toContain(NON_ID_NAME_1)
      })

      it('should not replace instances of other types', () => {
        expect(nonForecastingInstance).toEqual(beforeNonForecastingInstance)
      })
      it('should not change num of elements', () => {
        expect(elements.length).toEqual(orjNumElements)
      })
    })
  })

  describe('preDeploy', () => {
    type FilterType = FilterWith<'preDeploy'>
    let filter: FilterType

    beforeAll(() => {
      filter = filterCreator({
        config: {
          ...defaultFilterContext,
          elementsSource: buildElementsSourceFromElements(elements),
        },
      }) as FilterType
    })

    describe('replace names of forecasting settings to ids', () => {
      let beforeElem: InstanceElement
      let afterElem: InstanceElement
      let change: Change<ChangeDataType>
      let namesAfterFilter: string[]
      beforeEach(() => {
        beforeElem = forecastingElementWithNames.clone()
        afterElem = beforeElem.clone()
      })
      describe('the change is in selected/unselected fields', () => {
        beforeEach(async () => {
          // modify afterElem:
          afterElem.value.forecastingTypeSettings[0].opportunityListFieldsSelectedSettings.field =
            [
              ...afterElem.value.forecastingTypeSettings[0]
                .opportunityListFieldsSelectedSettings.field,
              ...afterElem.value.forecastingTypeSettings[0]
                .opportunityListFieldsUnselectedSettings.field,
            ]
          afterElem.value.forecastingTypeSettings[0].opportunityListFieldsUnselectedSettings.field =
            []

          change = {
            action: 'modify',
            data: {
              before: beforeElem,
              after: afterElem,
            },
          }

          await filter.preDeploy([change])
          namesAfterFilter = getAllNamesFromForecastingValue(
            afterElem.value as ForecastingSettingsValue,
          )
        })
        it('should replace names to ids', () => {
          expect(namesAfterFilter).toContain(BEFORE_ID_1)
          expect(namesAfterFilter).toContain(BEFORE_ID_2)
          expect(namesAfterFilter).not.toContain(AFTER_ID_1)
          expect(namesAfterFilter).not.toContain(AFTER_ID_2)
        })
        it('should not replace names', () => {
          expect(namesAfterFilter).toContain(NON_ID_NAME_1)
          expect(namesAfterFilter).toContain(NON_ID_NAME_2)
        })
      })

      describe('the change is not in selected/unselected fields', () => {
        beforeEach(async () => {
          afterElem.annotate({ newAnnotation: 'newAnnotationValue' })
          change = {
            action: 'modify',
            data: {
              before: beforeElem,
              after: afterElem,
            },
          }
          await filter.preDeploy([change])
          namesAfterFilter = getAllNamesFromForecastingValue(
            afterElem.value as ForecastingSettingsValue,
          )
        })

        it('should replace names to ids', () => {
          expect(namesAfterFilter).toContain(BEFORE_ID_1)
          expect(namesAfterFilter).toContain(BEFORE_ID_2)
          expect(namesAfterFilter).not.toContain(AFTER_ID_1)
          expect(namesAfterFilter).not.toContain(AFTER_ID_2)
        })
        it('should not replace names', () => {
          expect(namesAfterFilter).toContain(NON_ID_NAME_1)
          expect(namesAfterFilter).toContain(NON_ID_NAME_2)
        })
      })
    })
  })

  describe('onDeploy', () => {
    type FilterType = FilterWith<'onDeploy'>
    let filter: FilterType

    beforeAll(() => {
      filter = filterCreator({
        config: {
          ...defaultFilterContext,
          elementsSource: buildElementsSourceFromElements(elements),
        },
      }) as FilterType
    })

    describe('replace ids of forecasting settings to names', () => {
      let beforeElem: InstanceElement
      let afterElem: InstanceElement
      let change: Change<ChangeDataType>
      let namesAfterFilter: string[]
      beforeAll(async () => {
        beforeElem = forecastingElementWithIDs
        afterElem = beforeElem.clone()
        afterElem.annotate({ newAnnotation: 'newAnnotationValue' })
        change = {
          action: 'modify',
          data: {
            before: beforeElem,
            after: afterElem,
          },
        }
        await filter.onDeploy([change])
        namesAfterFilter = getAllNamesFromForecastingValue(
          afterElem.value as ForecastingSettingsValue,
        )
      })
      it('should replace ids to names', () => {
        expect(namesAfterFilter).not.toContain(BEFORE_ID_1)
        expect(namesAfterFilter).not.toContain(BEFORE_ID_2)
        expect(namesAfterFilter).toContain(AFTER_ID_1)
        expect(namesAfterFilter).toContain(AFTER_ID_2)
      })
      it('should not replace names', () => {
        expect(namesAfterFilter).toContain(NON_ID_NAME_2)
        expect(namesAfterFilter).toContain(NON_ID_NAME_1)
      })
    })
  })
})
