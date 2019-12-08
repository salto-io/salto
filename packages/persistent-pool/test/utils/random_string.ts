const DEFAULT_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export default (
  { length = 10, alphabet = DEFAULT_ALPHABET }: {
    length?: number
    alphabet?: string
  } = {},
): string => Array(...Array(length))
  .map(() => alphabet.charAt(Math.floor(Math.random() * alphabet.length)))
  .join('')
