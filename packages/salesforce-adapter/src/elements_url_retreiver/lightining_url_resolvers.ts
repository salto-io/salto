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
import { isObjectType, Element, isField, Field, isInstanceElement, isType, ElementIDResolver, CORE_ANNOTATIONS, isElement } from '@salto-io/adapter-api'
import { getInternalId } from '../filters/utils'
import { GENERAL_URLS_MAP, SETTINGS_URLS_MAP } from './constants'

export type UrlResolver = (element: Element, baseUrl: URL, _elementIDResolver: ElementIDResolver) =>
  Promise<URL | undefined>


const getTypeIdentifier = (element: Element | undefined): string | undefined =>
  (element === undefined ? undefined : (getInternalId(element) ?? element.annotations.apiName))

const getFieldIdentifier = (element: Field): string =>
  (getInternalId(element) ?? element.annotations.relationshipName ?? element.name)

const genernalConstantsResolver: UrlResolver = async (element, baseUrl, _elementIDResolver) => {
  if (element.annotations.metadataType in GENERAL_URLS_MAP) {
    return new URL(`${baseUrl}${GENERAL_URLS_MAP[element.annotations.metadataType]}`)
  }
  return undefined
}

const settingsConstantsResolver: UrlResolver = async (element, baseUrl, _elementIDResolver) => {
  const settingsElement = isInstanceElement(element) ? element.type : element
  if (settingsElement.annotations.metadataType in SETTINGS_URLS_MAP) {
    return new URL(`${baseUrl}${SETTINGS_URLS_MAP[settingsElement.annotations.metadataType]}`)
  }
  return undefined
}

const assignmentRulesResolver: UrlResolver = async (element, baseUrl, _elementIDResolver) => {
  if (isInstanceElement(element)
    && element.type.annotations.metadataType === 'AssignmentRules'
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
    && element.annotations.metadataType === 'CustomObject'
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
      && element.parent.annotations.metadataType === 'CustomObject'
      && typeIdentfier !== undefined) {
      return new URL(`${baseUrl}lightning/setup/ObjectManager/${typeIdentfier}/FieldsAndRelationships/${fieldIdentifier}/view`)
    }
  }
  return undefined
}

const flowResolver: UrlResolver = async (element, baseUrl, _elementIDResolver) => {
  const internalId = getInternalId(element)
  if (isInstanceElement(element)
    && element.type.annotations.metadataType === 'Flow'
    && element.value.processType === 'Flow'
    && internalId !== undefined) {
    return (new URL(`${baseUrl}builder_platform_interaction/flowBuilder.app?flowId=${internalId}`))
  }
  return undefined
}

const workflowResolver: UrlResolver = async (element, baseUrl, _elementIDResolver) => {
  if (isInstanceElement(element)
    && element.type.annotations.metadataType === 'Flow'
    && element.value.processType === 'Workflow') {
    // It seems all the process builder flows has the same url so we return the process buider home
    return new URL(`${baseUrl}lightning/setup/ProcessAutomation/home`)
  }
  return undefined
}

const queueResolver: UrlResolver = async (element, baseUrl, _elementIDResolver) => {
  const internalId = getInternalId(element)
  if (isInstanceElement(element)
    && element.type.annotations.metadataType === 'Queue'
    && getInternalId(element) !== undefined) {
    return new URL(`${baseUrl}lightning/setup/Queues/page?address=%2Fp%2Fown%2FQueue%2Fd%3Fid%3D${internalId}`)
  }
  return undefined
}

const layoutResolver: UrlResolver = async (element, baseUrl, elementIDResolver) => {
  const internalId = getInternalId(element)
  if (isInstanceElement(element)
      && element.type.annotations.metadataType === 'Layout'
      && internalId !== undefined
      && element.annotations[CORE_ANNOTATIONS.PARENT] !== undefined
      && element.annotations[CORE_ANNOTATIONS.PARENT].length === 1) {
    const parent = await elementIDResolver(element.annotations[CORE_ANNOTATIONS.PARENT][0].elemId)
    if (isElement(element)) {
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
