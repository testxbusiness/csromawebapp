export function e2eEnv(name: string): string | undefined {
  return process.env[`${name}_PWA`] || process.env[name] || process.env[`${name}_LOCAL`]
}
