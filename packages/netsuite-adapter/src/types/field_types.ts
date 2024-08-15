/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, PrimitiveType, PrimitiveTypes } from '@salto-io/adapter-api'
import { FIELD_TYPES_PATH, NETSUITE, SUBTYPES_PATH, TYPES_PATH } from '../constants'

export const fieldTypes = {
  cdata: new PrimitiveType({
    elemID: new ElemID(NETSUITE, 'cdata'),
    primitive: PrimitiveTypes.STRING,
    path: [NETSUITE, TYPES_PATH, SUBTYPES_PATH, FIELD_TYPES_PATH],
  }),
  fileContent: new PrimitiveType({
    elemID: new ElemID(NETSUITE, 'fileContent'),
    primitive: PrimitiveTypes.STRING,
    path: [NETSUITE, TYPES_PATH, SUBTYPES_PATH, FIELD_TYPES_PATH],
  }),
}
