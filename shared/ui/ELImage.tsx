/**
 * ELImage - Ant Design Image wrapper (com preview/zoom ao clicar)
 * Usar para fotos e imagens que precisam de preview interativo.
 *
 * Para imagens de conteúdo (logos, ícones, banners) que precisam
 * de otimização automática (WebP, lazy loading, responsive),
 * usar ELOptimizedImage.
 */
import { Image } from 'antd';
import type { ImageProps } from 'antd';
import NextImage from 'next/image';
import type { ImageProps as NextImageProps } from 'next/image';

// --- Ant Design Image (preview/zoom) ---
export type ELImageProps = ImageProps;
export const ELImage = Image;

// --- Next.js Image (otimizado) ---
export type ELOptimizedImageProps = NextImageProps;

/**
 * ELOptimizedImage - next/image wrapper com otimização automática.
 *
 * Benefícios sobre <img> ou antd Image:
 * - Conversão automática para WebP/AVIF
 * - Lazy loading nativo
 * - Responsive sizing automático
 * - Prevenção de layout shift (width/height obrigatórios)
 *
 * @example
 * <ELOptimizedImage src="/logo.png" alt="Logo" width={200} height={50} />
 * <ELOptimizedImage src={url} alt="Banner" fill style={{ objectFit: 'cover' }} />
 */
export function ELOptimizedImage(props: ELOptimizedImageProps) {
  return <NextImage {...props} />;
}
