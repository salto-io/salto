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
  isObjectType,
  Element,
  isField,
  Field,
  isType,
  isReferenceExpression,
  ElemID,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import {
  metadataType,
  isCustomObject,
  isFieldOfCustomObject,
} from '../transformers/transformer'
import {
  apiNameSync,
  getInternalId,
  isInstanceOfTypeSync,
  isInstanceOfCustomObjectSync,
} from '../filters/utils'
import {
  CUSTOM_METADATA_SUFFIX,
  PATH_ASSISTANT_METADATA_TYPE,
} from '../constants'

const { isDefined } = values

export type ElementIDResolver = (id: ElemID) => Promise<Element | undefined>

export type UrlResolver = (
  element: Element,
  baseUrl: URL,
  elementIDResolver: ElementIDResolver,
) => Promise<URL | undefined>

export const FLOW_URL_SUFFIX = 'lightning/setup/Flows/home'

const GENERAL_URLS_MAP: Record<string, string> = {
  PermissionSet: 'lightning/setup/PermSets/home',
  PermissionSetGroup: 'lightning/setup/PermSetGroups/home',
  ApexClass: 'lightning/setup/ApexClasses/home',
  Flow: FLOW_URL_SUFFIX,
  Profile: 'lightning/setup/EnhancedProfiles/home',
  CustomMetadata: 'lightning/setup/CustomMetadata/home',
  CustomPermission: 'lightning/setup/CustomPermissions/home',
  ApexComponent: 'lightning/setup/ApexComponents/home',
  ApexPage: 'lightning/setup/ApexPages/home',
  EmailTemplate: 'lightning/setup/CommunicationTemplatesEmail/home',
  ReportType: 'lightning/setup/CustomReportTypes/home',
  AnalyticSnapshot: 'lightning/setup/AnalyticSnapshots/home',
  ApexTrigger: 'lightning/setup/ApexTriggers/home',
  Queue: 'lightning/setup/Queues/home',
  LightningComponentBundle: 'lightning/setup/LightningComponentBundles/home',
  Report: 'lightning/o/Report/home',
  Dashboard: 'lightning/o/Dashboard/home',
}

const SETTINGS_URLS_MAP: Record<string, string> = {
  BusinessHoursSettings: 'lightning/setup/BusinessHours/home',
  LanguageSettings: 'lightning/setup/LanguageSettings/home',
  MyDomainSettings: 'lightning/setup/OrgDomain/home',
  ApexSettings: 'lightning/setup/ApexSettings/home',
}

const METADATA_TYPE_TO_URI: Record<string, string> = {
  Layout: 'PageLayouts',
  RecordType: 'RecordTypes',
  WebLink: 'ButtonsLinksActions',
  ValidationRule: 'ValidationRules',
  LightningPage: 'LightningPages',
  FieldSet: 'FieldSets',
}

const getTypeIdentifier = (element?: Element): string | undefined =>
  element === undefined
    ? undefined
    : getInternalId(element) ?? apiNameSync(element)

const getFieldIdentifier = (element: Field): string =>
  getInternalId(element) ??
  element.annotations.relationshipName ??
  apiNameSync(element, true)

const generalConstantsResolver: UrlResolver = async (element, baseUrl) => {
  if (
    isObjectType(element) &&
    (await metadataType(element)) in GENERAL_URLS_MAP
  ) {
    return new URL(`${baseUrl}${GENERAL_URLS_MAP[await metadataType(element)]}`)
  }
  return undefined
}

const settingsConstantsResolver: UrlResolver = async (element, baseUrl) => {
  if ((await metadataType(element)) in SETTINGS_URLS_MAP) {
    return new URL(
      `${baseUrl}${SETTINGS_URLS_MAP[await metadataType(element)]}`,
    )
  }
  return undefined
}

const assignmentRulesResolver: UrlResolver = async (element, baseUrl) => {
  const apiName = apiNameSync(element)
  if (apiName === undefined) {
    return undefined
  }

  if (
    isInstanceOfTypeSync('AssignmentRules')(element) &&
    ['Lead', 'Case'].includes(apiName)
  ) {
    return new URL(`${baseUrl}lightning/setup/${apiName}Rules/home`)
  }
  return undefined
}

const autoResponseRulesResolver: UrlResolver = async (element, baseUrl) => {
  const apiName = apiNameSync(element)
  if (apiName === undefined) {
    return undefined
  }

  if (
    isInstanceOfTypeSync('AutoResponseRules')(element) &&
    ['Lead', 'Case'].includes(apiName)
  ) {
    return new URL(`${baseUrl}lightning/setup/${apiName}Responses/home`)
  }
  return undefined
}

const metadataTypeResolver: UrlResolver = async (element, baseUrl) => {
  const internalId = getInternalId(element)
  if (
    isType(element) &&
    apiNameSync(element)?.endsWith(CUSTOM_METADATA_SUFFIX) &&
    internalId !== undefined
  ) {
    return new URL(
      `${baseUrl}lightning/setup/CustomMetadata/page?address=%2F${internalId}%3Fsetupid%3DCustomMetadata`,
    )
  }
  return undefined
}

