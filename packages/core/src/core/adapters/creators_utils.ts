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

export const getAdapterConfigOptionsType = (
  adapterName: string,
  adapterCreators: Record<string, Adapter>,
  adapterOptionsTypeContext?: Values,
): ObjectType | undefined => {
  const configContextType = adapterCreators[adapterName]?.configCreator?.configContextType
  if (!configContextType || !adapterOptionsTypeContext) {
    const getOptionsType = adapterCreators[adapterName]?.configCreator?.getOptionsType
    return getOptionsType ? getOptionsType() : undefined
  }

  const adapterContextInstance = new InstanceElement(ElemID.CONFIG_NAME, configContextType, adapterOptionsTypeContext)
  const validationErrors = validateElement(adapterContextInstance)
  if (validationErrors.length > 0) {
    log.warn(
      `Invalid adapterOptionsTypeContext for adapter: ${adapterName}. ` +
        `Expected structure: ${configContextType.fields}, `,
    )
    return undefined
  }
  return adapterCreators[adapterName]?.configCreator?.getOptionsType?.(adapterContextInstance)
}
