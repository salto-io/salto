/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { DEFAULT_CHANGE_VALIDATORS } from '../../../src/deployment/change_validators/default_change_validators'
import { getDefaultChangeValidators } from '../../../src/deployment/change_validators'

describe('default_change_validators', () => {
  it('should omit validators in validatorsToOmit', () => {
    const allValidators = Object.values(getDefaultChangeValidators())
    expect(allValidators).toContain(DEFAULT_CHANGE_VALIDATORS.outgoingUnresolvedReferencesValidator)
    const validators = Object.values(getDefaultChangeValidators(['outgoingUnresolvedReferencesValidator']))
    expect(validators).toHaveLength(allValidators.length - 1)
    expect(validators).not.toContain(DEFAULT_CHANGE_VALIDATORS.outgoingUnresolvedReferencesValidator)
  })
})
