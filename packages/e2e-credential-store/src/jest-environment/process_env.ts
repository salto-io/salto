// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default (env: NodeJS.ProcessEnv) => ({
  required: (name: string): string => {
    if (!(name in env)) {
      throw new Error(`required env var ${name} missing`)
    }
    return env[name] ?? ''
  },
  bool: (k: string): boolean => ['1', 'true', 'yes'].includes(env[k] ?? ''),
})
