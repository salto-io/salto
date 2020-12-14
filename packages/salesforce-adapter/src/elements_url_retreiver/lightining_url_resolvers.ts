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
import { isObjectType, Element, isField, Field, isInstanceElement, isType, ElementResolver, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { SALESFORCE_CUSTOM_SUFFIX } from '../constants'
import { getInternalId } from '../filters/utils'
import { OBJECT_TYPES, GENERAL_URLS_MAP, SETTINGS_URLS_MAP } from './constants'

export type UrlResolver = {
  shouldResolve(): Promise<boolean>
  resolve(baseUrl: URL): Promise<URL>
}

export type UrlResolverCreator = (element: Element, elementResolver: ElementResolver) => UrlResolver


const getTypeIdentifier = (element: Element | undefined): string | undefined => {
  if (values.isDefined(element)) {
    return getInternalId(element) ?? element.annotations.apiName
  }
  return undefined
}

const getFieldIdentifier = (element: Field): string =>
  getInternalId(element) ?? element.annotations.relationshipName ?? element.name

const genernalConstantsResolver: UrlResolverCreator = (element, _elementResolver) => ({
  shouldResolve: async () => element.elemID.getFullName() in GENERAL_URLS_MAP,
  resolve: async baseUrl => new URL(`${baseUrl}${GENERAL_URLS_MAP[element.elemID.getFullName()]}`),
})

const settingsConstantsResolver: UrlResolverCreator = (element, _elementResolver) => ({
  shouldResolve: async () => {
    if (isInstanceElement(element)) {
      return element.type.elemID.getFullName() in SETTINGS_URLS_MAP
    }
    return element.elemID.getFullName() in SETTINGS_URLS_MAP
  },
  resolve: async baseUrl => {
    const settingsElement = isInstanceElement(element) ? element.type : element
    return new URL(`${baseUrl}${SETTINGS_URLS_MAP[settingsElement.elemID.getFullName()]}`)
  },
})

const objectResolver: UrlResolverCreator = (element, _elementResolver) => ({
  shouldResolve: async () => isObjectType(element)
    && (element.elemID.name.endsWith(SALESFORCE_CUSTOM_SUFFIX)
      || OBJECT_TYPES.includes(element.elemID.typeName))
    && values.isDefined(getTypeIdentifier(element)),

  resolve: async baseUrl => new URL(`${baseUrl}lightning/setup/ObjectManager/${getTypeIdentifier(element)}/Details/view`),
})

const fieldResolver: UrlResolverCreator = (element, elementResolver) => ({
  shouldResolve: async () => isField(element)
    && values.isDefined(getFieldIdentifier(element))
    && objectResolver(element.parent, elementResolver).shouldResolve(),

  resolve: async baseUrl => {
    const fieldElement = element as Field
    return new URL(`${baseUrl}lightning/setup/ObjectManager/${getTypeIdentifier(fieldElement.parent)}/FieldsAndRelationships/${getFieldIdentifier(fieldElement)}/view`)
  },
})

const metadataTypeResolver: UrlResolverCreator = (element, _elementResolver) => ({
  shouldResolve: async () => isType(element)
    && element.elemID.typeName.endsWith('__mdt')
    && values.isDefined(getInternalId(element)),

  resolve: async baseUrl =>
    new URL(`${baseUrl}lightning/setup/CustomMetadata/page?address=%2F${getInternalId(element)}%3Fsetupid%3DCustomMetadata`),
})


const flowResolver: UrlResolverCreator = (element, _elementResolver) => ({
  shouldResolve: async () => isInstanceElement(element)
    && element.elemID.typeName === 'Flow'
    && element.value.processType === 'Flow'
    && values.isDefined(getInternalId(element)),

  resolve: async baseUrl =>
    new URL(`${baseUrl}builder_platform_interaction/flowBuilder.app?flowId=${getInternalId(element)}`),
})

const workflowResolver: UrlResolverCreator = (element, _elementResolver) => ({
  shouldResolve: async () => isInstanceElement(element)
    && element.elemID.typeName === 'Flow'
    && element.value.processType === 'Workflow',

  // It seems all the process builder flows has the same url so we return the process buider home
  resolve: async baseUrl =>
    new URL(`${baseUrl}lightning/setup/ProcessAutomation/home`),
})

const queueResolver: UrlResolverCreator = (element, _elementResolver) => ({
  shouldResolve: async () => isInstanceElement(element)
    && element.elemID.typeName === 'Queue'
    && values.isDefined(getInternalId(element)),

  resolve: async baseUrl =>
    new URL(`${baseUrl}lightning/setup/Queues/page?address=%2Fp%2Fown%2FQueue%2Fd%3Fid%3D${getInternalId(element)}`),
})

const layoutResolver: UrlResolverCreator = (element, elementResolver) => {
  let parent: Element | undefined
  const getParent = async (): Promise<Element | undefined> => {
    if (_.isUndefined(parent)) {
      parent = await elementResolver(element.annotations[CORE_ANNOTATIONS.PARENT][0].elemId)
    }
    return parent
  }

  return {
    shouldResolve: async () => isInstanceElement(element)
      && element.elemID.typeName === 'Layout'
      && values.isDefined(getInternalId(element))
      && values.isDefined(element.annotations[CORE_ANNOTATIONS.PARENT])
      && element.annotations[CORE_ANNOTATIONS.PARENT].length === 1
      && values.isDefined(getTypeIdentifier(await getParent())),

    resolve: async baseUrl =>
      new URL(`${baseUrl}lightning/setup/ObjectManager/${getTypeIdentifier(await getParent())}/PageLayouts/${getInternalId(element)}/view`),
  }
}

const internalIdResolver: UrlResolverCreator = (element, _elementResolver) => ({
  shouldResolve: async () => values.isDefined(getInternalId(element)),
  resolve: async baseUrl => new URL(`${baseUrl}lightning/_classic/%2F${getInternalId(element)}`),
})

export const resolversCreators: UrlResolverCreator[] = [genernalConstantsResolver,
  settingsConstantsResolver, objectResolver, fieldResolver, metadataTypeResolver,
  flowResolver, workflowResolver, layoutResolver, queueResolver, internalIdResolver]
