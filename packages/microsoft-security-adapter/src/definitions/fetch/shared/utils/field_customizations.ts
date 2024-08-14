/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElementFetchDefinition } from '../types'

/**
 * Convert a list of fields to a fieldCustomizations object with the given action
 */
const toOmittedOrHiddenFields = (
  fields: string[],
  action: 'hide' | 'omit',
): ElementFetchDefinition['fieldCustomizations'] =>
  fields
    .map(field => ({
      [field]: {
        [action]: true,
      },
    }))
    .reduce((acc, field) => ({ ...acc, ...field }), {})

/**
 * Convert a list of fields to a fieldCustomizations object with the hide action
 */
export const toHiddenFields = (fields: string[]): ElementFetchDefinition['fieldCustomizations'] =>
  toOmittedOrHiddenFields(fields, 'hide')

/**
 * Convert a list of fields to a fieldCustomizations object with the omit action
 */
export const toOmittedFields = (fields: string[]): ElementFetchDefinition['fieldCustomizations'] =>
  toOmittedOrHiddenFields(fields, 'omit')
