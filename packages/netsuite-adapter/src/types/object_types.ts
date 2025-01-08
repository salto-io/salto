/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType } from '@salto-io/adapter-api'

export type TypeAndInnerTypes = {
  type: ObjectType
  innerTypes: Readonly<Record<string, ObjectType>>
}

export type TypesMap<T extends string> = Readonly<Record<T, TypeAndInnerTypes>>
