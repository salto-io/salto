/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { logger } from '@salto-io/logging'
import {
  Element, InstanceElement, ObjectType, ElemID, isObjectType,
} from '@salto-io/adapter-api'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { multiIndex, collections } from '@salto-io/lowerdash'
import { FileProperties } from 'jsforce-types'
import { apiName, isCustomObject } from '../transformers/transformer'
import { FilterContext, FilterCreator, FilterResult } from '../filter'
import { addElementParentReference, buildElementsSourceForFetch, prefixNameIfNecessary } from './utils'
import { SALESFORCE, LAYOUT_TYPE_ID_METADATA_TYPE, WEBLINK_METADATA_TYPE } from '../constants'
import { getObjectDirectoryPath } from './custom_objects'
import { FetchElements } from '../types'
import { fetchMetadataInstances, listMetadataObjects } from '../fetch'
import SalesforceClient from '../client/client'

const { awu } = collections.asynciterable

const log = logger(module)

const LAYOUT_FULLNAME_SEPARATOR = '-'
export const LAYOUT_TYPE_ID = new ElemID(SALESFORCE, LAYOUT_TYPE_ID_METADATA_TYPE)
export const WEBLINK_TYPE_ID = new ElemID(SALESFORCE, WEBLINK_METADATA_TYPE)

export const specialLayoutObjects = new Map([
  ['CaseClose', 'Case'],
  ['UserAlt', 'User'],
])

// Layout full name starts with related sobject and then '-'
const layoutObjAndName = async (fullName: string): Promise<[string, string]> => {
  const [obj, ...name] = fullName.split(LAYOUT_FULLNAME_SEPARATOR)
  return [specialLayoutObjects.get(obj) ?? obj, name.join(LAYOUT_FULLNAME_SEPARATOR)]
}

const fixLayoutPath = async (
  layout: InstanceElement,
  customObject: ObjectType,
  layoutName: string,
): Promise<void> => {
  if (layoutName.includes('Yariv Layout')) {
    console.log('Yariv Layout name: %s \nnaclCase(layoutName): %s \npathNaclCase(naclCase(layoutName)): %s', layoutName, naclCase(layoutName), pathNaclCase(naclCase(layoutName)))
  }
  layout.path = [
    ...await getObjectDirectoryPath(customObject),
    layout.elemID.typeName,
    pathNaclCase(naclCase(layoutName)),
  ]
}

const transformPrefixedLayoutFileProp = async (fileProp: FileProperties):
  Promise<FileProperties> => {
  const [layoutObjName, layoutName] = await layoutObjAndName(fileProp.fullName)
  const fixedLayoutName = prefixNameIfNecessary(layoutName, fileProp.namespacePrefix)
  return { ...fileProp, fullName: [layoutObjName, fixedLayoutName].join(LAYOUT_FULLNAME_SEPARATOR) }
}

const createLayoutMetadataInstances = async (
  config: FilterContext,
  client: SalesforceClient,
  elements: Element[]
): Promise<FetchElements<InstanceElement[]>> => {
  const type = elements
    .filter(isObjectType)
    .find(elem => elem.elemID.typeName === LAYOUT_TYPE_ID_METADATA_TYPE)

  if (type === undefined) return { configChanges: [], elements: [] }

  const { elements: fileProps, configChanges } = await listMetadataObjects(
    client, LAYOUT_TYPE_ID_METADATA_TYPE, [],
  )
  console.log('fileProps[0]: %o', fileProps[0])

  const correctedFileProps = await Promise.all(fileProps.map(transformPrefixedLayoutFileProp))
  console.log('correctedFileProps[0]: %o', correctedFileProps[0])

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
      console.log('created 0 layouts')
      return {}
    }
    const referenceElements = buildElementsSourceForFetch(elements, config)
    const apiNameToCustomObject = await multiIndex.keyByAsync({
      iter: await referenceElements.getAll(),
      filter: isCustomObject,
      key: async obj => [await apiName(obj)],
      map: obj => obj.elemID,
    })


    await awu(layouts).forEach(async layout => {
      const [layoutObjName, layoutName] = await layoutObjAndName(await apiName(layout))
      console.log('[layoutObjName, layoutName]: %o', [layoutObjName, layoutName])
      console.log('apiName: %s', await apiName(layout))
      const layoutObjId = apiNameToCustomObject.get(layoutObjName)
      const layoutObj = layoutObjId !== undefined
        ? await referenceElements.get(layoutObjId)
        : undefined
      if (layoutObj === undefined || !(await isCustomObject(layoutObj))) {
        console.log('Could not find object %s for layout %s', layoutObjName, layoutName)
        log.debug('Could not find object %s for layout %s', layoutObjName, layoutName)
        return
      }

      addElementParentReference(layout, layoutObj)
      await fixLayoutPath(layout, layoutObj, layoutName)
    })

    console.log('created instances with names: %o', layouts.filter(inst => inst.elemID.name.includes('Yariv')).map(inst => inst.elemID.name)[0])
    console.log('created instances with fullname parts: %o', layouts.map(inst => inst.elemID.getFullNameParts())[0])
    console.log('created instances with instance?.path: %o', layouts.filter(inst => !inst.elemID.name.startsWith('SBQQ') && !inst.elemID.name.startsWith('sbaa')).map(inst => inst.path))
    elements.push(...layouts)

    return {
      configSuggestions: configChanges,
    }
  },
})

export default filterCreator
