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
import _ from 'lodash'
import { strings } from '@salto-io/lowerdash'
import { Element, ObjectType, isMapType, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { metadataType } from '../transformers/transformer'
import { PROFILE_METADATA_TYPE } from '../constants'

const DEFAULT_NACL_FILENAME = 'Attributes'

const toNaclFilename = (fieldName: string, objType: ObjectType): string => (
  (fieldName !== undefined && isMapType(objType.fields[fieldName]?.type))
    ? strings.capitalizeFirstLetter(fieldName)
    : DEFAULT_NACL_FILENAME
)

const splitProfile = (profile: InstanceElement): InstanceElement[] => {
  const toInstancePart = (naclFilename: string, fieldNames: string[]): InstanceElement => (
    new InstanceElement(
      profile.elemID.name,
      profile.type,
      _.pick(profile.value, ...fieldNames),
      profile.path === undefined ? undefined : [...profile.path, naclFilename],
    )
  )

  const targetFieldsByFile = _.groupBy(
    Object.keys(profile.value),
    fieldName => toNaclFilename(fieldName, profile.type),
  )

  // keep the default filename first so that it comes up first when searching the path index
  return _.sortBy(
    Object.entries(targetFieldsByFile),
    ([fileName]) => fileName !== DEFAULT_NACL_FILENAME,
  ).map(
    ([fileName, fields]) => toInstancePart(fileName, fields)
  )
}

const isProfileInstance = (elem: Element): elem is InstanceElement => (
  isInstanceElement(elem) && metadataType(elem) === PROFILE_METADATA_TYPE
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

    const profileInstances = _.remove(elements, isProfileInstance) as InstanceElement[]
    if (profileInstances.length === 0) {
      return
    }
    const newProfileInstances = profileInstances.flatMap(splitProfile)
    elements.push(...newProfileInstances)
  },
})

export default filterCreator