const objectResolver: UrlResolver = async (element, baseUrl) => {
  const typeIdentifier = getTypeIdentifier(element)
  if ((await isCustomObject(element)) && typeIdentifier !== undefined) {
    return new URL(
      `${baseUrl}lightning/setup/ObjectManager/${typeIdentifier}/Details/view`,
    )
  }
  return undefined
}

const fieldResolver: UrlResolver = async (element, baseUrl) => {
  if (isField(element) && (await isFieldOfCustomObject(element))) {
    const fieldIdentifier = getFieldIdentifier(element)
    const typeIdentifier = getTypeIdentifier(element.parent)
    if (fieldIdentifier !== undefined && typeIdentifier !== undefined) {
      return new URL(
        `${baseUrl}lightning/setup/ObjectManager/${typeIdentifier}/FieldsAndRelationships/${fieldIdentifier}/view`,
      )
    }
  }
  return undefined
}

const flowResolver: UrlResolver = async (element, baseUrl) => {
  const internalId = getInternalId(element)
  if (
    isInstanceElement(element) &&
    isInstanceOfTypeSync('Flow')(element) &&
    (element.value.processType === 'Flow' ||
      element.value.processType === 'AutoLaunchedFlow') &&
    internalId !== undefined
  ) {
    return new URL(
      `${baseUrl}builder_platform_interaction/flowBuilder.app?flowId=${internalId}`,
    )
  }
  return undefined
}

const workflowResolver: UrlResolver = async (element, baseUrl) => {
  if (
    isInstanceElement(element) &&
    isInstanceOfTypeSync('Flow')(element) &&
    element.value.processType === 'Workflow'
  ) {
    // It seems all the process builder flows has the same url so we return the process builder home
    return new URL(`${baseUrl}lightning/setup/ProcessAutomation/home`)
  }
  return undefined
}

const queueResolver: UrlResolver = async (element, baseUrl) => {
  const internalId = getInternalId(element)
  if (
    isInstanceOfTypeSync('Queue')(element) &&
    getInternalId(element) !== undefined
  ) {
    return new URL(
      `${baseUrl}lightning/setup/Queues/page?address=%2Fp%2Fown%2FQueue%2Fd%3Fid%3D${internalId}`,
    )
  }
  return undefined
}

const customObjectSubInstanceResolver: UrlResolver = async (
  element,
  baseUrl,
  elementIDResolver,
) => {
  if (!isInstanceElement(element)) {
    return undefined
  }

  const instanceType = apiNameSync(await element.getType())
  if (instanceType === undefined) {
    return undefined
  }
  const instanceUri = METADATA_TYPE_TO_URI[instanceType]

  const internalId = getInternalId(element)
  const [parentRef] = getParents(element)

  if (
    instanceUri === undefined ||
    internalId === undefined ||
    !isReferenceExpression(parentRef)
  ) {
    return undefined
  }
  const parent = await elementIDResolver(parentRef.elemID)
  const parentIdentifier = getTypeIdentifier(parent)
  if (parentIdentifier !== undefined) {
    return new URL(
      `${baseUrl}lightning/setup/ObjectManager/${parentIdentifier}/${instanceUri}/${internalId}/view`,
    )
  }
  return undefined
}

const internalIdResolver: UrlResolver = async (element, baseUrl) => {
  const internalId = getInternalId(element)
  if (internalId !== undefined) {
    return new URL(`${baseUrl}lightning/_classic/%2F${internalId}`)
  }
  return undefined
}

const pathAssistantResolver: UrlResolver = async (element, baseUrl) => {
  if (isInstanceOfTypeSync(PATH_ASSISTANT_METADATA_TYPE)(element)) {
    return new URL(
      `${baseUrl}lightning/setup/PathAssistantSetupHome/page?address=%2Fui%2Fsetup%2Fpathassistant%2FPathAssistantSetupPage%3Fisdtp%3Dp1`,
    )
  }
  return undefined
}

const instanceCustomObjectResolver: UrlResolver = async (element, baseUrl) => {
  if (isInstanceOfCustomObjectSync(element)) {
    const instanceId = apiNameSync(element)
    const typeId = isInstanceElement(element)
      ? apiNameSync(await element.getType())
      : undefined
    return isDefined(typeId)
      ? new URL(`${baseUrl}lightning/r/${typeId}/${instanceId}/view`)
      : undefined
  }
  return undefined
}

export const resolvers: UrlResolver[] = [
  generalConstantsResolver,
  settingsConstantsResolver,
  assignmentRulesResolver,
  autoResponseRulesResolver,
  metadataTypeResolver,
  objectResolver,
  fieldResolver,
  flowResolver,
  workflowResolver,
  customObjectSubInstanceResolver,
  queueResolver,
  pathAssistantResolver,
  internalIdResolver,
  instanceCustomObjectResolver,
]
