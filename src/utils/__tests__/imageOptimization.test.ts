import { describe, it, expect } from 'vitest';
import {
  calculateTargetDimensions,
  createSafeImageFilename,
  formatFileSize,
  validateImageFile,
  IMAGE_PROFILES,
} from '../imageOptimization';

describe('imageOptimization Utility', () => {
  describe('calculateTargetDimensions', () => {
    it('deve redimensionar mantendo a proporção quando a imagem for maior que o limite (paisagem)', () => {
      const result = calculateTargetDimensions(2400, 1600, 800, 800);
      expect(result).toEqual({ width: 800, height: 533 });
    });

    it('deve redimensionar mantendo a proporção quando a imagem for maior que o limite (retrato)', () => {
      const result = calculateTargetDimensions(1200, 2400, 800, 800);
      expect(result).toEqual({ width: 400, height: 800 });
    });

    it('NUNCA deve ampliar (upscale) imagens menores que o limite máximo', () => {
      const result = calculateTargetDimensions(600, 400, 800, 800);
      expect(result).toEqual({ width: 600, height: 400 });
    });

    it('deve respeitar o perfil de banner de até 1600px', () => {
      const profile = IMAGE_PROFILES.banner;
      const result = calculateTargetDimensions(3200, 1800, profile.maxWidth, profile.maxHeight);
      expect(result).toEqual({ width: 1600, height: 900 });
    });
  });

  describe('createSafeImageFilename', () => {
    it('deve gerar um nome com extensão .webp e UUID v4 válido', () => {
      const filename = createSafeImageFilename('foto_original.jpg', 'product');
      expect(filename).toMatch(/^product_[a-f0-9-]{36}\.webp$/);
    });
  });

  describe('formatFileSize', () => {
    it('deve formatar bytes de forma amigável em pt-BR', () => {
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1536)).toBe('1,5 KB');
      expect(formatFileSize(5242880)).toBe('5,00 MB');
    });
  });

  describe('validateImageFile', () => {
    it('deve aceitar arquivos JPG, PNG e WebP com tamanho válido', () => {
      const mockFile = new File(['mock'], 'foto.jpg', { type: 'image/jpeg' });
      expect(() => validateImageFile(mockFile)).not.toThrow();
    });

    it('deve rejeitar formatos inválidos como GIF ou SVG', () => {
      const mockGif = new File(['mock'], 'animacao.gif', { type: 'image/gif' });
      expect(() => validateImageFile(mockGif)).toThrow('Este formato de imagem não é compatível. Envie uma imagem JPG, PNG ou WebP.');
    });

    it('deve rejeitar arquivos acima do limite máximo de bytes', () => {
      const mockHugeFile = new File(['mock'], 'gigante.png', { type: 'image/png' });
      Object.defineProperty(mockHugeFile, 'size', { value: 6 * 1024 * 1024 });

      expect(() => validateImageFile(mockHugeFile)).toThrow('A imagem selecionada é muito grande. Escolha um arquivo de até 5 MB.');
    });
  });
});
