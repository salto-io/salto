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

import {
  Change,
  isAdditionOrRemovalChange,
  getChangeData,
  isAdditionChange,
  isRemovalOrModificationChange,
  DetailedChange,
  ChangeDataType,
  isModificationChange,
  isRemovalChange,
  ModificationChange,
  AdditionChange,
  RemovalChange,
} from '@salto-io/adapter-api'
import { detailedCompare } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import _ from 'lodash'

const log = logger(module)

export type DeploySummaryResult = 'success' | 'failure' | 'partial-success'
export type DetailedChangeId = string
export type DetailedChangeDeploySummaryResult = [DetailedChangeId, DeploySummaryResult]

const handleEmptyAppliedChange = (
  requestedChange: Change,
): DetailedChangeDeploySummaryResult[] => {
  const requestedChangeName = getChangeData(requestedChange).elemID.getFullName()
  if (isAdditionOrRemovalChange(requestedChange)) {
    return [[requestedChangeName, 'failure']]
  }
  const requestedDetailedChanges = detailedCompare(
    requestedChange.data.before,
    requestedChange.data.after
  )
  return requestedDetailedChanges
    .map(detailedChange => [detailedChange.id.getFullName(), 'failure'])
}

const summarizeAdditionChange = (
  requestedChange: AdditionChange<ChangeDataType>,
  appliedChange: Change
): DetailedChangeDeploySummaryResult[] => {
  const requestedChangeName = getChangeData(requestedChange).elemID.getFullName()

  if (isAdditionChange(appliedChange)) {
    const diffBetweenRequestedAndApplied = detailedCompare(
      requestedChange.data.after,
      appliedChange.data.after
    )
    // The applied change can have additional values (for example - IDs generated by the service)
    // such a case is still a success
    // if there is a difference in the deployed value (modify) or something is missing (removal)
    // we did not deploy everything and this is partial success
    const deployResult = diffBetweenRequestedAndApplied.every(isAdditionChange)
      ? 'success'
      : 'partial-success'
    return [[requestedChangeName, deployResult]]
  }
  // We do not expect appliedChange to be Removal or Modify (since both require a before)
  // which in case of addition should not exist.
  log.error('Got an unexpected change result: %s on an addition change with id %s',
    appliedChange.action, requestedChange.data.after.elemID.getFullName())
  return [[requestedChangeName, 'failure']]
}

const summarizeRemovalChange = (
  requestedChange: RemovalChange<ChangeDataType>,
  appliedChange: Change
): DetailedChangeDeploySummaryResult[] => {
  const requestedChangeName = getChangeData(requestedChange).elemID.getFullName()
  const deploySummaryResult = (): DeploySummaryResult => {
    if (isRemovalChange(appliedChange)) {
      return 'success'
    }
    if (isModificationChange(appliedChange)) {
      return 'partial-success'
    }
    // We do not expect appliedChange to be an adddition (since it requires no before)
    // which removal change has.
    log.error('Got an unexpected change result: %s on an removal change with id %s',
      appliedChange.action, requestedChange.data.before.elemID.getFullName())
    return 'failure'
  }
  const deployResult = deploySummaryResult()
  return [[requestedChangeName, deployResult]]
}

const summarizeModificationChange = (
  requestedChange: ModificationChange<ChangeDataType>,
  appliedChange: Change
): DetailedChangeDeploySummaryResult[] => {
  const requestedDetailedChanges = detailedCompare(
    requestedChange.data.before,
    requestedChange.data.after,
    { 'createFieldChanges': true },
  )
  if (isAdditionOrRemovalChange(appliedChange)) {
    if (isAdditionChange(appliedChange)) {
      // We do not expect appliedChange to be an adddition (since it requires no before)
      // which modification change has.
      log.error('Got an unexpected change result: %s on an modification change with id %s',
        appliedChange.action, requestedChange.data.after.elemID.getFullName())
    }
    return (
      requestedDetailedChanges.map(requestedDetailedChange => (
        [requestedDetailedChange.id.getFullName(), 'failure']
      ))
    )
  }

  const diffBetweenRequestedAndApplied = detailedCompare(
    requestedChange.data.after, appliedChange.data.after
  ).filter(isRemovalOrModificationChange)
  // The applied change can have additional values (for example - IDs generated by the service).
  // Such a case is still a success, so we can safly filter these values out.

  const getResultForDetailedChange = (detailedChange: DetailedChange): DeploySummaryResult => {
    if (diffBetweenRequestedAndApplied.some(diff => detailedChange.id.isEqual(diff.id))) {
      // If the detailed compare between requested vs applied holds any
      // requested detailed change IDs marked with removal or modify,
      // this means they were sucssefully applied, and we can mark this change as failure.
      return 'failure'
    }
    if (diffBetweenRequestedAndApplied.some(diff => detailedChange.id.isParentOf(diff.id))) {
      // The applied change can be partial ( only some values were created ).
      // An example - before value
      // `x = { a = 1 }`
      // We wanted to modify it to
      // `x = { a = 1, d = { d1 = 1, d2 = 2 } }`
      // What was applied was
      // `x = { a = 1, d = { d1 = 1 } }`
      // The detailed compare between requested vs applied we will get x.d.d2 as remove.
      // Such a case is a partial success
      return 'partial-success'
    }
    return 'success'
  }

  return (
    requestedDetailedChanges.map(requestedDetailedChange => (
      [
        requestedDetailedChange.id.getFullName(),
        getResultForDetailedChange(requestedDetailedChange),
      ]
    ))
  )
}

const summarizeDeployChange = (
  requestedChange: Change,
  appliedChange?: Change
// eslint-disable-next-line consistent-return
): DetailedChangeDeploySummaryResult[] => {
  if (appliedChange === undefined) {
    return handleEmptyAppliedChange(requestedChange)
  }

  // eslint-disable-next-line default-case
  switch (requestedChange.action) {
    case 'add': {
      return summarizeAdditionChange(requestedChange, appliedChange)
    }
    case 'modify': {
      return summarizeModificationChange(requestedChange, appliedChange)
    }
    case 'remove': {
      return summarizeRemovalChange(requestedChange, appliedChange)
    }
  }
}

export const summarizeDeployChanges = (
  requested: Change[],
  applied: Change[]
): Record<DetailedChangeId, DeploySummaryResult> => {
  const appliedById = _.keyBy(applied, c => getChangeData(c).elemID.getFullName())
  return Object.fromEntries(
    requested.flatMap(
      requestedChange => {
        const requestedChangeId = getChangeData(requestedChange).elemID.getFullName()
        return summarizeDeployChange(requestedChange, appliedById?.[requestedChangeId])
      }
    )
  )
}
