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
import _ from 'lodash'
import { strings, collections, promises } from '@salto-io/lowerdash'
import { Element, ObjectType, isMapType, InstanceElement, isInstanceElement, getTopLevelPath } from '@salto-io/adapter-api'

import { FilterCreator } from '../filter'
import { metadataType } from '../transformers/transformer'
import { PROFILE_METADATA_TYPE } from '../constants'

const { awu } = collections.asynciterable
const { removeAsync } = promises.array
const DEFAULT_NACL_FILENAME = 'Attributes'

const toNaclFilename = async (fieldName: string, objType: ObjectType): Promise<string> => (
  (fieldName !== undefined && isMapType(await objType.fields[fieldName]?.getType()))
    ? strings.capitalizeFirstLetter(fieldName)
    : DEFAULT_NACL_FILENAME
)

const splitProfileToPaths = async (profile: InstanceElement): Promise<InstanceElement> => {
  const profileType = await profile.getType()
  const profilePath = getTopLevelPath(profile)
  const fieldsToPath = await Promise.all(
    Object.keys(profile.value)
      .map(async fieldName => [
        profile.elemID.createNestedID(fieldName).getFullName(),
        [...profilePath, await toNaclFilename(fieldName, profileType)],
      ] as [string, string[]])
  )
  profile.pathIndex = new collections.treeMap.TreeMap<string>([
    [profile.elemID.getFullName(), [...profilePath, DEFAULT_NACL_FILENAME]],
    // TODO: check if I need that sort
    // I am not sure if we need that sort - I am keeping it because of the following doc
    // keep the default filename first so that it comes up first when searching the path index
    ..._.sortBy(fieldsToPath, ([fileName]) => fileName !== DEFAULT_NACL_FILENAME),
  ])
  return profile
}

const isProfileInstance = async (elem: Element): Promise<boolean> => (
  isInstanceElement(elem) && await metadataType(elem) === PROFILE_METADATA_TYPE
)

/**
 * Split profile instances, each assigned to its own nacl path.
 * Each map field is assigned to a separate file, and the other fields and annotations
 * to Attributes.nacl.
 */
const filterCreator: FilterCreator = ({ config }) => ({
  onFetch: async (elements: Element[]) => {
    if (config.useOldProfiles) {
      return
    }

    const profileInstances = await removeAsync(elements, isProfileInstance) as InstanceElement[]
    if (profileInstances.length === 0) {
      return
    }
    const newProfileInstances = await awu(profileInstances).map(splitProfileToPaths).toArray()
    elements.push(...newProfileInstances)
  },
})

export default filterCreator
