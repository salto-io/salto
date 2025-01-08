/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import NetsuiteClient from '../client/client'

export type ChangedObject = {
  type: 'object'
  objectId: string
  time: Date
}

export type ChangedType = {
  type: 'type'
  name: string
}

export type Change = ChangedType | ChangedObject

export type ChangedCustomRecord = {
  typeId: string
  objectId: string
}

export type DateRange = {
  start: Date
  end: Date
  toSuiteQLRange: () => [string, string]
  toSavedSearchRange: () => [string, string]
}

export type TypeChangesDetector = {
  getChanges: (client: NetsuiteClient, dateRange: DateRange) => Promise<Change[]>
  getTypes: () => string[]
}

export type FileCabinetChangesDetector = (client: NetsuiteClient, dateRange: DateRange) => Promise<ChangedObject[]>
