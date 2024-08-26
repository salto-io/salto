/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement } from '@salto-io/adapter-api'

export type ElemServiceID = {
  elemID: ElemID
  serviceID: string
}

export type ServiceIdRecords = Record<string, ElemServiceID>

export type ElementsSourceIndexes = {
  serviceIdRecordsIndex: ServiceIdRecords
  internalIdsIndex: Record<string, ElemID>
  customFieldsIndex: Record<string, InstanceElement[]>
  elemIdToChangeByIndex: Record<string, string>
  elemIdToChangeAtIndex: Record<string, string>
  customRecordFieldsServiceIdRecordsIndex: ServiceIdRecords
  customFieldsSelectRecordTypeIndex: Record<string, unknown>
}

export type LazyElementsSourceIndexes = {
  getIndexes: () => Promise<ElementsSourceIndexes>
}
