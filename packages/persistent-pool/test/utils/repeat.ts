const repeat = <T>(
  num: number,
  f: (index: number) => T
): T[] => Array.from({ length: num }).map((_, i) => f(i))

export default repeat
