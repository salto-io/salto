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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  Element, InstanceElement, ObjectType, ElemID, isObjectType,
} from '@salto-io/adapter-api'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { multiIndex, collections } from '@salto-io/lowerdash'
import { FileProperties } from 'jsforce-types'
import { apiName, isCustomObject } from '../transformers/transformer'
import { FilterContext, FilterCreator, FilterResult } from '../filter'
import { addObjectParentReference, buildElementsSourceForFetch } from './utils'
import { SALESFORCE, LAYOUT_TYPE_ID_METADATA_TYPE, WEBLINK_METADATA_TYPE, FULLNAME_SEPERATOR, CPQ_PREFIX, NAMESPACE_SEPARATOR } from '../constants'
import { getObjectDirectoryPath } from './custom_objects'
import { FetchElements } from '../types'
import { fetchMetadataInstances, listMetadataObjects } from '../fetch'
import SalesforceClient from '../client/client'

const { awu } = collections.asynciterable

const log = logger(module)

export const LAYOUT_TYPE_ID = new ElemID(SALESFORCE, LAYOUT_TYPE_ID_METADATA_TYPE)
export const WEBLINK_TYPE_ID = new ElemID(SALESFORCE, WEBLINK_METADATA_TYPE)

export const specialLayoutObjects = new Map([
  ['CaseClose', 'Case'],
  ['UserAlt', 'User'],
])

// Layout full name starts with related sobject and then '-'
const layoutObjAndName = async (layout: InstanceElement): Promise<[string, string]> => {
  const [obj, ...name] = (await apiName(layout)).split('-')
  return [specialLayoutObjects.get(obj) ?? obj, name.join('-')]
}

const fixLayoutPath = async (
  layout: InstanceElement,
  customObject: ObjectType,
  layoutName: string,
): Promise<void> => {
  layout.path = [
    ...await getObjectDirectoryPath(customObject),
    layout.elemID.typeName,
    pathNaclCase(naclCase(layoutName)),
  ]
}

const transformPrefixedLayoutFileProp = (fileProp: FileProperties): FileProperties => {
  const fullNameParts = fileProp.fullName.split(FULLNAME_SEPERATOR)
  const transformedFullName = [
    fullNameParts[0],
    FULLNAME_SEPERATOR,
    fileProp.namespacePrefix,
    NAMESPACE_SEPARATOR,
    ...fullNameParts.slice(1),
  ].join('')
  return { ...fileProp, fullName: transformedFullName }
}

const createLayoutMetadataInstances = async (
  config: FilterContext,
  client: SalesforceClient,
  elements: Element[]
): Promise<FetchElements<InstanceElement[]>> => {
  const type = elements
    .filter(isObjectType)
    .find(elem => elem.elemID.typeName === LAYOUT_TYPE_ID_METADATA_TYPE)
  const { elements: fileProps, configChanges } = await listMetadataObjects(
    client, LAYOUT_TYPE_ID_METADATA_TYPE, [],
  )

  if (type === undefined) return { configChanges: [], elements: [] }
  const [filePropsToTransform,
    regularFileProps] = _.partition(fileProps,
    fileProp => fileProp.namespacePrefix === CPQ_PREFIX)

  const correctedFileProps = [
    ...regularFileProps,
    ...filePropsToTransform.map(transformPrefixedLayoutFileProp),
  ]

  const instances = await fetchMetadataInstances({
    client,
    fileProps: correctedFileProps,
    metadataType: type,
    metadataQuery: config.fetchProfile.metadataQuery,
  })

  return {
    elements: instances.elements,
    configChanges: [...instances.configChanges, ...configChanges],
  }
}

/**
* Declare the layout filter, this filter fetches the Layouts metadata type,
* adds reference from the sobject to it's layouts, and fixes references in layout items.
*/
const filterCreator: FilterCreator = ({ client, config }) => ({
  /**
   * Upon fetch, get Layout instances, shorten layouts' ID and add reference to layout sobjects.
   * Fixes references in layout items.
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<FilterResult> => {
    const { elements: layouts,
      configChanges } = await createLayoutMetadataInstances(config, client, elements)
    if (layouts.length === 0) {
      return {}
    }

    // const layouts = [...findInstances(elements, LAYOUT_TYPE_ID)]
    // const apiNameToCustomObject = await generateApiNameToCustomObject(elements)

    // await awu(layouts).forEach(async layout => {
    //   const [layoutObjName, layoutName] = await layoutObjAndName(layout)
    //   const layoutObj = apiNameToCustomObject.get(layoutObjName)
    //   if (layoutObj === undefined) {
    //     log.debug('Could not find object %s for layout %s', layoutObjName, layoutName)
    //     return
    //   }

    const referenceElements = buildElementsSourceForFetch(elements, config)
    const apiNameToCustomObject = await multiIndex.keyByAsync({
      iter: await referenceElements.getAll(),
      filter: isCustomObject,
      key: async obj => [await apiName(obj)],
      map: obj => obj.elemID,
    })

    await awu(layouts).forEach(async layout => {
      const [layoutObjName, layoutName] = await layoutObjAndName(layout)
      const layoutObjId = apiNameToCustomObject.get(layoutObjName)
      const layoutObj = layoutObjId !== undefined
        ? await referenceElements.get(layoutObjId)
        : undefined
      if (layoutObj === undefined || !(await isCustomObject(layoutObj))) {
        log.debug('Could not find object %s for layout %s', layoutObjName, layoutName)
        return
      }

      addObjectParentReference(layout, layoutObj)
      await fixLayoutPath(layout, layoutObj, layoutName)
      elements.push(layout)
    })

    return {
      configSuggestions: configChanges,
    }
  },
})

export default filterCreator
