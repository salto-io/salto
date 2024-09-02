/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { inspect } from 'util'
import { validatePlainObject } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { definitions } from '@salto-io/adapter-components'
import { ODATA_PREFIX, ODATA_TYPE_FIELD } from '../../constants'

const log = logger(module)

const extractTypeFromODataTypeField = ({
  typeName,
  odataTypeField,
}: {
  typeName: string
  odataTypeField: string
}): string | undefined => {
  // The odata type field is in the format of #microsoft.graph.{type}
  const typeParts = odataTypeField.split('.')
  if (typeParts.length < 3) {
    log.warn(`Failed to extract type from odataTypeField: ${odataTypeField} for ${typeName}`)
    return undefined
  }
  return typeParts.slice(2).join('.')
}
const restoreOdataTypeField = (extractedType: string): string => `${ODATA_PREFIX}${extractedType}`

/**
 * Return the adjusted field name for the OData type field, which is unique per typeName.
 */
export const getAdjustedOdataTypeFieldName = (typeName: string): string => `${typeName}Type`

/**
 *  The OData type field is in the format of #microsoft.graph.{type} as received from the service,
 *  and the field name is _odata_type@mv when converted to NACL case.
 *  We want to transform these to more user-friendly values, and vice versa.
 *  We don't simply omit this field since it's used for directory structure, deployment, etc.
 */
export const transformOdataTypeField: <TContext = definitions.ContextParams>(
  operation: 'fetch' | 'deploy',
) => definitions.AdjustFunctionSingle<TContext> =
  operation =>
  async ({ value, typeName }) => {
    validatePlainObject(value, typeName)
    const adjustedOdataTypeFieldName = getAdjustedOdataTypeFieldName(typeName)
    const originalOdataTypeFieldName = ODATA_TYPE_FIELD
    const existingOdataTypeFieldName = operation === 'fetch' ? originalOdataTypeFieldName : adjustedOdataTypeFieldName
    const odataTypeField = _.get(value, existingOdataTypeFieldName)
    if (!_.isString(odataTypeField)) {
      log.warn(
        `Failed to adjust ${existingOdataTypeFieldName} field for ${typeName} on operation ${operation} - value is not a string, value: ${inspect(odataTypeField)}`,
      )
      return { value }
    }
    return {
      value: {
        ..._.omit(value, existingOdataTypeFieldName),
        ...(operation === 'fetch'
          ? { [adjustedOdataTypeFieldName]: extractTypeFromODataTypeField({ typeName, odataTypeField }) }
          : { [originalOdataTypeFieldName]: restoreOdataTypeField(odataTypeField) }),
      },
    }
  }
