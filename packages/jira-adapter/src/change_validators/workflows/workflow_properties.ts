/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import _ from 'lodash'
import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { Values } from '@salto-io/adapter-api/src/values'
import { isWorkflowInstance } from '../../filters/workflowV2/types'

const { awu } = collections.asynciterable

const getPropertiesKeyGroups = (statusesOrTransitions: Values[]): string[][] =>
  Array.from(statusesOrTransitions).map(param => (param.properties ?? []).map((property: Values) => property.key))

export const workflowPropertiesValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isWorkflowInstance)
    .filter(instance => {
      const items = [...(instance.value.statuses ?? []), ...Object.values(instance.value.transitions)]
      const countItemsKeys = getPropertiesKeyGroups(items).map(keyGroup => _.countBy(keyGroup))
      const duplicateItemsKeys = countItemsKeys
        .map(dictionary => _.values(dictionary))
        .flatMap(countList => countList.filter(count => count > 1))
      return !_.isEmpty(duplicateItemsKeys)
    })
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: "Can't deploy workflow with status or transition that have multiple properties with an identical key.",
      detailedMessage: `Can't deploy workflow ${instance.elemID.getFullName()} which has status or transition with multiple properties with an identical key.`,
    }))
    .toArray()
