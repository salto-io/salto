/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator } from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { getEnabledEntries } from '../../config_utils'

const log = logger(module)

export type ValidatorsActivationConfig = Record<string, boolean>
export const createChangeValidator =
  ({
    validators,
    validatorsActivationConfig = {},
  }: {
    validators: Record<string, ChangeValidator>
    validatorsActivationConfig?: ValidatorsActivationConfig
  }): ChangeValidator =>
  async (changes, elementSource) => {
    const activeValidators = Object.entries(getEnabledEntries(validators, validatorsActivationConfig))

    return _.flatten(
      await Promise.all(
        activeValidators.map(([name, validator]) =>
          log.timeDebug(() => validator(changes, elementSource), `validator ${name}`),
        ),
      ),
    )
  }
