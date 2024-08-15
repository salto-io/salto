/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
export const weightedChunks = <T>(
  values: T[],
  size: number,
  weightFunc: (val: T) => number,
  maxItemsPerChunk = Infinity,
): T[][] => {
  const chunks: T[][] = []

  values.reduce((chunkWeight, val) => {
    const valWeight = weightFunc(val)

    if (valWeight + chunkWeight > size || chunks.length === 0 || chunks[chunks.length - 1].length >= maxItemsPerChunk) {
      chunks.push([val])
      return valWeight
    }

    chunks[chunks.length - 1].push(val)
    return valWeight + chunkWeight
  }, 0)
  return chunks
}

export const chunkByEvenly = <T>(values: T[], size: number, weightFunc: (val: T) => number): T[][] => {
  const totalSize = values.reduce((sum, change) => sum + weightFunc(change), 0)
  const avgChunkSize = totalSize / Math.ceil(totalSize / size)
  const avgItemSize = totalSize / values.length
  const desiredChunkSize = Math.min(size, avgChunkSize + avgItemSize / 2)
  return weightedChunks(values, desiredChunkSize, weightFunc)
}
