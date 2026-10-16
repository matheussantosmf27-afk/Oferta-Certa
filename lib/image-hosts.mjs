// Domínios de imagem aceitos pelo otimizador do Next (next.config.mjs) e pelo cadastro manual de produtos.
// Fica em .mjs para ser lido também pelo next.config. Liberar "**" deixaria qualquer um usar o
// otimizador do site (e a cota da Vercel) com imagens de terceiros.
export const IMAGE_HOST_PATTERNS = [
  '**.mlstatic.com', // Mercado Livre
  '**.susercontent.com', // Shopee
  '**.alicdn.com', // AliExpress
  '**.aliexpress-media.com', // AliExpress
  'm.media-amazon.com', // Amazon
  '**.ssl-images-amazon.com', // Amazon
]

/** Mesmo critério do Next: "**.dominio" aceita qualquer subdomínio; sem "**", só o host exato. */
export function isAllowedImageHost(hostname) {
  const host = String(hostname).toLowerCase()
  return IMAGE_HOST_PATTERNS.some((pattern) =>
    pattern.startsWith('**.') ? host.endsWith(pattern.slice(2)) && host.length > pattern.length - 2 : host === pattern
  )
}
