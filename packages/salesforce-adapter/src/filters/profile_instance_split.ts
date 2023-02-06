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
import _ from 'lodash'
import { strings, collections, promises } from '@salto-io/lowerdash'
import { Element, ObjectType, isMapType, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'

import { LocalFilterCreator } from '../filter'
import { metadataType } from '../transformers/transformer'
import { PROFILE_METADATA_TYPE } from '../constants'

const { groupByAsync, awu } = collections.asynciterable
const { removeAsync } = promises.array
const DEFAULT_NACL_FILENAME = 'Attributes'

const toNaclFilename = async (fieldName: string, objType: ObjectType): Promise<string> => (
  (fieldName !== undefined && isMapType(await objType.fields[fieldName]?.getType()))
    ? strings.capitalizeFirstLetter(fieldName)
    : DEFAULT_NACL_FILENAME
)

const splitProfile = async (profile: InstanceElement): Promise<InstanceElement[]> => {
  const toInstancePart = async (
    naclFilename: string,
    fieldNames: string[]
  ): Promise<InstanceElement> => (
    new InstanceElement(
      profile.elemID.name,
      await profile.getType(),
      _.pick(profile.value, ...fieldNames),
      profile.path === undefined ? undefined : [...profile.path, naclFilename],
      naclFilename === DEFAULT_NACL_FILENAME ? profile.annotations : undefined,
    )
  )

  const targetFieldsByFile = await groupByAsync(
    Object.keys(profile.value),
    async fieldName => toNaclFilename(fieldName, await profile.getType()),
  )

  // keep the default filename first so that it comes up first when searching the path index
  const profileInstances = await Promise.all(_.sortBy(
    Object.entries(targetFieldsByFile),
    ([fileName]) => fileName !== DEFAULT_NACL_FILENAME,
  ).map(
    async ([fileName, fields]) => toInstancePart(fileName, fields)
  ))

  return profileInstances
}

const isProfileInstance = async (elem: Element): Promise<boolean> => (
  isInstanceElement(elem) && await metadataType(elem) === PROFILE_METADATA_TYPE
)

/**
 * Split profile instances, each assigned to its own nacl path.
 * Each map field is assigned to a separate file, and the other fields and annotations
 * to Attributes.nacl.
 */
const filterCreator: LocalFilterCreator = () => ({
  name: 'profileInstanceSplitFilter',
  onFetch: async (elements: Element[]) => {
    const profileInstances = await removeAsync(elements, isProfileInstance) as InstanceElement[]
    if (profileInstances.length === 0) {
      return
    }
    const newProfileInstances = await awu(profileInstances).flatMap(splitProfile).toArray()
    elements.push(...newProfileInstances)
  },
})

export default filterCreator
