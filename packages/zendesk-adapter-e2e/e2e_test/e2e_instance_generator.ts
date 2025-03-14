/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  FieldDefinition,
  InstanceElement,
  isStaticFile,
  ListType,
  ObjectType,
  ReferenceExpression,
  StaticFile,
  TemplateExpression,
  Values,
} from '@salto-io/adapter-api'
import { elements as elementUtils, e2eUtils } from '@salto-io/adapter-components'
import { e2eUtils as zendeskE2eUtils } from '@salto-io/zendesk-adapter'
import _ from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'
import * as path from 'path'
import { parserUtils } from '@salto-io/parser'
import { mockDefaultValues } from './mock_elements'

const {
  TRIGGER_CATEGORY_TYPE_NAME,
  TRIGGER_TYPE_NAME,
  ARTICLE_ATTACHMENT_TYPE_NAME,
  ARTICLE_ATTACHMENTS_FIELD,
  ARTICLE_ORDER_TYPE_NAME,
  ARTICLE_TRANSLATION_TYPE_NAME,
  ARTICLE_TYPE_NAME,
  CATEGORY_TRANSLATION_TYPE_NAME,
  CATEGORY_TYPE_NAME,
  CUSTOM_FIELD_OPTIONS_FIELD_NAME,
  CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_TYPE_NAME,
  CUSTOM_OBJECT_TYPE_NAME,
  DEFAULT_CONFIG,
  GUIDE,
  GUIDE_THEME_TYPE_NAME,
  PERMISSION_GROUP_TYPE_NAME,
  SECTION_ORDER_TYPE_NAME,
  SECTION_TRANSLATION_TYPE_NAME,
  SECTION_TYPE_NAME,
  shortElemIdHash,
  SUPPORT_ADDRESS_TYPE_NAME,
  TRANSLATIONS_FIELD,
  unzipFolderToElements,
  USER_SEGMENT_TYPE_NAME,
  VIEW_TYPE_NAME,
  ZENDESK,
  createFetchDefinitions,
  CONVERSATION_BOT,
  BOT_BUILDER_ANSWER,
  BOT_BUILDER_NODE,
} = zendeskE2eUtils

export const TYPES_NOT_TO_REMOVE = new Set<string>([
  SUPPORT_ADDRESS_TYPE_NAME, // this is usually the default of the brand and zendesk does not allow deleting the default
])
export const UNIQUE_NAME = 'E2ETestName'
export const HELP_CENTER_BRAND_NAME = 'e2eHelpCenter'
export const HIDDEN_PER_TYPE: Record<string, string[]> = {
  [VIEW_TYPE_NAME]: ['title'],
  [SECTION_TYPE_NAME]: ['direct_parent_id', 'direct_parent_type'],
}
const { replaceInstanceTypeForDeploy } = elementUtils.ducktype

const fetchDefinitions = createFetchDefinitions({})

const createInstanceElementFunc =
  (types: ObjectType[]) =>
  ({
    type,
    valuesOverride,
    parent,
  }: {
    type: string
    valuesOverride: Values
    fields?: Record<string, FieldDefinition>
    parent?: InstanceElement
  }): InstanceElement => {
    const instValues = {
      ...mockDefaultValues[type],
      ...valuesOverride,
    }
    return e2eUtils.createInstance({
      fetchDefinitions,
      typeName: type,
      types,
      values: instValues,
      parent,
    })
  }

const createRootForTheme = async (
  buffer: Buffer,
  brand: InstanceElement,
  name: string,
): Promise<zendeskE2eUtils.ThemeDirectory> => {
  const root = await unzipFolderToElements({
    buffer,
    currentBrandName: brand.value.name,
    folderName: name,
    idsToElements: {},
    matchBrandSubdomain: (url: string) => (url === brand.value.brand_url ? brand : undefined),
    config: {
      referenceOptions: {
        enableReferenceLookup: true,
        javascriptReferenceLookupStrategy: {
          strategy: 'numericValues',
          minimumDigitAmount: 6,
        },
      },
    },
  })
  const { content } = root.files['manifest_json@v']
  expect(isStaticFile(content)).toBeTruthy()
  if (!isStaticFile(content)) {
    return root
  }
  const manifestBuffer = await content.getContent()
  expect(manifestBuffer).toBeDefined()
  if (manifestBuffer === undefined) {
    return root
  }
  const stringManifest = manifestBuffer.toString()
  root.files['manifest_json@v'].content = new StaticFile({
    filepath: `${ZENDESK}/themes/brands/${brand.value.name}/${name}/manifest.json`,
    content: Buffer.from(stringManifest.replace('Copenhagen', name)),
  })
  return root
}

