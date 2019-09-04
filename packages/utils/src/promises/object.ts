import _ from 'lodash'

// transforms an object's values using an async mapper function
// returns an object whose values are the resolved results of the mapper
export const mapValuesAsync = async <TVal1, TVal2>(
  o: Record<string, TVal1>,
  mapper: (val: TVal1, key: string) => Promise<TVal2>
): Promise<Record<string, TVal2>> => {
  const pairsPromises = Object.entries(o).map(async ([key, val]) => {
    const mappedVal = await mapper(val, key)
    return [key, mappedVal]
  })

  const pairs = await Promise.all(pairsPromises)

  return _.fromPairs(pairs)
}

// transform an object whos values are promises into an object
// whos values are the result of resolving the promises
export const resolveValues = <TVal>(
  o: Record<string, Promise<TVal>>
): Promise<Record<string, TVal>> => mapValuesAsync(o, _.identity)
