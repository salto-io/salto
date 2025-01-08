/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { getChangeData, isAdditionChange, isInstanceChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { ISSUE_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'
import { isJiraSoftwareFreeLicense } from '../utils'

const { awu } = collections.asynciterable

const filter: FilterCreator = ({ elementsSource }) => {
  const IssueTypeTohierarchyLevel: Record<string, number> = {}
  return {
    name: 'issueTypeHierarchyFilter',
    preDeploy: async changes => {
      const isLicenseFree = await isJiraSoftwareFreeLicense(elementsSource)
      if (isLicenseFree) {
        return
      }

      await awu(changes)
        .filter(isInstanceChange)
        .filter(isAdditionChange)
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === ISSUE_TYPE_NAME)
        .filter(instance => instance.value.hierarchyLevel > 0)
        .forEach(instance => {
          IssueTypeTohierarchyLevel[instance.elemID.getFullName()] = instance.value.hierarchyLevel
          instance.value.hierarchyLevel = 0
        })
    },
    onDeploy: async changes => {
      await awu(changes)
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(instance => Object.keys(IssueTypeTohierarchyLevel).includes(instance.elemID.getFullName()))
        .forEach(instance => {
          instance.value.hierarchyLevel = IssueTypeTohierarchyLevel[instance.elemID.getFullName()]
        })
    },
  }
}

export default filter
