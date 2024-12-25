/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isInstanceElement } from '@salto-io/adapter-api'
import { WeakReferencesHandler } from '../types'

const removeWeakReferences: WeakReferencesHandler['removeWeakReferences'] =
  ({ elementsSource }) =>
  async elements => {
    const instanceElements = elements.filter(isInstanceElement)
    const typee = await instanceElements[0].getType(elementsSource)
    console.log(typee)

    return { fixedElements: [], errors: [] }
  }

export const omitNonExistingFieldsHandler: WeakReferencesHandler = {
  findWeakReferences: async () => [],
  removeWeakReferences,
}
