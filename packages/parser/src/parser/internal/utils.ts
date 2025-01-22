/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
type EscapeTemplateMarkerOptions = {
  isLastPart?: boolean
}

export const escapeTemplateMarker = (
  prim: string,
  { isLastPart = true }: EscapeTemplateMarkerOptions | undefined = {},
): string =>
  prim.replace(
    // In the last part we don't need to escape a \ at the end
    isLastPart ? /(\\*)(\$\{)/g : /(\\*)(\$\{|$)/g,
    (_, backslashes, ending) =>
      // Double all leading backslashes and escape the ${
      `${backslashes.replace(/\\/g, '\\\\')}${ending === '' ? '' : '\\${'}`,
  )

type UnescapeTemplateMarkerOptions = EscapeTemplateMarkerOptions & {
  // The use case where we don't need to unescape the leading backslashes:
  // When we dump a single line string we call
  //  1. escapeTemplateMarker - which escapes the leading backslashes and the ${
  //  2. stringify which escapes all backslashes
  //  3. fixDoubleTemplateMarkerEscaping when unescapes the leading backslashes from 1
  // This means that when we want to parse back a single line string, we only need to undo the escaping of the ${
  unescapeLeadingBackslashes?: boolean
}

export const unescapeTemplateMarker = (
  text: string,
  { isLastPart = true, unescapeLeadingBackslashes = true }: UnescapeTemplateMarkerOptions | undefined = {},
): string =>
  text.replace(
    // In the last part we don't need to unescape \ at the end
    isLastPart ? /(\\*)(\\\$\{)/g : /(\\*)(\\\$\{|$)/g,
    (_, backslashes, ending) =>
      // Halve the leading backslashes (if needed) and unescape the ${
      `${unescapeLeadingBackslashes ? backslashes.replace(/\\\\/g, '\\') : backslashes}${ending === '' ? '' : '${'}`,
  )
