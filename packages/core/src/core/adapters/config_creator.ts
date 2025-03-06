/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Adapter, ElemID, InstanceElement, ObjectType, Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { validateElement } from '@salto-io/workspace'

const log = logger(module)

export const getAdapterConfigOptionsType = ({
  adapterName,
  adapterCreators,
  configContext,
}: {
  adapterName: string
  adapterCreators: Record<string, Adapter>
  configContext?: Values
}): ObjectType | undefined => {
  const configContextType = adapterCreators[adapterName]?.configCreator?.configContextType
  if (configContextType === undefined || configContext === undefined) {
    return adapterCreators[adapterName]?.configCreator?.getOptionsType?.()
  }

  const adapterContextInstance = new InstanceElement(ElemID.CONFIG_NAME, configContextType, configContext)
  const validationErrors = validateElement(adapterContextInstance)
  if (validationErrors.length > 0) {
    validationErrors.forEach(error => {
      log.warn(
        'Invalid configContext for adapter: %s. Error message: %s, Element ID: %o',
        adapterName,
        error.message,
        error.elemID.getFullName(),
      )
    })
    return undefined
  }

  return adapterCreators[adapterName]?.configCreator?.getOptionsType?.(adapterContextInstance)
}
