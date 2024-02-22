/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  ChangeError,
  ChangeValidator,
  getChangeData,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { createChangeValidator, ValidatorsActivationConfig } from './create_change_validator'

export const createSkipParentsOfSkippedInstancesValidator =
  ({
    validators,
    validatorsActivationConfig = {},
  }: {
    validators: Record<string, ChangeValidator>
    validatorsActivationConfig?: ValidatorsActivationConfig
  }): ChangeValidator =>
  async (changes, elementSource) => {
    const changeValidator = createChangeValidator({ validators, validatorsActivationConfig })
    const changeErrors = await changeValidator(changes, elementSource)
    const idToChange = Object.fromEntries(changes.map(change => [getChangeData(change).elemID.getFullName(), change]))
    const skippedInstances = _(changeErrors)
      .map(error => error.elemID.getFullName())
      .uniq()
      .flatMap(id => (idToChange[id] ? [idToChange[id]] : []))
      .map(getChangeData)
      .filter(isInstanceElement)
      .value()
    const skippedInstancesFullName = new Set(skippedInstances.map(inst => inst.elemID.getFullName()))
    const changesFullName = new Set(
      changes
        .map(getChangeData)
        .filter(isInstanceElement)
        .map(e => e.elemID.getFullName()),
    )
    const newChangeErrors = _(skippedInstances)
      .flatMap(getParents)
      .filter(isReferenceExpression)
      .uniqBy(ref => ref.elemID.getFullName())
      .filter(
        ref => changesFullName.has(ref.elemID.getFullName()) && !skippedInstancesFullName.has(ref.elemID.getFullName()),
      )
      .map(
        ref =>
          ({
            elemID: ref.elemID,
            severity: 'Error',
            message: `${ref.elemID.getFullName()} depends on a skipped instance`,
            detailedMessage: `${ref.elemID.getFullName()} depends on a skipped instance and therefore is also skipped`,
          }) as ChangeError,
      )
      .value()
    return [...changeErrors, ...newChangeErrors]
  }
