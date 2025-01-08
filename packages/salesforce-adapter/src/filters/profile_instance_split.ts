/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { strings, collections, promises } from '@salto-io/lowerdash'
import {
  Element,
  ObjectType,
  isMapType,
  InstanceElement,
  Change,
  isInstanceChange,
  isAdditionOrModificationChange,
} from '@salto-io/adapter-api'

import { FilterCreator } from '../filter'
import { PROFILE_METADATA_TYPE } from '../constants'
import { isInstanceOfTypeChangeSync, isInstanceOfTypeSync } from './utils'

const { groupByAsync, awu } = collections.asynciterable
const { removeAsync } = promises.array
const DEFAULT_NACL_FILENAME = 'Attributes'

const toNaclFilename = async (fieldName: string, objType: ObjectType): Promise<string> =>
  fieldName !== undefined && isMapType(await objType.fields[fieldName]?.getType())
    ? strings.capitalizeFirstLetter(fieldName)
    : DEFAULT_NACL_FILENAME

const splitProfile = async (profile: InstanceElement): Promise<InstanceElement[]> => {
  const toInstancePart = async (naclFilename: string, fieldNames: string[]): Promise<InstanceElement> =>
    new InstanceElement(
      profile.elemID.name,
      await profile.getType(),
      _.pick(profile.value, ...fieldNames),
      profile.path === undefined ? undefined : [...profile.path, naclFilename],
      naclFilename === DEFAULT_NACL_FILENAME ? profile.annotations : undefined,
    )

  const targetFieldsByFile = await groupByAsync(Object.keys(profile.value), async fieldName =>
    toNaclFilename(fieldName, await profile.getType()),
  )

  // keep the default filename first so that it comes up first when searching the path index
  const profileInstances = await Promise.all(
    _.sortBy(Object.entries(targetFieldsByFile), ([fileName]) => fileName !== DEFAULT_NACL_FILENAME).map(
      async ([fileName, fields]) => toInstancePart(fileName, fields),
    ),
  )

  return profileInstances
}

const sortInstance = (instance: InstanceElement): void => {
  instance.value = Object.keys(instance.value)
    .sort()
    .reduce(
      (sorted, key) => {
        sorted[key] = instance.value[key]
        return sorted
      },
      {} as typeof instance.value,
    )
}

/**
 * Split profile instances, each assigned to its own nacl path.
 * Each map field is assigned to a separate file, and the other fields and annotations
 * to Attributes.nacl.
 */
const filterCreator: FilterCreator = ({ client }) => ({
  name: 'profileInstanceSplitFilter',
  onFetch: async (elements: Element[]) => {
    const profileInstances = (await removeAsync(
      elements,
      isInstanceOfTypeSync(PROFILE_METADATA_TYPE),
    )) as InstanceElement[]
    if (profileInstances.length === 0) {
      return
    }
    const newProfileInstances = await awu(profileInstances).flatMap(splitProfile).toArray()
    elements.push(...newProfileInstances)
  },
  // Splitting into files can cause the internal order of the profile to be affected by which files are changed.
  // In order to maintain the order in SFDX we sort the value.
  preDeploy: async (changes: Change[]) => {
    // Skipping in the deploy flow since the service is indifferent to the order.
    if (client !== undefined) {
      return
    }

    await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceOfTypeChangeSync(PROFILE_METADATA_TYPE))
      .forEach(change => sortInstance(change.data.after))
  },
})

export default filterCreator
