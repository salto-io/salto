//
// AtLeastOne, RequiredMember, HasMember
//

// https://stackoverflow.com/a/48244432
export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U]

export type RequiredMember<T, M extends keyof T> = {
  [P in M]-?: T[P];
}

export type HasMember<T, M extends keyof T> = T & RequiredMember<T, M>

export const hasMember = <T, M extends keyof T>(
  m: M,
  o: T,
): o is HasMember<T, M> => !!o[m]

// filters an array of T and returns only the items that have the specified member M
export const filterHasMember = <T, M extends keyof T>(
  m: M, objs: T[]
): HasMember<T, M>[] => objs.filter(f => hasMember(m, f)) as HasMember<T, M>[]

//
// Beans
//

export class _Bean<T> {
  constructor(props: T) {
    Object.assign(this, props)
  }
}

export type Bean<T> = _Bean<T> & T
export const Bean = _Bean as new <T>(props: T) => Bean<T>
