/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'

export type RefListItem = {
  label: string
  value: string
}

export type BlockBase = {
  keyword: string
  provider?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isListItem = (value: any): value is RefListItem =>
  _.isObjectLike(value) && _.isString(value.label) && _.isString(value.value)

export const createBlockChecker =
  <T extends BlockBase>(
    scheme: Joi.AnySchema,
    supportedApps: string[],
  ): ((value: unknown, application: string) => value is T) =>
  (value: unknown, application: string): value is T => {
    const isAdapterBlock = createSchemeGuard<T>(scheme)

    return isAdapterBlock(value) && supportedApps.includes(application) && value.provider === application
  }
