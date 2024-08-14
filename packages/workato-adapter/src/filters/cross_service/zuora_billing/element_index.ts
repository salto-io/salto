/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element } from '@salto-io/adapter-api'
import _ from 'lodash'

export type ZuoraIndex = Record<string, Readonly<Element>[]>

export const indexZuoraByElemId = (elements: ReadonlyArray<Readonly<Element>>): ZuoraIndex =>
  _(elements)
    .groupBy(e => e.elemID.getFullName())
    .entries()
    // Currently we only index objects
    // (metadataType is our way to differ between Zuora objects to the rest of the elements)
    .filter(([_key, group]) => group.some(e => e.annotations.metadataType !== undefined))
    .fromPairs()
    .mapKeys((_val, key) => key.toLowerCase())
    .value()
