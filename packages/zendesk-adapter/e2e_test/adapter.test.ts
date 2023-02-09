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
import _, { isArray } from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import {
  BuiltinTypes,
  Change,
  ChangeId,
  CORE_ANNOTATIONS,
  DeployResult,
  Element,
  ElemID,
  FieldDefinition,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceElement,
  isObjectType, isReferenceExpression, isTemplateExpression,
  ListType,
  ObjectType,
  ReferenceExpression,
  StaticFile,
  TemplateExpression,
  toChange,
  Value,
  Values,
} from '@salto-io/adapter-api'
import {
  applyDetailedChanges,
  buildElementsSourceFromElements,
  detailedCompare,
  naclCase,
} from '@salto-io/adapter-utils'
import { config as configUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { collections, values } from '@salto-io/lowerdash'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import * as fs from 'fs'
import * as path from 'path'
import { resolve } from '../../workspace/src/expressions'
import {
  API_DEFINITIONS_CONFIG,
  DEFAULT_CONFIG,
  FETCH_CONFIG,
  GUIDE_BRAND_SPECIFIC_TYPES,
  GUIDE_SUPPORTED_TYPES,
  GUIDE_TYPES_TO_HANDLE_BY_BRAND,
  SUPPORTED_TYPES,
} from '../src/config'
import {
  ARTICLE_ATTACHMENT_TYPE_NAME, ARTICLE_ORDER_TYPE_NAME,
  ARTICLE_TRANSLATION_TYPE_NAME,
  ARTICLE_TYPE_NAME,
  BRAND_TYPE_NAME,
  CATEGORY_TRANSLATION_TYPE_NAME,
  CATEGORY_TYPE_NAME,
  PERMISSION_GROUP_TYPE_NAME, SECTION_ORDER_TYPE_NAME,
  SECTION_TRANSLATION_TYPE_NAME,
  SECTION_TYPE_NAME,
  USER_SEGMENT_TYPE_NAME,
  ZENDESK,
} from '../src/constants'
import { Credentials } from '../src/auth'
import { getChangeGroupIds } from '../src/group_change'
import { credsLease, realAdapter, Reals } from './adapter'
import { mockDefaultValues } from './mock_elements'

const { awu } = collections.asynciterable
const { replaceInstanceTypeForDeploy } = elementUtils.ducktype

const ALL_SUPPORTED_TYPES = {
  ...GUIDE_SUPPORTED_TYPES,
  ...SUPPORTED_TYPES,
}

const HELP_CENTER_BRAND_NAME = 'e2eHelpCenter'

// Set long timeout as we communicate with Zendesk APIs
jest.setTimeout(1000 * 60 * 15)

const createInstanceElement = ({
  type,
  valuesOverride,
  fields,
  parent,
  name,
} :{
  type: string
  valuesOverride: Values
  fields?: Record < string, FieldDefinition >
  parent?: InstanceElement
  name?: string
}): InstanceElement => {
  const instValues = {
    ...mockDefaultValues[type],
    ...valuesOverride,
  }
  const transformationConfig = configUtils.getConfigWithDefault(
    DEFAULT_CONFIG[API_DEFINITIONS_CONFIG].types[type].transformation ?? {},
    DEFAULT_CONFIG[API_DEFINITIONS_CONFIG].typeDefaults.transformation,
  )

  const nameParts = transformationConfig.idFields.map(field => _.get(instValues, field))
  return new InstanceElement(
    name ?? naclCase(nameParts.map(String).join('_')),
    new ObjectType({ elemID: new ElemID(ZENDESK, type), fields }),
    instValues,
    undefined,
    parent
      ? { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] }
      : undefined
  )
}


const deployChanges = async (
  adapterAttr: Reals, changes: Record<ChangeId, Change<InstanceElement>[]>
): Promise<DeployResult[]> => {
  let planElementById: Record<string, InstanceElement>
  const deployResults = await awu(Object.entries(changes))
    .map(async ([id, group]) => {
      planElementById = _.keyBy(group.map(getChangeData), data => data.elemID.getFullName())
      const deployResult = await adapterAttr.adapter.deploy({
        changeGroup: { groupID: id, changes: group },
      })
      expect(deployResult.errors).toHaveLength(0)
      expect(deployResult.appliedChanges).not.toHaveLength(0)
      deployResult.appliedChanges // need to update reference expressions
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(e => [
          ...Object.keys(GUIDE_BRAND_SPECIFIC_TYPES),
          PERMISSION_GROUP_TYPE_NAME,
        ].includes(e.elemID.typeName))
        .forEach(updatedElement => {
          const planElement = planElementById[updatedElement.elemID.getFullName()]
          if (planElement !== undefined) {
            applyDetailedChanges(planElement, detailedCompare(planElement, updatedElement))
          }
        })
      return deployResult
    })
    .toArray()
  return deployResults
}

