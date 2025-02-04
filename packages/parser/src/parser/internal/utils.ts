/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

// Template marker escaping logic:
//
// In normal strings we need to escape everything that JSON.stringify would escape, and also the template marker (${)
// In multi line strings we only need to escape the multi line string terminator (''') and the template marker (${)
// In template static files we only need to escape the template marker
//
// The code below deals with the escaping of the template marker.
// The first rule is that we replace ${ -> \${
// This leads to an ambiguous case where if we had \${ in the string or a \ followed by a real reference, both cases would end up being \\${
// Given this, we must escape \ as well, but just the ones that come immediately before a ${ or a reference
// So for example a string with \${ will be escaped to \\\${
// A string with \ followed by a reference will be \\${
// and so on...
type EscapeTemplateMarkerOptions = {
  isNextPartReference?: boolean
}

export const escapeTemplateMarker = (
  prim: string,
  { isNextPartReference = false }: EscapeTemplateMarkerOptions | undefined = {},
): string =>
  prim.replace(
    // If the next part is a reference, we need to escape all \ at the end of the part
    isNextPartReference ? /(\\*)(\$\{|$)/g : /(\\*)(\$\{)/g,
    (_, backslashes, ending) =>
      // Double all leading backslashes and escape the ${
      `${backslashes.replace(/\\/g, '\\\\')}${ending === '' ? '' : '\\${'}`,
  )

type UnescapeTemplateMarkerOptions = EscapeTemplateMarkerOptions & {
  // The use case where we unescape only leading backslashes or only marker:
  // When we dump a single line string we call
  //  1. escapeTemplateMarker - which escapes the leading backslashes and the marker
  //  2. stringify which escapes all backslashes, not just the leading backslashes (so the leading backslashes are escaped twice at this point)
  //  3. In order to fix the double escaping, we unescape leadingBackslashOnly as part of the dump code

  // When we parse a single ine string we call
  //  1. JSON.parse which unescapes all backslashes
  //  2. Since we already unescaped the leading backslashes in part 3 of the dump process, we unescape markerOnly
  unescapeStrategy?: 'all' | 'leadingBackslashOnly' | 'markerOnly'
}

export const unescapeTemplateMarker = (
  text: string,
  { isNextPartReference = false, unescapeStrategy = 'all' }: UnescapeTemplateMarkerOptions | undefined = {},
): string => {
  if (unescapeStrategy === 'leadingBackslashOnly') {
    return text.replace(/(\\*)(\\\\\$\{)/g, (_match, backslashes, ending) =>
      // Halve the leading backslashes before the escaped ${
      `${backslashes}${ending}`.replace(/\\\\/g, '\\'),
    )
  }
  return text.replace(
    // We need to unescape \${, but if the next part is a reference, we also need to unescape \ at the end of the part
    isNextPartReference ? /(\\*)(\\\$\{|$)/g : /(\\*)(\\\$\{)/g,
    (_, backslashes, ending) => {
      const leadingBackslashes = unescapeStrategy === 'markerOnly' ? backslashes : backslashes.replace(/\\\\/g, '\\')
      if (ending === '') {
        return leadingBackslashes
      }
      return `${leadingBackslashes}\${`
    },
  )
}
