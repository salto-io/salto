/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { isObjectType, Element, isField, Field, isInstanceElement, isType, ElementIDResolver, CORE_ANNOTATIONS, isElement, isReferenceExpression } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { metadataType } from '../transformers/transformer'
import { getInternalId } from '../filters/utils'

export type UrlResolver = (element: Element, baseUrl: URL, _elementIDResolver: ElementIDResolver) =>
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

const getTypeIdentifier = (element: Element | undefined): string | undefined =>
  (element === undefined ? undefined : (getInternalId(element) ?? element.annotations.apiName))

const getFieldIdentifier = (element: Field): string =>
  (getInternalId(element) ?? element.annotations.relationshipName ?? element.name)

const genernalConstantsResolver: UrlResolver = async (element, baseUrl, _elementIDResolver) => {
  if (isObjectType(element) && metadataType(element) in GENERAL_URLS_MAP) {
    return new URL(`${baseUrl}${GENERAL_URLS_MAP[element.annotations.metadataType]}`)
  }
  return undefined
}

const settingsConstantsResolver: UrlResolver = async (element, baseUrl, _elementIDResolver) => {
  if (metadataType(element) in SETTINGS_URLS_MAP) {
    return new URL(`${baseUrl}${SETTINGS_URLS_MAP[metadataType(element)]}`)
  }
  return undefined
}

const assignmentRulesResolver: UrlResolver = async (element, baseUrl, _elementIDResolver) => {
  if (isInstanceElement(element)
    && metadataType(element) === 'AssignmentRules'
    && ['Lead', 'Case'].includes(element.value.fullName)) {
    return new URL(`${baseUrl}lightning/setup/${element.value.fullName}Rules/home`)
  }
  return undefined
}

const metadataTypeResolver: UrlResolver = async (element, baseUrl, _elementIDResolver) => {
  const internalId = getInternalId(element)
  if (isType(element)
    && element.annotations.apiName?.endsWith('__mdt')
    && internalId !== undefined) {
    return (new URL(`${baseUrl}lightning/setup/CustomMetadata/page?address=%2F${internalId}%3Fsetupid%3DCustomMetadata`))
  }
  return undefined
}

const objectResolver: UrlResolver = async (element, baseUrl, _elementIDResolver) => {
  const typeIdentfier = getTypeIdentifier(element)
  if (isObjectType(element)
    && metadataType(element) === 'CustomObject'
    && typeIdentfier !== undefined) {
    return new URL(`${baseUrl}lightning/setup/ObjectManager/${typeIdentfier}/Details/view`)
  }
  return undefined
}

const fieldResolver: UrlResolver = async (element, baseUrl, _elementIDResolver) => {
  if (isField(element)) {
    const fieldIdentifier = getFieldIdentifier(element)
    const typeIdentfier = getTypeIdentifier(element.parent)
    if (fieldIdentifier !== undefined
      && metadataType(element.parent) === 'CustomObject'
      && typeIdentfier !== undefined) {
      return new URL(`${baseUrl}lightning/setup/ObjectManager/${typeIdentfier}/FieldsAndRelationships/${fieldIdentifier}/view`)
    }
  }
  return undefined
}

const flowResolver: UrlResolver = async (element, baseUrl, _elementIDResolver) => {
  const internalId = getInternalId(element)
  if (isInstanceElement(element)
    && metadataType(element) === 'Flow'
    && element.value.processType === 'Flow'
    && internalId !== undefined) {
    return (new URL(`${baseUrl}builder_platform_interaction/flowBuilder.app?flowId=${internalId}`))
  }
  return undefined
}

const workflowResolver: UrlResolver = async (element, baseUrl, _elementIDResolver) => {
  if (isInstanceElement(element)
    && metadataType(element) === 'Flow'
    && element.value.processType === 'Workflow') {
    // It seems all the process builder flows has the same url so we return the process buider home
    return new URL(`${baseUrl}lightning/setup/ProcessAutomation/home`)
  }
  return undefined
}

const queueResolver: UrlResolver = async (element, baseUrl, _elementIDResolver) => {
  const internalId = getInternalId(element)
  if (isInstanceElement(element)
    && metadataType(element) === 'Queue'
    && getInternalId(element) !== undefined) {
    return new URL(`${baseUrl}lightning/setup/Queues/page?address=%2Fp%2Fown%2FQueue%2Fd%3Fid%3D${internalId}`)
  }
  return undefined
}

const layoutResolver: UrlResolver = async (element, baseUrl, elementIDResolver) => {
  const internalId = getInternalId(element)
  const [parentRef] = getParents(element)

  if (isInstanceElement(element)
      && metadataType(element) === 'Layout'
      && internalId !== undefined
      && isReferenceExpression(parentRef)) {
    const parent = await elementIDResolver(element.annotations[CORE_ANNOTATIONS.PARENT][0].elemId)
    if (isElement(parent)) {
      const parentIdentifier = getTypeIdentifier(parent)
      if (parentIdentifier !== undefined) {
        return new URL(`${baseUrl}lightning/setup/ObjectManager/${parentIdentifier}/PageLayouts/${internalId}/view`)
      }
    }
  }
  return undefined
}

const internalIdResolver: UrlResolver = async (element, baseUrl, _elementIDResolver) => {
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
