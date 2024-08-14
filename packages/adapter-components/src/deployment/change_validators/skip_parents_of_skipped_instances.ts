/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
            message: 'Element cannot be deployed due to an error in its dependency',
            detailedMessage: `${ref.elemID.getFullName()} cannot be deployed due to an error in its dependency. Please resolve that error and try again.`,
          }) as ChangeError,
      )
      .value()
    return [...changeErrors, ...newChangeErrors]
  }
