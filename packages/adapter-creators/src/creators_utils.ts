/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ObjectType } from '@salto-io/adapter-api'
import adapterCreators from './creators'

export const getSupportedServiceAdapterNames = (): string[] => Object.keys(adapterCreators)

// TODO: After SALTO-7473 is done, this function should be removed
export const getAdapterConfigOptionsType = (adapterName: string): ObjectType | undefined =>
  adapterCreators[adapterName]?.configCreator?.getOptionsType?.()
