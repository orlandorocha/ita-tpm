declare module "qrcode" {
  export function toDataURL(value: string, options?: { type?: string; width?: number; margin?: number }): Promise<string>;
}
