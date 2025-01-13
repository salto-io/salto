/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element } from '@salto-io/adapter-api'
import { parser } from '@salto-io/parser'

type SyncParsedNaclFileData = {
  errors: () => parser.ParseError[]
  staticFiles: () => string[]
}

type ParsedNaclFileData = {
  errors: () => Promise<parser.ParseError[] | undefined>
  staticFiles: () => Promise<string[] | undefined>
}

export type SyncParsedNaclFile = {
  filename: string
  elements: () => Element[]
  data: SyncParsedNaclFileData
  buffer?: string
  sourceMap?: () => parser.SourceMap
}

export type ParsedNaclFile = {
  filename: string
  elements: () => Promise<Element[] | undefined>
  data: ParsedNaclFileData
  buffer?: string
  sourceMap: () => Promise<parser.SourceMap | undefined>
}