const cleanup = async (adapterAttr: Reals): Promise<void> => {
  const fetchResult = await adapterAttr.adapter.fetch({
    progressReporter:
      { reportProgress: () => null },
  })
  expect(fetchResult.errors).toHaveLength(1)
  expect(fetchResult.errors).toEqual([
    {
      severity: 'Warning',
      message: "Salto could not access the custom_statuses resource. Elements from that type were not fetched. Please make sure that this type is enabled in your service, and that the supplied user credentials have sufficient permissions to access this data. You can also exclude this data from Salto's fetches by changing the environment configuration. Learn more at https://help.salto.io/en/articles/6947061-salto-could-not-access-the-resource",
    },
  ])
  const { elements } = fetchResult
  const e2eBrandInstances = elements
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === BRAND_TYPE_NAME)
    .filter(brand => brand.elemID.name.startsWith('Testbrand'))
  if (e2eBrandInstances.length > 0) {
    await deployChanges(
      adapterAttr,
      { BRAND_TYPE_NAME: e2eBrandInstances.map(brand => toChange({ before: brand })) }
    )
  }
}

const usedConfig = {
  ...DEFAULT_CONFIG,
  [FETCH_CONFIG]: {
    ...DEFAULT_CONFIG[FETCH_CONFIG],
    include: [
      { type: '.*' },
    ],
    exclude: [],
    guide: {
      brands: ['.*'],
    },
  },
  [API_DEFINITIONS_CONFIG]: {
    ...DEFAULT_CONFIG[API_DEFINITIONS_CONFIG],
    supportedTypes: ALL_SUPPORTED_TYPES,
  },
}