const testSuffix = uuidv4().slice(0, 8)
const testOptionValue = uuidv4().slice(0, 8)
const createName = (type: string): string => `${UNIQUE_NAME}${type}${testSuffix}`
const createSubdomainName = (): string => `test${testSuffix}`

// ******************* create all elements for deploy *******************
export const getAllInstancesToDeploy = async ({
  brandInstanceE2eHelpCenter,
  defaultGroup,
  types,
}: {
  brandInstanceE2eHelpCenter: InstanceElement
  defaultGroup: InstanceElement
  types: ObjectType[]
}): Promise<{
  instancesToDeploy: InstanceElement[]
  guideInstances: InstanceElement[]
  guideThemeInstance: InstanceElement
}> => {
  const createInstanceElement = createInstanceElementFunc(types)
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
  const queueInstance = createInstanceElement({
    type: 'queue',
    valuesOverride: {
      name: createName('queue'),
      primary_groups_id: [new ReferenceExpression(defaultGroup.elemID, defaultGroup)],
    },
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
    valuesOverride: { title: createName('view'), raw_title: createName('view') },
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
      raw_name: ticketFieldOption1Name,
      value: ticketFieldOption1Value,
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(ticketFieldInstance.elemID, ticketFieldInstance)],
    },
  )
  const ticketFieldOption2Name = `ticketFieldOption2${testSuffix}`
  const ticketFieldOption2Value = `v2t${testOptionValue}`
  const ticketFieldOption2 = new InstanceElement(
    `${ticketFieldInstance.elemID.name}__${ticketFieldOption2Value}`,
    ticketFieldOptionType,
    {
      raw_name: ticketFieldOption2Name,
      value: ticketFieldOption2Value,
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(ticketFieldInstance.elemID, ticketFieldInstance)],
    },
  )
  ticketFieldInstance.value.custom_field_options = [
    new ReferenceExpression(ticketFieldOption1.elemID, ticketFieldOption1),
    new ReferenceExpression(ticketFieldOption2.elemID, ticketFieldOption2),
  ]
  ticketFieldInstance.value.default_custom_field_option = new ReferenceExpression(
    ticketFieldOption1.elemID,
    ticketFieldOption1,
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
      raw_name: userFieldOption1Name,
      value: userFieldOption1Value,
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(userFieldInstance.elemID, userFieldInstance)],
    },
  )
  const userFieldOption2Name = `userFieldOption2${testSuffix}`
  const userFieldOption2Value = `v2u${testOptionValue}`
  const userFieldOption2 = new InstanceElement(
    `${userFieldInstance.elemID.name}__${userFieldOption2Value}`,
    userFieldOptionType,
    {
      raw_name: userFieldOption2Name,
      value: userFieldOption2Value,
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(userFieldInstance.elemID, userFieldInstance)],
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

  const layoutInstance = createInstanceElement({
    type: 'layout',
    valuesOverride: { title: createName('layout') },
  })

  const workspaceInstance = createInstanceElement({
    type: 'workspace',
    valuesOverride: {
      title: createName('workspace'),
      layout_uuid: new ReferenceExpression(layoutInstance.elemID, layoutInstance),
    },
  })

  const customObjName = createName('custom_object')
  const customObjectInstance = createInstanceElement({
    type: CUSTOM_OBJECT_TYPE_NAME,
    valuesOverride: {
      key: `key${customObjName}`,
      raw_title: `title${customObjName}`,
      raw_title_pluralized: `titles${customObjName}`,
      raw_description: `description${customObjName}`,
    },
  })

  const customObjectFieldInstance1Key = `key1${testSuffix}`
  const customObjectFieldInstance1 = createInstanceElement({
    type: CUSTOM_OBJECT_FIELD_TYPE_NAME,
    valuesOverride: {
      type: 'dropdown',
      key: `${customObjectFieldInstance1Key}`,
      raw_title: `title1${testSuffix}`,
      raw_description: `description1${testSuffix}`,
      system: false,
      active: true,
    },
    parent: customObjectInstance,
  })

  const customObjectFieldInstance2Key = `key2${testSuffix}`
  const customObjectFieldInstance2 = createInstanceElement({
    type: CUSTOM_OBJECT_FIELD_TYPE_NAME,
    valuesOverride: {
      type: 'lookup',
      key: `${customObjectFieldInstance2Key}`,
      raw_title: `title2${testSuffix}`,
      raw_description: `description2${testSuffix}`,
      relationship_target_type: 'zen:ticket',
      system: false,
      active: true,
    },
    parent: customObjectInstance,
  })

  const customObjectFieldOptionInstance1Value = `value1${testSuffix}`
  const customObjectFieldOptionInstance1 = createInstanceElement({
    type: CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
    valuesOverride: {
      raw_name: `name1${testSuffix}`,
      value: customObjectFieldOptionInstance1Value,
    },
    parent: customObjectFieldInstance1,
  })

  const customObjectFieldOptionInstance2Value = `value2${testSuffix}`
  const customObjectFieldOptionInstance2 = createInstanceElement({
    type: CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
    valuesOverride: {
      raw_name: `name2${testSuffix}`,
      value: customObjectFieldOptionInstance2Value,
    },
    parent: customObjectFieldInstance1,
  })

  customObjectInstance.value.custom_object_fields = [
    new ReferenceExpression(customObjectFieldInstance1.elemID, customObjectFieldInstance1),
    new ReferenceExpression(customObjectFieldInstance2.elemID, customObjectFieldInstance2),
  ]
  customObjectFieldInstance1.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [
    new ReferenceExpression(customObjectFieldOptionInstance1.elemID, customObjectFieldOptionInstance1),
    new ReferenceExpression(customObjectFieldOptionInstance2.elemID, customObjectFieldOptionInstance2),
  ]

  const triggerCategoryName = createName('trigger_category')
  const triggerCategoryInstance = createInstanceElement({
    type: TRIGGER_CATEGORY_TYPE_NAME,
    valuesOverride: { name: triggerCategoryName },
  })

  const triggerName = createName('trigger')
  const triggerInstance = createInstanceElement({
    type: TRIGGER_TYPE_NAME,
    valuesOverride: {
      title: triggerName,
      active: true,
      default: false,
      actions: [
        {
          field: 'status',
          value: 'open',
        },
        {
          field: 'group_id',
          value: new ReferenceExpression(defaultGroup.elemID),
        },
      ],
      conditions: {
        all: [
          {
            field: 'status',
            operator: 'is',
            value: 'new',
          },
          {
            field: 'group_id',
            operator: 'is',
            value: new ReferenceExpression(defaultGroup.elemID),
          },
        ],
        any: [
          {
            field: 'brand_id',
            operator: 'is',
            value: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID),
          },
          {
            field: new ReferenceExpression(ticketFieldInstance.elemID),
            operator: 'is',
            value: new ReferenceExpression(ticketFieldOption1.elemID),
          },
        ],
      },
      description: '',
      raw_title: triggerName,
      category_id: new ReferenceExpression(triggerCategoryInstance.elemID),
    },
  })

  const conversationBotInstance = createInstanceElement({
    type: CONVERSATION_BOT,
    valuesOverride: {
      name: createName('conversation_bot'),
      brandId: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
    },
  })
  const conversationBotAnswerInstance = createInstanceElement({
    type: BOT_BUILDER_ANSWER,
    valuesOverride: {
      flowId: new ReferenceExpression(conversationBotInstance.elemID, conversationBotInstance),
    },
    parent: conversationBotInstance,
  })
  const conversationBotNodeInstance = createInstanceElement({
    type: BOT_BUILDER_NODE,
    valuesOverride: {},
    parent: conversationBotAnswerInstance,
  })
  conversationBotAnswerInstance.value.nodes = [new ReferenceExpression(conversationBotNodeInstance.elemID)]
  conversationBotInstance.value.subflows = [new ReferenceExpression(conversationBotAnswerInstance.elemID)]

  // ***************** guide instances ******************* //

  const guideLanguageSettingsEn = createInstanceElement({
    type: 'guide_language_settings',
    valuesOverride: {
      locale: 'en-us',
      name: 'english',
      brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
    },
  })
  const guideLanguageSettingsHe = createInstanceElement({
    type: 'guide_language_settings',
    valuesOverride: {
      locale: 'he',
      name: 'hebrew',
      brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
    },
  })

  const categoryName = createName('category')
  const categoryInstance = replaceInstanceTypeForDeploy({
    instance: createInstanceElement({
      type: CATEGORY_TYPE_NAME,
      valuesOverride: {
        name: categoryName,
        locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
        source_locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
        brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
      },
      fields: { translations: { refType: new ListType(BuiltinTypes.UNKNOWN) } },
    }),
    config: DEFAULT_CONFIG.apiDefinitions,
  })
  categoryInstance.value.name = undefined // we add the name only to generate the elemId, it's added and removed in packages/zendesk-adapter/src/filters/guide_section_and_category.ts
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
  })

  categoryInstance.value.translations = [
    new ReferenceExpression(categoryEnTranslationInstance.elemID, categoryEnTranslationInstance),
    new ReferenceExpression(categoryHeTranslationInstance.elemID, categoryHeTranslationInstance),
  ]

  const sectionName = createName('section')
  const sectionInstance = createInstanceElement({
    type: SECTION_TYPE_NAME,
    valuesOverride: {
      name: sectionName,
      locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
      source_locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
      brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
      category_id: new ReferenceExpression(categoryInstance.elemID, categoryInstance),
      direct_parent_id: new ReferenceExpression(categoryInstance.elemID, categoryInstance),
      direct_parent_type: CATEGORY_TYPE_NAME,
    },
    fields: { translations: { refType: new ListType(BuiltinTypes.UNKNOWN) } },
  })
  sectionInstance.value.name = undefined // we add the name only to generate the elemId, it's added and removed in packages/zendesk-adapter/src/filters/guide_section_and_category.ts
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
  })
  sectionInstance.value.translations = [
    new ReferenceExpression(sectionEnTranslationInstance.elemID, sectionEnTranslationInstance),
    new ReferenceExpression(sectionHeTranslationInstance.elemID, sectionHeTranslationInstance),
  ]
  const section2Name = createName('sectionTwo')
  const section2Instance = createInstanceElement({
    type: SECTION_TYPE_NAME,
    valuesOverride: {
      name: section2Name,
      locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
      source_locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
      brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
      category_id: new ReferenceExpression(categoryInstance.elemID, categoryInstance),
      direct_parent_id: new ReferenceExpression(categoryInstance.elemID, categoryInstance),
      direct_parent_type: CATEGORY_TYPE_NAME,
    },
    fields: { translations: { refType: new ListType(BuiltinTypes.UNKNOWN) } },
  })
  section2Instance.value.name = undefined // we add the name only to generate the elemId, it's added and removed in packages/zendesk-adapter/src/filters/guide_section_and_category.ts
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
  })
  section2Instance.value.translations = [
    new ReferenceExpression(section2EnTranslationInstance.elemID, section2EnTranslationInstance),
  ]
  const section3Name = createName('sectionThree')
  const section3Instance = createInstanceElement({
    type: SECTION_TYPE_NAME,
    valuesOverride: {
      name: section3Name,
      locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
      source_locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
      brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
      category_id: new ReferenceExpression(categoryInstance.elemID, categoryInstance),
      direct_parent_id: new ReferenceExpression(categoryInstance.elemID, categoryInstance),
      direct_parent_type: CATEGORY_TYPE_NAME,
    },
    fields: { translations: { refType: new ListType(BuiltinTypes.UNKNOWN) } },
  })
  section3Instance.value.name = undefined // we add the name only to generate the elemId, it's added and removed in packages/zendesk-adapter/src/filters/guide_section_and_category.ts
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
  })

  const insideSectionName = createName('section')
  const insideSectionInstance = createInstanceElement({
    type: SECTION_TYPE_NAME,
    valuesOverride: {
      name: insideSectionName,
      locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
      source_locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
      brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
      category_id: new ReferenceExpression(categoryInstance.elemID, categoryInstance),
      parent_section_id: new ReferenceExpression(sectionInstance.elemID, sectionInstance),
      direct_parent_id: new ReferenceExpression(sectionInstance.elemID, sectionInstance),
      direct_parent_type: SECTION_TYPE_NAME,
    },
    fields: { translations: { refType: new ListType(BuiltinTypes.UNKNOWN) } },
  })
  insideSectionInstance.value.name = undefined // we add the name only to generate the elemId, it's added and removed in packages/zendesk-adapter/src/filters/guide_section_and_category.ts
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
      title: articleName,
      promoted: false,
      section_id: new ReferenceExpression(sectionInstance.elemID, sectionInstance),
      source_locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
      locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
      outdated: false,
      permission_group_id: new ReferenceExpression(permissionGroup.elemID, permissionGroup),
      brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
      user_segment_id: new ReferenceExpression(everyoneUserSegment.elemID, everyoneUserSegment),
    },
  })
  articleInstance.value.title = undefined // we add the title only to generate the elemId, it's removed in a filter

  const attachmentName = createName('attachment')
  const fileName = `nacl${attachmentName}`
  const articleAttachment = createInstanceElement({
    type: ARTICLE_ATTACHMENT_TYPE_NAME,
    valuesOverride: {
      file_name: fileName,
      content_type: 'image/png',
      inline: false,
      brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
    },
    parent: articleInstance,
  })
  articleAttachment.value.content = new StaticFile({
    filepath: `${ZENDESK}/${ARTICLE_ATTACHMENTS_FIELD}/${GUIDE}/brands/${HELP_CENTER_BRAND_NAME}/categories/${categoryName}/sections/${sectionName}/articles/${articleName}/article_attachment/${fileName}/${shortElemIdHash(articleAttachment.elemID)}_80f6f478ed_${fileName}`,
    content: fs.readFileSync(path.resolve(`${__dirname}/../e2e_test/images/nacl.png`)),
  })
  const inlineFileName = `naclTwo${attachmentName}`
  const articleInlineAttachment = createInstanceElement({
    type: ARTICLE_ATTACHMENT_TYPE_NAME,
    valuesOverride: {
      file_name: inlineFileName,
      content_type: 'image/png',
      inline: true,
      brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
    },
    parent: articleInstance,
  })
  articleInlineAttachment.value.content = new StaticFile({
    filepath: `${ZENDESK}/${ARTICLE_ATTACHMENTS_FIELD}/${GUIDE}/brands/${HELP_CENTER_BRAND_NAME}/categories/${categoryName}/sections/${sectionName}/articles/${articleName}/article_attachment/${inlineFileName}/${shortElemIdHash(articleInlineAttachment.elemID)}_80f6f478ed_${inlineFileName}`,
    content: fs.readFileSync(path.resolve(`${__dirname}/../e2e_test/images/nacl.png`)),
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
      locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
      outdated: false,
      brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
    },
    parent: articleInstance,
  })
  articleTranslationEn.value.body = parserUtils.templateExpressionToStaticFile(
    new TemplateExpression({
      parts: [
        '<p>this is a test <img src="',
        new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
        '/hc/article_attachments/',
        new ReferenceExpression(articleInlineAttachment.elemID, articleInlineAttachment),
        `" alt="${inlineFileName}.png"></p><p></p>`,
      ],
    }),
    `${ZENDESK}/${TRANSLATIONS_FIELD}/${GUIDE}/brands/${HELP_CENTER_BRAND_NAME}/categories/${categoryName}/sections/${sectionName}/articles/${articleName}/translations/${shortElemIdHash(articleTranslationEn.elemID)}_${articleTranslationEn.value.title}`,
  )

  const articleTranslationHe = createInstanceElement({
    type: ARTICLE_TRANSLATION_TYPE_NAME,
    valuesOverride: {
      draft: true,
      title: `${articleName}_he`,
      locale: new ReferenceExpression(guideLanguageSettingsHe.elemID, guideLanguageSettingsHe),
      outdated: false,
      brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
    },
    parent: articleInstance,
  })
  articleTranslationHe.value.body = new StaticFile({
    content: Buffer.from('זאת בדיקה בעברית'),
    filepath: `${ZENDESK}/${TRANSLATIONS_FIELD}/${GUIDE}/brands/${HELP_CENTER_BRAND_NAME}/categories/${categoryName}/sections/${sectionName}/articles/${articleName}/translations/${shortElemIdHash(articleTranslationHe.elemID)}_${articleTranslationHe.value.title}`,
  })
  articleInstance.value.translations = [
    new ReferenceExpression(articleTranslationEn.elemID, articleTranslationEn),
    new ReferenceExpression(articleTranslationHe.elemID, articleTranslationHe),
  ]

  const article2Name = createName('articleTwo')
  const article2Instance = createInstanceElement({
    type: ARTICLE_TYPE_NAME,
    valuesOverride: {
      title: article2Name,
      promoted: false,
      section_id: new ReferenceExpression(sectionInstance.elemID, sectionInstance),
      source_locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
      locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
      outdated: false,
      permission_group_id: new ReferenceExpression(permissionGroup.elemID, permissionGroup),
      brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
      user_segment_id: new ReferenceExpression(everyoneUserSegment.elemID, everyoneUserSegment),
    },
  })
  article2Instance.value.title = undefined // we add the title only to generate the elemId, it's removed in a filter

  const article2TranslationEn = createInstanceElement({
    type: ARTICLE_TRANSLATION_TYPE_NAME,
    valuesOverride: {
      draft: true,
      title: `${article2Name}`,
      locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
      outdated: false,
      brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
    },
    parent: article2Instance,
  })
  article2TranslationEn.value.body = new StaticFile({
    content: Buffer.from('this is a test'),
    filepath: `${ZENDESK}/${TRANSLATIONS_FIELD}/${GUIDE}/brands/${HELP_CENTER_BRAND_NAME}/categories/${categoryName}/sections/${sectionName}/articles/${article2Name}/translations/${shortElemIdHash(article2TranslationEn.elemID)}_${article2TranslationEn.value.title}`,
  })

  article2Instance.value.translations = [new ReferenceExpression(article2TranslationEn.elemID, article2TranslationEn)]

  const article3Name = createName('articleThree')
  const article3Instance = createInstanceElement({
    type: ARTICLE_TYPE_NAME,
    valuesOverride: {
      title: article3Name,
      promoted: false,
      section_id: new ReferenceExpression(sectionInstance.elemID, sectionInstance),
      source_locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
      locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
      outdated: false,
      permission_group_id: new ReferenceExpression(permissionGroup.elemID, permissionGroup),
      brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
      user_segment_id: new ReferenceExpression(everyoneUserSegment.elemID, everyoneUserSegment),
    },
  })
  article3Instance.value.title = undefined // we add the title only to generate the elemId, it's removed in a filter

  const article3TranslationEn = createInstanceElement({
    type: ARTICLE_TRANSLATION_TYPE_NAME,
    valuesOverride: {
      draft: true,
      title: `${article3Name}`,
      locale: new ReferenceExpression(guideLanguageSettingsEn.elemID, guideLanguageSettingsEn),
      outdated: false,
      brand: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
    },
    parent: article3Instance,
  })
  article3TranslationEn.value.body = new StaticFile({
    content: Buffer.from('this is a test'),
    filepath: `${ZENDESK}/${TRANSLATIONS_FIELD}/${GUIDE}/brands/${HELP_CENTER_BRAND_NAME}/categories/${categoryName}/sections/${sectionName}/articles/${article3Name}/translations/${shortElemIdHash(article3TranslationEn.elemID)}_${article3TranslationEn.value.title}`,
  })

  article3Instance.value.translations = [new ReferenceExpression(article3TranslationEn.elemID, article3TranslationEn)]

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
  })

  const guideThemeName = createName('theme')
  const guideThemeInstance = createInstanceElement({
    type: GUIDE_THEME_TYPE_NAME,
    valuesOverride: {
      name: guideThemeName,
      root: await createRootForTheme(
        fs.readFileSync(path.resolve(`${__dirname}/../e2e_test/theme_zip/Copenhagen.zip`)),
        brandInstanceE2eHelpCenter,
        guideThemeName,
      ),
      brand_id: new ReferenceExpression(brandInstanceE2eHelpCenter.elemID, brandInstanceE2eHelpCenter),
    },
  })

  const customObjectInstances = [
    customObjectInstance,
    customObjectFieldInstance1,
    customObjectFieldInstance2,
    customObjectFieldOptionInstance1,
    customObjectFieldOptionInstance2,
  ]

  const guideInstances = [
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
    article2Instance,
    article3Instance,
    articleTranslationEn,
    articleTranslationHe,
    article2TranslationEn,
    article3TranslationEn,
    articleOrder,
  ]

  const instancesToAdd = [
    triggerCategoryInstance,
    triggerInstance,
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
    queueInstance,
    macroInstance,
    slaPolicyInstance,
    viewInstance,
    brandInstanceToAdd,
    userSegmentInstance,
    layoutInstance,
    workspaceInstance,
    conversationBotInstance,
    conversationBotAnswerInstance,
    conversationBotNodeInstance,
    ...customObjectInstances,
    // guide elements
    ...guideInstances,
    guideThemeInstance,
  ]
  return { instancesToDeploy: instancesToAdd, guideInstances, guideThemeInstance }
}
