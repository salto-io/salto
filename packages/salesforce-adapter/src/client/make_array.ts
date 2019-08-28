const makeArray = <TIn>(input: TIn | TIn[]): TIn[] => (Array.isArray(input) ? input : [input])

export default makeArray
