/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { collections } from '@salto-io/lowerdash'

const { awu } = collections.asynciterable

type ThenableIterable<T> = collections.asynciterable.ThenableIterable<T>

export const expectToContainAllItems = async <T>(
  itr: ThenableIterable<T>,
  items: ThenableIterable<T>,
): Promise<void> => {
  const arr = await awu(itr).toArray()
  await awu(items).forEach(item => expect(arr).toContainEqual(item))
}
