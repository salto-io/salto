/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator } from '@salto-io/adapter-api'
import _ from 'lodash'
import { createOutgoingUnresolvedReferencesValidator } from './outgoing_unresolved_references'

export const DEFAULT_CHANGE_VALIDATORS = {
  outgoingUnresolvedReferencesValidator: createOutgoingUnresolvedReferencesValidator(),
}

type ValidatorName = keyof typeof DEFAULT_CHANGE_VALIDATORS

export const getDefaultChangeValidators = (
  validatorsToOmit: Array<ValidatorName> = [],
): Record<string, ChangeValidator> => _.omit(DEFAULT_CHANGE_VALIDATORS, validatorsToOmit)
