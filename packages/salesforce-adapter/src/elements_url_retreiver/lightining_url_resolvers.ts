/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { isObjectType, Element, isField, Field, isType, isReferenceExpression, ElemID, isInstanceElement } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { apiName, metadataType, isCustomObject, isFieldOfCustomObject } from '../transformers/transformer'
import { getInternalId, isInstanceOfType } from '../filters/utils'

export type ElementIDResolver = (id: ElemID) => Promise<Element | undefined>

export type UrlResolver = (element: Element, baseUrl: URL, elementIDResolver: ElementIDResolver) =>
  Promise<URL | undefined>

const GENERAL_URLS_MAP: Record<string, string> = {
  PermissionSet: 'lightning/setup/PermSets/home',
  PermissionSetGroup: 'lightning/setup/PermSetGroups/home',
  ApexClass: 'lightning/setup/ApexClasses/home',
  Flow: 'lightning/setup/Flows/home',
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

const getTypeIdentifier = async (element?: Element): Promise<string | undefined> =>
  (element === undefined ? undefined : (getInternalId(element) ?? apiName(element)))

const getFieldIdentifier = async (element: Field): Promise<string> =>
  (getInternalId(element) ?? element.annotations.relationshipName ?? apiName(element, true))

const genernalConstantsResolver: UrlResolver = async (element, baseUrl) => {
  if (isObjectType(element) && await metadataType(element) in GENERAL_URLS_MAP) {
    return new URL(`${baseUrl}${GENERAL_URLS_MAP[await metadataType(element)]}`)
  }
  return undefined
}

const settingsConstantsResolver: UrlResolver = async (element, baseUrl) => {
  if (await metadataType(element) in SETTINGS_URLS_MAP) {
    return new URL(`${baseUrl}${SETTINGS_URLS_MAP[await metadataType(element)]}`)
  }
  return undefined
}

const assignmentRulesResolver: UrlResolver = async (element, baseUrl) => {
  if (await isInstanceOfType('AssignmentRules')(element)
    && ['Lead', 'Case'].includes(await apiName(element))) {
    return new URL(`${baseUrl}lightning/setup/${await apiName(element)}Rules/home`)
  }
  return undefined
}

const metadataTypeResolver: UrlResolver = async (element, baseUrl) => {
  const internalId = getInternalId(element)
  if (isType(element)
    && (await apiName(element))?.endsWith('__mdt')
    && internalId !== undefined) {
    return (new URL(`${baseUrl}lightning/setup/CustomMetadata/page?address=%2F${internalId}%3Fsetupid%3DCustomMetadata`))
  }
  return undefined
}

const objectResolver: UrlResolver = async (element, baseUrl) => {
  const typeIdentfier = await getTypeIdentifier(element)
  if (await isCustomObject(element)
    && typeIdentfier !== undefined) {
    return new URL(`${baseUrl}lightning/setup/ObjectManager/${typeIdentfier}/Details/view`)
  }
  return undefined
}

const fieldResolver: UrlResolver = async (element, baseUrl) => {
  if (isField(element) && await isFieldOfCustomObject(element)) {
    const fieldIdentifier = await getFieldIdentifier(element)
    const typeIdentfier = await getTypeIdentifier(element.parent)
    if (fieldIdentifier !== undefined
      && typeIdentfier !== undefined) {
      return new URL(`${baseUrl}lightning/setup/ObjectManager/${typeIdentfier}/FieldsAndRelationships/${fieldIdentifier}/view`)
    }
  }
  return undefined
}

const flowResolver: UrlResolver = async (element, baseUrl) => {
  const internalId = getInternalId(element)
  if (isInstanceElement(element) && await isInstanceOfType('Flow')(element)
    && element.value.processType === 'Flow'
    && internalId !== undefined) {
    return (new URL(`${baseUrl}builder_platform_interaction/flowBuilder.app?flowId=${internalId}`))
  }
  return undefined
}

const workflowResolver: UrlResolver = async (element, baseUrl) => {
  if (isInstanceElement(element) && await isInstanceOfType('Flow')(element)
    && element.value.processType === 'Workflow') {
    // It seems all the process builder flows has the same url so we return the process buider home
    return new URL(`${baseUrl}lightning/setup/ProcessAutomation/home`)
  }
  return undefined
}

const queueResolver: UrlResolver = async (element, baseUrl) => {
  const internalId = getInternalId(element)
  if (await isInstanceOfType('Queue')(element)
    && getInternalId(element) !== undefined) {
    return new URL(`${baseUrl}lightning/setup/Queues/page?address=%2Fp%2Fown%2FQueue%2Fd%3Fid%3D${internalId}`)
  }
  return undefined
}

const layoutResolver: UrlResolver = async (element, baseUrl, elementIDResolver) => {
  const internalId = getInternalId(element)
  const [parentRef] = getParents(element)

  if (await isInstanceOfType('Layout')(element)
      && internalId !== undefined
      && isReferenceExpression(parentRef)) {
    const parent = await elementIDResolver(parentRef.elemID)
    const parentIdentifier = await getTypeIdentifier(parent)
    if (parentIdentifier !== undefined) {
      return new URL(`${baseUrl}lightning/setup/ObjectManager/${parentIdentifier}/PageLayouts/${internalId}/view`)
    }
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

export const resolvers: UrlResolver[] = [genernalConstantsResolver,
  settingsConstantsResolver, assignmentRulesResolver, metadataTypeResolver,
  objectResolver, fieldResolver, flowResolver, workflowResolver, layoutResolver, queueResolver,
  internalIdResolver]
