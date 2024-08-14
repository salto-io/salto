/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { SourceRange } from './internal/types'

export class SourceMap extends collections.treeMap.TreeMap<SourceRange> {
  constructor(entries: Iterable<[string, SourceRange[]]> = []) {
    super(entries, ElemID.NAMESPACE_SEPARATOR)
  }
}
