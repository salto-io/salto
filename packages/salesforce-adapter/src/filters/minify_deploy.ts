/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  getAllChangeData,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isModificationChange,
  toChange,
  Value,
  Values,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { detailedCompare, getPath } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { isInstanceOfTypeChange } from './utils'
import { PROFILE_METADATA_TYPE, INSTANCE_FULL_NAME_FIELD } from '../constants'
import { apiName, metadataType } from '../transformers/transformer'

export const LOGIN_IP_RANGES_FIELD = 'loginIpRanges'
export const LOGIN_FLOWS_FIELD = 'loginFlows'
export const LAYOUT_ASSIGNMENTS_FIELD = 'layoutAssignments'

const { awu, keyByAsync } = collections.asynciterable
const { isDefined } = values

const typeToRemainingFields: Record<string, Record<string, { default?: Value }>> = {
  [PROFILE_METADATA_TYPE]: {
    [INSTANCE_FULL_NAME_FIELD]: {},
    [LOGIN_IP_RANGES_FIELD]: { default: [] },
    [LOGIN_FLOWS_FIELD]: {},
  },
}

const isRelatedChange = async (change: Change): Promise<boolean> =>
  isInstanceOfTypeChange(...Object.keys(typeToRemainingFields))(change)

const fillRemainingFields = (type: string, afterValues: Values): Values => {
  const remainingFields = typeToRemainingFields[type]
  return Object.fromEntries(
    Object.keys(remainingFields).map(fieldName => [
      fieldName,
      afterValues[fieldName] ?? remainingFields[fieldName].default,
    ]),
  )
}

const toMinifiedChange = async (change: Change<InstanceElement>): Promise<Change<InstanceElement>> => {
  const [before, after] = getAllChangeData(change)
  const detailedChanges = detailedCompare(before, after, {
    createFieldChanges: true,
  })
  const minifiedAfter = after.clone()
  minifiedAfter.value = fillRemainingFields(await metadataType(before), after.value)
  const newLayoutAssignmentNames: string[] = []
  detailedChanges.filter(isAdditionOrModificationChange).forEach(detailedChange => {
    const changePath = getPath(before, detailedChange.id)
    if (_.isUndefined(changePath)) {
      return
    }
    if (changePath.includes(LAYOUT_ASSIGNMENTS_FIELD)) {
      newLayoutAssignmentNames.push(changePath[changePath.length - 1])
      return
    }
    const minifiedValuePath = changePath.length > 2 ? changePath.slice(0, -1) : changePath
    const afterChange = _.get(after, minifiedValuePath)
    if (isDefined(afterChange)) {
      _.set(minifiedAfter, minifiedValuePath, afterChange)
    }
  })

  if (newLayoutAssignmentNames.length > 0) {
    minifiedAfter.value[LAYOUT_ASSIGNMENTS_FIELD] = _.pick(
      after.value[LAYOUT_ASSIGNMENTS_FIELD],
      newLayoutAssignmentNames,
    )
  }

  /**
   * Other filters downstream may rely on the presence of specific sections, so let's make sure we don't completely
   * remove them even if we don't deploy any of their contents.
   */
  const profileSections = _(after.value)
    .pickBy(_.isPlainObject)
    .mapValues(() => ({}))
    .value()

  minifiedAfter.value = _.assign(profileSections, minifiedAfter.value)

  return toChange({
    before,
    after: minifiedAfter,
  })
}

const filterCreator: FilterCreator = ({ client }) => {
  let originalChanges: Record<string, Change>
  return {
    name: 'minifyDeployFilter',
    preDeploy: async changes => {
      if (client === undefined) {
        // We don't want to run this filter when the results aren't being sent to the service.
        return
      }

      const relatedChanges = await awu(changes)
        .filter(isInstanceChange)
        .filter(isModificationChange)
        .filter(isRelatedChange)
        .toArray()
      originalChanges = await keyByAsync(relatedChanges, change => apiName(getChangeData(change)))

      _.pullAll(changes, relatedChanges)
      changes.push(...(await Promise.all(relatedChanges.map(toMinifiedChange))))
    },
    onDeploy: async changes => {
      if (client === undefined) {
        // We don't want to minify profiles in the SFDX flow.
        return
      }

      const appliedChanges = await awu(changes)
        .filter(isInstanceChange)
        .filter(isModificationChange)
        .filter(isRelatedChange)
        .toArray()
      const appliedChangesApiNames = await awu(appliedChanges)
        .map(change => apiName(getChangeData(change)))
        .toArray()

      const appliedOriginalChanges = appliedChangesApiNames.map(name => originalChanges[name]).filter(isDefined)

      _.pullAll(changes, appliedChanges)
      changes.push(...appliedOriginalChanges)
    },
  }
}

export default filterCreator
