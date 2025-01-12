/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { CUSTOM_STATUS_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable
const log = logger(module)

const getName = (inst: InstanceElement): string => inst.elemID.name
const getAgentLabel = (inst: InstanceElement): string => inst.value.raw_agent_label

/**
 * this change validator checks that the raw_agent_label is unique.
 */
export const customStatusUniqueAgentLabelValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run customStatusUniqueAgentLabelValidator because no element source was provided')
    return []
  }

  const allStatuses = await awu(await elementSource.getAll())
    .filter(elem => elem.elemID.typeName === CUSTOM_STATUS_TYPE_NAME)
    .filter(isInstanceElement)
    .toArray()

  const statusByName = _.keyBy(allStatuses, getName)

  // {name , agent_label}
  const agentLabelsByName = _.mapValues(statusByName, getAgentLabel)

  // checks that no other statuses besides inst have its raw_agent_label
  const isAgentLabelTaken = (inst: InstanceElement): boolean =>
    !_.isEmpty(
      Object.keys(agentLabelsByName).filter(
        key => key !== inst.elemID.name && agentLabelsByName[key] === getAgentLabel(inst),
      ),
    )

  return changes
    .filter(change => getChangeData(change).elemID.typeName === CUSTOM_STATUS_TYPE_NAME)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isAgentLabelTaken)
    .flatMap(instance => [
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Non unique agent label.',
        detailedMessage: `Agent label for ${instance.elemID.name} is already taken by another custom status.`,
      },
    ])
}
