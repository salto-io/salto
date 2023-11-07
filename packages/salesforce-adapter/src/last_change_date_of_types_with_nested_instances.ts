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
import { FileProperties } from 'jsforce'
import _ from 'lodash'
import { CUSTOM_FIELD, CUSTOM_OBJECT } from './constants'
import SalesforceClient from './client/client'
import { MetadataQuery } from './types'
import { CUSTOM_OBJECT_FIELDS } from './fetch_profile/metadata_types'
import { getMostRecentFileProperties, listMetadataObjects } from './filters/utils'

export type LastChangeDateOfTypesWithNestedInstances = Partial<{
  // The CustomObject section will contain mapping per CustomObject type name
  [CUSTOM_OBJECT]: Record<string, string>
}>


type GetLastChangeDateOfTypesWithNestedInstancesParams = {
  client: SalesforceClient
  metadataQuery: MetadataQuery<FileProperties>
}
export const getLastChangeDateOfTypesWithNestedInstances = async ({
  client,
  metadataQuery,
}: GetLastChangeDateOfTypesWithNestedInstancesParams): Promise<LastChangeDateOfTypesWithNestedInstances> => {
  const lastChangeDateOfCustomObjectTypes = async (): Promise<Record<string, string> | undefined> => {
    if (!metadataQuery.isTypeMatch(CUSTOM_OBJECT)) {
      return undefined
    }
    const allSubInstancesFileProps = _.flatten(await Promise.all(
      [
        ...CUSTOM_OBJECT_FIELDS,
        CUSTOM_OBJECT,
      ].filter(type => metadataQuery.isTypeMatch(type))
        // This CustomField type is excluded by default. Listing CustomFields is mandatory when listing CustomObjects
        .concat(CUSTOM_FIELD)
        .map(typeName => listMetadataObjects(client, typeName))
    )).flatMap(result => result.elements)
      .filter(fileProp => metadataQuery.isInstanceIncluded(fileProp))
    const relatedPropsByParent = _.groupBy(
      allSubInstancesFileProps,
      fileProp => fileProp.fullName.split('.')[0],
    )
    const result: Record<string, string> = {}
    Object.entries(relatedPropsByParent)
      .forEach(([parentName, fileProps]) => {
        const latestChangeProps = getMostRecentFileProperties(fileProps)
        if (latestChangeProps !== undefined) {
          result[parentName] = latestChangeProps.lastModifiedDate
        }
      })
    return result
  }
  return {
    [CUSTOM_OBJECT]: await lastChangeDateOfCustomObjectTypes(),
  }
}