describe('Zendesk adapter E2E', () => {
  describe('fetch and deploy', () => {
    let credLease: CredsLease<Credentials>
    let adapterAttr: Reals
    const testSuffix = uuidv4().slice(0, 8)
    const testOptionValue = uuidv4().slice(0, 8)
    let elements: Element[] = []
    let guideInstances : InstanceElement[]
    const createName = (type: string): string => `Test${type}${testSuffix}`
    const createSubdomainName = (): string => `test${testSuffix}`

    let groupIdToInstances: Record<string, InstanceElement[]>
    /**
     * deploy instances to add and fetch afterwards.
     * if beforall is true groupIdToInstances will update to the new elements deployed.
     * this function allows the deploy and fetch multiple times in the e2e, if needed.
     */
    const deployAndFetch = async (instancesToAdd: InstanceElement[], beforeAll: boolean): Promise<void> => {
      const changeGroups = await getChangeGroupIds(new Map<string, Change>(instancesToAdd
        .map(inst => [inst.elemID.getFullName(), toChange({ after: inst })])))
      const groupIdToInstancesTemp = _.groupBy(
        instancesToAdd,
        inst => changeGroups.changeGroupIdMap.get(inst.elemID.getFullName())
      )
      groupIdToInstances = beforeAll ? groupIdToInstancesTemp : groupIdToInstances
      const firstGroupChanges = _.mapValues(
        groupIdToInstancesTemp,
        instances => instances.map(inst => toChange({ after: inst }))
      )
      await deployChanges(adapterAttr, firstGroupChanges)
      const fetchResult = await adapterAttr.adapter.fetch({
        progressReporter:
          { reportProgress: () => null },
      })
      elements = fetchResult.elements
      expect(fetchResult.errors).toHaveLength(1)
      expect(fetchResult.errors).toEqual([
        {
          severity: 'Warning',
          message: "Salto could not access the custom_statuses resource. Elements from that type were not fetched. Please make sure that this type is enabled in your service, and that the supplied user credentials have sufficient permissions to access this data. You can also exclude this data from Salto's fetches by changing the environment configuration. Learn more at https://help.salto.io/en/articles/6947061-salto-could-not-access-the-resource",
        },
      ])
      adapterAttr = realAdapter(
        { credentials: credLease.value,
          elementsSource: buildElementsSourceFromElements(elements) },
        usedConfig
      )
    }

    /**
     * returns a record of the elemID.name and the instance from elements that corresponds to the elemID.
     */
    const getElementsAfterFetch = (originalInstances: InstanceElement[]):
      Record<string, InstanceElement | undefined> => {
      const nameToElemId = _.keyBy(originalInstances, instance => instance.elemID.getFullName())
      return _.mapValues(
        nameToElemId,
        instance => {
          const val = elements.filter(isInstanceElement).find(e => instance.elemID.isEqual(e.elemID))
          expect(val).toBeDefined()
          return val
        }
      )
    }

    const verifyArray = (orgArray: Array<unknown>, fetchArray: Array<unknown>): void => {
      const orgVals = orgArray.map(val => (isReferenceExpression(val) ? val.elemID.getFullName() : val))
      const fetchVals = fetchArray.map(val => (isReferenceExpression(val) ? val.elemID.getFullName() : val))
      expect(orgVals).toEqual(fetchVals)
    }

    const verifyInstanceValues = (
      fetchInstance: InstanceElement | undefined, orgInstance: InstanceElement, fieldsToCheck: string[]
    ): void => {
      expect(fetchInstance).toBeDefined()
      if (fetchInstance === undefined) {
        return
      }
      const orgInstanceValues = orgInstance.value
      const fetchInstanceValues = _.pick(fetchInstance.value, fieldsToCheck)
      fieldsToCheck
        .forEach(field => {
          if (isReferenceExpression(orgInstanceValues[field]) && isReferenceExpression(fetchInstanceValues[field])) {
            expect(fetchInstanceValues[field].elemID.getFullName())
              .toEqual(orgInstanceValues[field].elemID.getFullName())
          } else if (isArray(orgInstanceValues[field]) && isArray(fetchInstanceValues[field])) {
            verifyArray(orgInstanceValues[field], fetchInstanceValues[field])
          } else if (
            isTemplateExpression(orgInstanceValues[field])
            && isTemplateExpression(fetchInstanceValues[field])
          ) {
            verifyArray(orgInstanceValues[field].parts, fetchInstanceValues[field].parts)
          } else {
            expect(fetchInstanceValues[field]).toEqual(orgInstanceValues[field])
          }
        })
    }

    beforeAll(async () => {
      // get e2eHelpCenter brand
      credLease = await credsLease()
      adapterAttr = realAdapter(
        { credentials: credLease.value,
          elementsSource: buildElementsSourceFromElements([]) },
        usedConfig
      )
      const firstFetchResult = await adapterAttr.adapter.fetch({
        progressReporter: { reportProgress: () => null },
      })
      const brandInstanceE2eHelpCenter = firstFetchResult.elements
        .filter(isInstanceElement)
        .find(e => e.elemID.name === HELP_CENTER_BRAND_NAME)
      expect(brandInstanceE2eHelpCenter).toBeDefined()
      if (brandInstanceE2eHelpCenter === undefined) {
        return
      }
      // ******************* create all elements for deploy *******************
      const automationInstance = createInstanceElement({
        type: 'automation',
        valuesOverride: {
          title: createName('automation'),
          conditions: {
            all: [
              {
                field: 'status',
                operator: 'is',
                value: 'solved',
              },
              {
                field: 'SOLVED',
                operator: 'greater_than',
                // Two automations can't have the same conditions
                value: Math.floor(Math.random() * 100000).toString(),
              },
            ],
          },
        },
      })
      const scheduleInstance = createInstanceElement({
        type: 'business_hours_schedule',
        valuesOverride: { name: createName('business_hours_schedule') },
      })
      const customRoleInstance = createInstanceElement({
        type: 'custom_role',
        valuesOverride: { name: createName('custom_role') },
      })
      const groupInstance = createInstanceElement({
        type: 'group',
        valuesOverride: { name: createName('group') },
      })
      const macroInstance = createInstanceElement({
        type: 'macro',
        valuesOverride: { title: createName('macro') },
      })
      const slaPolicyInstance = createInstanceElement({
        type: 'sla_policy',
        valuesOverride: { title: createName('sla_policy') },
      })
      const viewInstance = createInstanceElement({
        type: 'view',
        valuesOverride: { title: createName('view') },
      })
      const ticketFieldInstance = createInstanceElement({
        type: 'ticket_field',
        valuesOverride: { raw_title: createName('ticket_field') },
        fields: { default_custom_field_option: { refType: BuiltinTypes.STRING } },
      })
      const ticketFieldOptionType = new ObjectType({
        elemID: new ElemID(ZENDESK, 'ticket_field__custom_field_options'),
      })
      const ticketFieldOption1Name = `ticketFieldOption1${testSuffix}`
      const ticketFieldOption1Value = `v1t${testOptionValue}`
      const ticketFieldOption1 = new InstanceElement(
        `${ticketFieldInstance.elemID.name}__${ticketFieldOption1Value}`,
        ticketFieldOptionType,
        {
          name: ticketFieldOption1Name,
          raw_name: ticketFieldOption1Name,
          value: ticketFieldOption1Value,
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(
            ticketFieldInstance.elemID, ticketFieldInstance
          ),
        },
      )
      const ticketFieldOption2Name = `ticketFieldOption2${testSuffix}`
      const ticketFieldOption2Value = `v2t${testOptionValue}`
      const ticketFieldOption2 = new InstanceElement(
        `${ticketFieldInstance.elemID.name}__${ticketFieldOption2Value}`,
        ticketFieldOptionType,
        {
          name: ticketFieldOption2Name,
          raw_name: ticketFieldOption2Name,
          value: ticketFieldOption2Value,
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(
            ticketFieldInstance.elemID, ticketFieldInstance
          ),
        },
      )
      ticketFieldInstance.value.custom_field_options = [
        new ReferenceExpression(ticketFieldOption1.elemID, ticketFieldOption1),
        new ReferenceExpression(ticketFieldOption2.elemID, ticketFieldOption2),
      ]
      ticketFieldInstance.value.default_custom_field_option = new ReferenceExpression(
        ticketFieldOption1.elemID, ticketFieldOption1,
      )
      const userFieldName = createName('user_field')
      const userFieldInstance = createInstanceElement({
        type: 'user_field',
        valuesOverride: { raw_title: userFieldName, key: userFieldName },
      })
      const userFieldOptionType = new ObjectType({
        elemID: new ElemID(ZENDESK, 'user_field__custom_field_options'),
      })
      const userFieldOption1Name = `userFieldOption1${testSuffix}`
      const userFieldOption1Value = `v1u${testOptionValue}`
      const userFieldOption1 = new InstanceElement(
        `${userFieldInstance.elemID.name}__${userFieldOption1Value}`,
        userFieldOptionType,
        {
          name: userFieldOption1Name,
          raw_name: userFieldOption1Name,
          value: userFieldOption1Value,
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(
            userFieldInstance.elemID, userFieldInstance
          ),
        },
      )
      const userFieldOption2Name = `userFieldOption2${testSuffix}`
      const userFieldOption2Value = `v2u${testOptionValue}`
      const userFieldOption2 = new InstanceElement(
        `${userFieldInstance.elemID.name}__${userFieldOption2Value}`,
        userFieldOptionType,
        {
          name: userFieldOption2Name,
          raw_name: userFieldOption2Name,
          value: userFieldOption2Value,
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(
            userFieldInstance.elemID, userFieldInstance
          ),
        },
      )
      userFieldInstance.value.custom_field_options = [
        new ReferenceExpression(userFieldOption1.elemID, userFieldOption1),
        new ReferenceExpression(userFieldOption2.elemID, userFieldOption2),
      ]
      const brandName = createName('brand')
      const brandInstanceToAdd = createInstanceElement({
        type: 'brand',
        valuesOverride: {
          name: brandName,
          subdomain: createSubdomainName(),
        },
      })
      const userSegmentInstance = createInstanceElement({
        type: 'user_segment',
        valuesOverride: { name: createName('user_segment'), user_type: 'signed_in_users', built_in: false },
      })

      // ***************** guide instances ******************* //

      const guideLanguageSettingsEn = createInstanceElement({
        type: 'guide_language_settings',
        valuesOverride: {
          locale: 'en-us',
          name: 'english',
        },
        name: `${HELP_CENTER_BRAND_NAME}_en_us@ub`,
      })
      const guideLanguageSettingsHe = createInstanceElement({
        type: 'guide_language_settings',
        valuesOverride: {
          locale: 'he',
          name: 'hebrew',
        },
        name: `${HELP_CENTER_BRAND_NAME}_he`,
      })

      const categoryName = createName('category')
      const categoryInstance = replaceInstanceTypeForDeploy({
        instance: createInstanceElement({
          type: CATEGORY_TYPE_NAME,
          valuesOverride: {
            locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
            source_locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
            brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
          },
          fields: { translations: { refType: new ListType(BuiltinTypes.UNKNOWN) } },
          name: `${categoryName}_${HELP_CENTER_BRAND_NAME}`,
        }),
        config: DEFAULT_CONFIG.apiDefinitions,
      })
      const categoryEnTranslationInstance = createInstanceElement({
        type: CATEGORY_TRANSLATION_TYPE_NAME,
        valuesOverride: {
          locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          outdated: false,
          title: categoryName,
          draft: false,
          hidden: false,
          body: 'this is a test',
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
        },
        parent: categoryInstance,
        name: `${categoryName}_${HELP_CENTER_BRAND_NAME}__${HELP_CENTER_BRAND_NAME}_en_us_ub@uuuuum`,
      })

      const categoryHeTranslationInstance = createInstanceElement({
        type: CATEGORY_TRANSLATION_TYPE_NAME,
        valuesOverride: {
          locale: new ReferenceExpression(guideLanguageSettingsHe.elemID, guideLanguageSettingsHe),
          outdated: false,
          title: `${categoryName} hebrew`,
          draft: false,
          hidden: false,
          body: 'זאת בדיקה בעברית',
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
        },
        parent: categoryInstance,
        name: `${categoryName}_${HELP_CENTER_BRAND_NAME}__${HELP_CENTER_BRAND_NAME}_he`,
      })

      categoryInstance.value.translations = [
        new ReferenceExpression(categoryEnTranslationInstance.elemID, categoryEnTranslationInstance),
        new ReferenceExpression(categoryHeTranslationInstance.elemID, categoryHeTranslationInstance),

      ]

      const sectionName = createName('section')
      const sectionInstance = createInstanceElement({
        type: SECTION_TYPE_NAME,
        valuesOverride: {
          locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          source_locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
          category_id: new ReferenceExpression(categoryInstance.elemID, categoryInstance),
          direct_parent_id: new ReferenceExpression(categoryInstance.elemID, categoryInstance),
          direct_parent_type: CATEGORY_TYPE_NAME,
        },
        fields: { translations: { refType: new ListType(BuiltinTypes.UNKNOWN) } },
        name: `${sectionName}_${categoryName}_${HELP_CENTER_BRAND_NAME}`,
      })
      const sectionEnTranslationInstance = createInstanceElement({
        type: SECTION_TRANSLATION_TYPE_NAME,
        valuesOverride: {
          locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          outdated: false,
          title: sectionName,
          draft: false,
          hidden: false,
          body: 'this is a test',
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
        },
        parent: sectionInstance,
        name: `${sectionName}_${categoryName}_${HELP_CENTER_BRAND_NAME}__${HELP_CENTER_BRAND_NAME}_en_us_ub@uuuuuum`,
      })
      const sectionHeTranslationInstance = createInstanceElement({
        type: SECTION_TRANSLATION_TYPE_NAME,
        valuesOverride: {
          locale: new ReferenceExpression(guideLanguageSettingsHe.elemID, guideLanguageSettingsHe),
          outdated: false,
          title: sectionName,
          draft: false,
          hidden: false,
          body: 'זאת בדיקה בעברית',
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
        },
        parent: sectionInstance,
        name: `${sectionName}_${categoryName}_${HELP_CENTER_BRAND_NAME}__${HELP_CENTER_BRAND_NAME}_he`,
      })
      sectionInstance.value.translations = [
        new ReferenceExpression(sectionEnTranslationInstance.elemID, sectionEnTranslationInstance),
        new ReferenceExpression(sectionHeTranslationInstance.elemID, sectionHeTranslationInstance),
      ]
      const section2Name = createName('sectionTwo')
      const section2Instance = createInstanceElement({
        type: SECTION_TYPE_NAME,
        valuesOverride: {
          locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          source_locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
          category_id: new ReferenceExpression(categoryInstance.elemID, categoryInstance),
          direct_parent_id: new ReferenceExpression(categoryInstance.elemID, categoryInstance),
          direct_parent_type: CATEGORY_TYPE_NAME,
        },
        fields: { translations: { refType: new ListType(BuiltinTypes.UNKNOWN) } },
        name: `${section2Name}_${categoryName}_${HELP_CENTER_BRAND_NAME}`,
      })
      const section2EnTranslationInstance = createInstanceElement({
        type: SECTION_TRANSLATION_TYPE_NAME,
        valuesOverride: {
          locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          outdated: false,
          title: section2Name,
          draft: false,
          hidden: false,
          body: 'this is a test',
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
        },
        parent: section2Instance,
        name: `${section2Name}_${categoryName}_${HELP_CENTER_BRAND_NAME}__${HELP_CENTER_BRAND_NAME}_en_us_ub@uuuuuum`,
      })
      section2Instance.value.translations = [
        new ReferenceExpression(section2EnTranslationInstance.elemID, section2EnTranslationInstance),
      ]
      const section3Name = createName('sectionThree')
      const section3Instance = createInstanceElement({
        type: SECTION_TYPE_NAME,
        valuesOverride: {
          locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          source_locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
          category_id: new ReferenceExpression(categoryInstance.elemID, categoryInstance),
          direct_parent_id: new ReferenceExpression(categoryInstance.elemID, categoryInstance),
          direct_parent_type: CATEGORY_TYPE_NAME,
        },
        fields: { translations: { refType: new ListType(BuiltinTypes.UNKNOWN) } },
        name: `${section3Name}_${categoryName}_${HELP_CENTER_BRAND_NAME}`,
      })
      const section3EnTranslationInstance = createInstanceElement({
        type: SECTION_TRANSLATION_TYPE_NAME,
        valuesOverride: {
          locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          outdated: false,
          title: section3Name,
          draft: false,
          hidden: false,
          body: 'this is a test',
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
        },
        parent: section3Instance,
        name: `${section3Name}_${categoryName}_${HELP_CENTER_BRAND_NAME}__${HELP_CENTER_BRAND_NAME}_en_us_ub@uuuuuum`,
      })
      section3Instance.value.translations = [
        new ReferenceExpression(section3EnTranslationInstance.elemID, section3EnTranslationInstance),
      ]
      const sectionOrder = createInstanceElement({
        type: SECTION_ORDER_TYPE_NAME,
        valuesOverride: {
          sections: [
            new ReferenceExpression(section2Instance.elemID, section2Instance),
            new ReferenceExpression(sectionInstance.elemID, sectionInstance),
            new ReferenceExpression(section3Instance.elemID, section3Instance),
          ],
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
        },
        parent: categoryInstance,
        name: `${categoryName}_${HELP_CENTER_BRAND_NAME}`,
      })

      const insideSectionName = createName('section')
      const insideSectionInstance = createInstanceElement({
        type: SECTION_TYPE_NAME,
        valuesOverride: {
          locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          source_locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
          category_id: new ReferenceExpression(categoryInstance.elemID, categoryInstance),
          parent_section_id: new ReferenceExpression(sectionInstance.elemID, sectionInstance),
          direct_parent_id: new ReferenceExpression(sectionInstance.elemID, sectionInstance),
          direct_parent_type: SECTION_TYPE_NAME,
        },
        fields: { translations: { refType: new ListType(BuiltinTypes.UNKNOWN) } },
        name: `${insideSectionName}_${sectionName}_${categoryName}_${HELP_CENTER_BRAND_NAME}`,
      })
      const insideSectionEnTranslationInstance = createInstanceElement({
        type: SECTION_TRANSLATION_TYPE_NAME,
        valuesOverride: {
          locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          outdated: false,
          title: insideSectionName,
          draft: false,
          hidden: false,
          body: 'this is a test',
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
        },
        parent: insideSectionInstance,
        name: `${insideSectionName}_${sectionName}_${categoryName}_${HELP_CENTER_BRAND_NAME}__${HELP_CENTER_BRAND_NAME}_en_us_ub@uuuuuuum`,
      })
      insideSectionInstance.value.translations = [
        new ReferenceExpression(insideSectionEnTranslationInstance.elemID, insideSectionEnTranslationInstance),
      ]

      const permissionGroupName = createName('permissionGroup')
      const permissionGroup = createInstanceElement({
        type: PERMISSION_GROUP_TYPE_NAME,
        valuesOverride: {
          name: permissionGroupName,
          built_in: false,
        },
      })

      const everyoneUserSegment = createInstanceElement({
        type: USER_SEGMENT_TYPE_NAME,
        valuesOverride: {
          user_type: 'Everyone',
          built_in: true,
          name: 'Everyone',
        },
      })

      const articleName = createName('article')
      const articleInstance = createInstanceElement({
        type: ARTICLE_TYPE_NAME,
        valuesOverride: {
          draft: true,
          promoted: false,
          section_id: new ReferenceExpression(sectionInstance.elemID, sectionInstance),
          source_locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          outdated: false,
          permission_group_id: new ReferenceExpression(permissionGroup.elemID, permissionGroup),
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
          user_segment_id: new ReferenceExpression(everyoneUserSegment.elemID, everyoneUserSegment),
        },
        name: `${articleName}_${sectionName}_${categoryName}_${HELP_CENTER_BRAND_NAME}`,
      })

      const attachmentName = createName('attachment')
      const fileName = `nacl${attachmentName}`
      const articleAttachment = createInstanceElement({
        type: ARTICLE_ATTACHMENT_TYPE_NAME,
        valuesOverride: {
          file_name: fileName,
          content_type: 'image/png',
          content: new StaticFile({
            filepath: `${ZENDESK}/${ARTICLE_ATTACHMENT_TYPE_NAME}/${articleName}/${fileName}`,
            content: fs.readFileSync(path.resolve(`${__dirname}/../e2e_test/images/nacl.png`)),
          }),
          inline: false,
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
        },
        parent: articleInstance,
        name: `${articleName}_${sectionName}_${categoryName}_${HELP_CENTER_BRAND_NAME}__${fileName}_false`,
      })
      const inlineFileName = `naclTwo${attachmentName}`
      const articleInlineAttachment = createInstanceElement({
        type: ARTICLE_ATTACHMENT_TYPE_NAME,
        valuesOverride: {
          file_name: inlineFileName,
          content_type: 'image/png',
          content: new StaticFile({
            filepath: `${ZENDESK}/${ARTICLE_ATTACHMENT_TYPE_NAME}/${articleName}/${inlineFileName}`,
            content: fs.readFileSync(path.resolve(`${__dirname}/../e2e_test/images/nacl.png`)),
          }),
          inline: true,
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
        },
        parent: articleInstance,
        name: `${articleName}_${sectionName}_${categoryName}_${HELP_CENTER_BRAND_NAME}__${inlineFileName}_true`,
      })

      articleInstance.value.attachments = [
        new ReferenceExpression(articleInlineAttachment.elemID, articleInlineAttachment),
        new ReferenceExpression(articleAttachment.elemID, articleAttachment),
      ]
      const sortedAttachments = _.sortBy(articleInstance.value.attachments, [
        (attachment: ReferenceExpression) => attachment.value.value.file_name,
        (attachment: ReferenceExpression) => attachment.value.value.content_type,
        (attachment: ReferenceExpression) => attachment.value.value.inline,
      ])
      articleInstance.value.attachments = sortedAttachments

      const articleTranslationEn = createInstanceElement({
        type: ARTICLE_TRANSLATION_TYPE_NAME,
        valuesOverride: {
          draft: true,
          title: `${articleName}`,
          body: new TemplateExpression({
            parts: [
              '<p>this is a test <img src="',
              new ReferenceExpression(brandInstanceE2eHelpCenter.elemID.createNestedID('brand_url'), brandInstanceE2eHelpCenter?.value.brand_url),
              '/hc/article_attachments/',
              new ReferenceExpression(articleInlineAttachment.elemID, articleInlineAttachment),
              `" alt="${inlineFileName}.png"></p><p></p>`,
            ],
          }),
          locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          outdated: false,
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
        },
        parent: articleInstance,
        name: `${articleName}_${sectionName}_${categoryName}_${HELP_CENTER_BRAND_NAME}__${HELP_CENTER_BRAND_NAME}_en_us_ub@uuuuuuum`,
      })
      const articleTranslationHe = createInstanceElement({
        type: ARTICLE_TRANSLATION_TYPE_NAME,
        valuesOverride: {
          draft: true,
          title: `${articleName}_he`,
          body: 'זאת בדיקה בעברית',
          locale: new ReferenceExpression(guideLanguageSettingsHe.elemID, guideLanguageSettingsHe),
          outdated: false,
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
        },
        parent: articleInstance,
        name: `${articleName}_${sectionName}_${categoryName}_${HELP_CENTER_BRAND_NAME}__${HELP_CENTER_BRAND_NAME}_he`,
      })

      articleInstance.value.translations = [
        new ReferenceExpression(articleTranslationEn.elemID, articleTranslationEn),
        new ReferenceExpression(articleTranslationHe.elemID, articleTranslationHe),
      ]

      const article2Name = createName('articleTwo')
      const article2Instance = createInstanceElement({
        type: ARTICLE_TYPE_NAME,
        valuesOverride: {
          draft: true,
          promoted: false,
          section_id: new ReferenceExpression(sectionInstance.elemID, sectionInstance),
          source_locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          outdated: false,
          permission_group_id: new ReferenceExpression(permissionGroup.elemID, permissionGroup),
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
          user_segment_id: new ReferenceExpression(everyoneUserSegment.elemID, everyoneUserSegment),
        },
        name: `${article2Name}_${sectionName}_${categoryName}_${HELP_CENTER_BRAND_NAME}`,
      })

      const article2TranslationEn = createInstanceElement({
        type: ARTICLE_TRANSLATION_TYPE_NAME,
        valuesOverride: {
          draft: true,
          title: `${article2Name}`,
          body: 'this is a test',
          locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          outdated: false,
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
        },
        parent: article2Instance,
        name: `${article2Name}_${sectionName}_${categoryName}_${HELP_CENTER_BRAND_NAME}__${HELP_CENTER_BRAND_NAME}_en_us_ub@uuuuuuum`,
      })

      article2Instance.value.translations = [
        new ReferenceExpression(article2TranslationEn.elemID, article2TranslationEn),
      ]

      const article3Name = createName('articleThree')
      const article3Instance = createInstanceElement({
        type: ARTICLE_TYPE_NAME,
        valuesOverride: {
          author_id: 'neta.marcus+zendesk@salto.io',
          draft: true,
          promoted: false,
          section_id: new ReferenceExpression(sectionInstance.elemID, sectionInstance),
          source_locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          outdated: false,
          permission_group_id: new ReferenceExpression(permissionGroup.elemID, permissionGroup),
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
          user_segment_id: new ReferenceExpression(everyoneUserSegment.elemID, everyoneUserSegment),
        },
        name: `${article3Name}_${sectionName}_${categoryName}_${HELP_CENTER_BRAND_NAME}`,
      })

      const article3TranslationEn = createInstanceElement({
        type: ARTICLE_TRANSLATION_TYPE_NAME,
        valuesOverride: {
          draft: true,
          title: `${article3Name}`,
          body: 'this is a test',
          locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
          outdated: false,
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
        },
        parent: article3Instance,
        name: `${article3Name}_${sectionName}_${categoryName}_${HELP_CENTER_BRAND_NAME}__${HELP_CENTER_BRAND_NAME}_en_us_ub@uuuuuuum`,
      })

      article3Instance.value.translations = [
        new ReferenceExpression(article3TranslationEn.elemID, article3TranslationEn),
      ]

      const articleOrder = createInstanceElement({
        type: ARTICLE_ORDER_TYPE_NAME,
        valuesOverride: {
          articles: [
            new ReferenceExpression(article2Instance.elemID, article2Instance),
            new ReferenceExpression(articleInstance.elemID, articleInstance),
            new ReferenceExpression(article3Instance.elemID, article3Instance),
          ],
          brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
        },
        parent: sectionInstance,
        name: `${sectionName}_${categoryName}_${HELP_CENTER_BRAND_NAME}`,
      })


      guideInstances = [
        categoryInstance,
        categoryEnTranslationInstance,
        categoryHeTranslationInstance,
        sectionInstance,
        sectionEnTranslationInstance,
        sectionHeTranslationInstance,
        section2Instance,
        section2EnTranslationInstance,
        section3Instance,
        section3EnTranslationInstance,
        sectionOrder,
        insideSectionInstance,
        insideSectionEnTranslationInstance,
        permissionGroup,
        articleAttachment,
        articleInlineAttachment,
        articleInstance,
        articleTranslationEn,
        articleTranslationHe,
        article2Instance,
        article2TranslationEn,
        article3Instance,
        article3TranslationEn,
        articleOrder,
      ]
      adapterAttr = realAdapter(
        { credentials: credLease.value,
          elementsSource: buildElementsSourceFromElements([
            // brand and locale are added since other types depend on them
            brandInstanceE2eHelpCenter,
            guideLanguageSettingsHe,
            guideLanguageSettingsEn,
            everyoneUserSegment,
            articleAttachment,
            articleInlineAttachment,
          ]) },
        {
          ...DEFAULT_CONFIG,
          [FETCH_CONFIG]: {
            ...DEFAULT_CONFIG[FETCH_CONFIG],
            include: [
              { type: '.*' },
            ],
            exclude: [],
            guide: {
              brands: ['.*'],
            },
          },
          [API_DEFINITIONS_CONFIG]: {
            ...DEFAULT_CONFIG[API_DEFINITIONS_CONFIG],
            supportedTypes: ALL_SUPPORTED_TYPES,
          },
        }
      )
      await cleanup(adapterAttr)
      const instancesToAdd = [
        ticketFieldInstance,
        ticketFieldOption1,
        ticketFieldOption2,
        userFieldInstance,
        userFieldOption1,
        userFieldOption2,
        automationInstance,
        scheduleInstance,
        customRoleInstance,
        groupInstance,
        macroInstance,
        slaPolicyInstance,
        viewInstance,
        brandInstanceToAdd,
        userSegmentInstance,
        // guide elements
        ...guideInstances,
      ]
      await deployAndFetch(instancesToAdd, true)
    })

    afterAll(async () => {
      elements = await resolve(elements, buildElementsSourceFromElements(elements))
      const firstGroupChanges = _.mapValues(
        groupIdToInstances,
        instancesToRemove => instancesToRemove.map(inst => {
          const instanceToRemove = elements.find(e => e.elemID.isEqual(inst.elemID))
          return instanceToRemove
            ? toChange({ before: instanceToRemove as InstanceElement })
            : undefined
        }).filter(values.isDefined)
      )
      // remove all elements that include article or section since they were removed already when category was removed
      // this is since the deletion does not take dependencies into account
      Object.keys(firstGroupChanges)
        .filter(type => (type.includes(SECTION_TYPE_NAME) || type.includes(ARTICLE_TYPE_NAME)))
        .forEach(key => delete firstGroupChanges[key])

      await deployChanges(adapterAttr, firstGroupChanges)
      if (credLease.return) {
        await credLease.return()
      }
    })
    it('should fetch the regular instances and types', async () => {
      const typesToFetch = [
        'account_features',
        'account_setting',
        'app_installation',
        'automation',
        'brand',
        'brand_logo',
        'business_hours_schedule',
        'custom_role',
        'dynamic_content_item',
        'group',
        'locale',
        'macro_categories',
        'macro',
        'oauth_client',
        'oauth_global_client',
        'organization',
        'organization_field',
        'resource_collection',
        'routing_attribute',
        'sharing_agreement',
        'sla_policy',
        'support_address',
        'target',
        'ticket_field',
        'ticket_form',
        'trigger_category',
        'trigger',
        'user_field',
        'view',
        'workspace',
      ]
      const typeNames = elements.filter(isObjectType).map(e => e.elemID.typeName)
      const instances = elements.filter(isInstanceElement)
      typesToFetch.forEach(typeName => {
        expect(typeNames).toContain(typeName)
        const instance = instances.find(e => e.elemID.typeName === typeName)
        expect(instance).toBeDefined()
      })
    })
    it('should fetch order elements', async () => {
      const orderElements = [
        'workspace_order',
        'user_field_order',
        'organization_field_order',
        'ticket_form_order',
        'sla_policy_order',
      ]
      const orderElementsElemIDs = orderElements.map(name => ({
        type: new ElemID(ZENDESK, name),
        instance: new ElemID(ZENDESK, name, 'instance', ElemID.CONFIG_NAME),
      }))
      orderElementsElemIDs.forEach(element => {
        const type = elements.find(e => e.elemID.isEqual(element.type))
        expect(type).toBeDefined()
        const instance = elements.find(e => e.elemID.isEqual(element.instance))
        expect(instance).toBeDefined()
      })
    })
    it('should fetch the newly deployed instances', async () => {
      const instances = Object.values(groupIdToInstances).flat()
      instances
        .filter(inst => ![
          'ticket_field',
          'user_field',
          ...GUIDE_TYPES_TO_HANDLE_BY_BRAND,
        ].includes(inst.elemID.typeName))
        .forEach(instanceToAdd => {
          const instance = elements.find(e => e.elemID.isEqual(instanceToAdd.elemID))
          expect(instance).toBeDefined()
          expect((instance as InstanceElement).value).toMatchObject(instanceToAdd.value)
        })
    })
    it('should fetch ticket_field correctly', async () => {
      const instances = Object.values(groupIdToInstances).flat()
      instances
        .filter(inst => inst.elemID.typeName === 'ticket_field')
        .forEach(instanceToAdd => {
          const instance = elements
            .find(e => e.elemID.isEqual(instanceToAdd.elemID)) as InstanceElement
          expect(instance).toBeDefined()
          expect(
            _.omit(instance.value, ['custom_field_options', 'default_custom_field_option'])
          ).toMatchObject(
            _.omit(instanceToAdd.value, ['custom_field_options', 'default_custom_field_option'])
          )
          expect(instance.value.default_custom_field_option).toBeInstanceOf(ReferenceExpression)
          expect(instance.value.default_custom_field_option.elemID.getFullName())
            .toEqual(instanceToAdd.value.default_custom_field_option.elemID.getFullName())
          expect(instance.value.custom_field_options).toHaveLength(2);
          (instance.value.custom_field_options as Value[]).forEach((option, index) => {
            expect(option).toBeInstanceOf(ReferenceExpression)
            expect(option.elemID.getFullName())
              .toEqual(instanceToAdd.value.custom_field_options[index].elemID.getFullName())
          })
        })
    })
    it('should fetch user_field correctly', async () => {
      const instances = Object.values(groupIdToInstances).flat()
      instances
        .filter(inst => inst.elemID.typeName === 'user_field')
        .forEach(instanceToAdd => {
          const instance = elements
            .find(e => e.elemID.isEqual(instanceToAdd.elemID)) as InstanceElement
          expect(instance).toBeDefined()
          expect(
            _.omit(instance.value, ['custom_field_options'])
          ).toMatchObject(
            // We omit position since we add the user field to the order element
            _.omit(instanceToAdd.value, ['custom_field_options', 'position'])
          )
          expect(instance.value.custom_field_options).toHaveLength(2);
          (instance.value.custom_field_options as Value[]).forEach((option, index) => {
            expect(option).toBeInstanceOf(ReferenceExpression)
            expect(option.elemID.getFullName())
              .toEqual(instanceToAdd.value.custom_field_options[index].elemID.getFullName())
          })
          const userFieldsOrderInstance = elements
            .filter(e => e.elemID.typeName === 'user_field_order')
            .filter(isInstanceElement)
          expect(userFieldsOrderInstance).toHaveLength(1)
          const order = userFieldsOrderInstance[0]
          expect(order.value.active
            .map((ref: ReferenceExpression) => ref.elemID.getFullName()))
            .toContain(instance.elemID.getFullName())
        })
    })
    it('should fetch Guide instances and types', async () => {
      const typesToFetch = Object.keys(GUIDE_SUPPORTED_TYPES)
      const typeNames = elements.filter(isObjectType).map(e => e.elemID.typeName)
      const instances = elements.filter(isInstanceElement)
      typesToFetch.forEach(typeName => {
        expect(typeNames).toContain(typeName)
        const instance = instances.find(e => e.elemID.typeName === typeName)
        expect(instance).toBeDefined()
      })
    })
    it('should handel guide elements correctly ', async () => {
      const fetchedElements = getElementsAfterFetch(guideInstances)
      guideInstances
        .forEach(
          elem => verifyInstanceValues(fetchedElements[elem.elemID.getFullName()], elem, Object.keys(elem.value))
        )
    })
  })
})
